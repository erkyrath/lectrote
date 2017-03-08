'use strict';

const Story = require('./inkjs/ink.min.js').Story;

/* The inkjs story object that will be loaded. */
var story = null;
/* Short string which will (hopefully) be unique per game. */
var signature = null;
/* Global taqgs. */
var metadata = {};

/* We need to distinguish each turn's hyperlinks. */
var game_turn = 0;

/* History of recent window output. We need this to do autosave. */
var scrollback = [];
/* Extra update information -- autorestore only. */
var autorestore_glkstate = null;

/* Start with the defaults. These can be modified later by the game_options
   defined in the HTML file.

   Note that the "io" entry is not filled in here, because
   we don't know whether the GlkOte library was loaded before
   this one. We'll fill it in at load_run() time.
*/
var all_options = {
    io: null,              // default display layer (GlkOte)
    spacing: 0,            // default spacing between windows
    set_page_title: true,  // set the window title to the game name
    default_page_title: 'Game', // fallback game name to use for title
    exit_warning: 'The game session has ended.',
};

/* Launch the game. The buf argument must be a Node Buffer.
 */
function load_run(optobj, buf)
{
    all_options.io = window.GlkOte;

    if (!optobj)
        optobj = window.game_options;
    if (optobj)
        jQuery.extend(all_options, optobj);

    /* We construct a simplistic signature: the length and bytewise
       sum of the buffer. */
    var checksum = 0;
    for (var ix=0; ix<buf.length; ix++)
        checksum += (buf[ix] & 0xFF);
    signature = 'ink_' + checksum + '_' + buf.length;

    /* Load the appropriate version of the ink engine, based on the
       story file's inkVersion. (This logic is derived from the
       inkVersionMinimumCompatible defined in inkjs.) */
    try {
        var str = buf.toString('utf8');
        /* First we strip the BOM, if there is one. Dunno why JSON.parse
           can't deal with a BOM, but okay. */
        str = str.replace(/^\uFEFF/, '');
        var json = JSON.parse(str);
        var version = parseInt(json["inkVersion"]);
        if (version >= 16) {
            /* current version of inkjs */
            story = new Story(json);
        }
        else if (version >= 15) {
            console.log('Game version', version, '; loading inkjs 1.4.6');
            const OldStory = require('./inkjs/ink-146.min.js').Story;
            story = new OldStory(json);
        }
        else {
            console.log('Game version', version, '; loading inkjs 1.3.0');
            const OldStory = require('./inkjs/ink-130.min.js').Story;
            story = new OldStory(json);
        }
    }
    catch (ex) {
        GlkOte.error("Unable to load story: " + show_exception(ex));
        return;
    }

    /* We can't support external functions, but we can make sure the
       callbacks get called, at least. */
    story.allowExternalFunctionFallbacks = true;

    /* Pull out the story's global tag info. This may include title
       and author. */
    try {
        var tags = story.globalTags;
        if (tags) {
            for (var ix=0; ix<tags.length; ix++) {
                var pos = tags[ix].search(':');
                if (pos >= 0) {
                    var key = tags[ix].slice(0, pos).trim();
                    var val = tags[ix].slice(pos+1).trim();
                    metadata[key] = val;
                }
            }
        }
    }
    catch (ex) {
        console.log("Unable to read globalTags", ex);
    }

    {
        var title = metadata.title;
        if (!title)
            title = all_options.default_page_title;
        if (!title)
            title = 'Game';
        
        if (all_options.set_page_title)
            document.title = title + " - InkJS";
    }

    all_options.accept = game_accept;

    /* Now fire up the display library. This will take care of starting
       the VM engine, once the window is properly set up. */
    all_options.io.init(all_options);
}

function get_game_signature()
{
    return signature;
}

function get_metadata(key)
{
    return metadata[key];
}

function game_choose(val)
{
    try {
        story.ChooseChoiceIndex(val);
    }
    catch (ex) {
        GlkOte.error("Unable to choose: " + show_exception(ex));
        return;
    }
}

function game_cycle()
{
    try {
        while (story.canContinue) {
            var text = story.Continue();
            say(text);
        }
    }
    catch (ex) {
        GlkOte.error("Unable to continue: " + show_exception(ex));
        return;
    }

    if (!story.currentChoices.length) {
        game_quit = true;
        GlkOte.warning(all_options.exit_warning);
        return;        
    }
    
    game_turn++;

    for (var ix=0; ix<story.currentChoices.length; ix++) {
        var choice = story.currentChoices[ix];
        say_choice(ix, game_turn, choice.text);
    }
    say('');

}

/* Create (or erase) an autosave file.
*/
function perform_autosave(clear)
{
    if (clear) {
        Dialog.autosave_write(signature, null);
        return;
    }

    var snapshot = {
        ink: story.state.jsonToken,
        turn: game_turn,
        scrollback: scrollback.slice(0),
        glkote: GlkOte.save_allstate()
    };

    /* Write the snapshot into an appropriate location, which depends
       on the game signature. */
    Dialog.autosave_write(signature, snapshot);
}

/* Load the autosave file back in.
*/
function perform_autorestore(snapshot)
{
    story.state.jsonToken = snapshot.ink;
    game_turn = snapshot.turn;

    for (var ix=0; ix<snapshot.scrollback.length; ix++)
        game_streamout.push(snapshot.scrollback[ix]);
    
    /* Stash this for the next (first) GlkOte.update call. */
    autorestore_glkstate = snapshot.glkote;
    
}

window.GiLoad = {
    load_run: load_run,
    get_metadata: get_metadata,
    get_game_signature: get_game_signature,
};


var game_generation = 1;
var game_metrics = null;
var game_streamout = [];
var game_quit = false;

function startup() 
{
    if (all_options.clear_vm_autosave) {
        Dialog.autosave_write(signature, null);
    }
    if (all_options.do_vm_autosave && !all_options.clear_vm_autosave) {
        try {
            var snapshot = Dialog.autosave_read(signature);
            if (snapshot) {
                console.log('Found autosave...');
                perform_autorestore(snapshot);
                return;
            }
        }
        catch (ex) {
            console.log('Autorestore failed, deleting it: ' + show_exception(ex));
            if (ex.stack)
                console.log('JS stack dump:\n' + ex.stack);
            Dialog.autosave_write(signature, null);
        }
    }

    /* Do the initial game output. */
    say('\n\n\n');
    game_cycle();
}

/* Print a line of text. (Or several lines, if the argument contains \n
   characters.)

   The optional second argument is the text style. The standard glkote.css
   file defines all the usual Glk styles: 'normal', 'emphasized' (italics),
   'preformatted' (fixed-width), 'subheader' (bold), 'header' (large bold),
   'alert', 'note', and 'input'.

   If the third argument is true, the text is appended to the previous
   line instead of starting a new line.
*/
function say(val, style, runon) 
{
    if (style == undefined)
        style = 'normal';
    var ls = val.split('\n');
    for (var ix=0; ix<ls.length; ix++) {
        if (runon) {
            if (ls[ix])
                game_streamout.push({ content: [style, ls[ix]], append: 'true' });
            runon = false;
        }
        else {
            if (ls[ix])
                game_streamout.push({ content: [style, ls[ix]] });
            else
                game_streamout.push({ });
        }
    }
}

/* Print a line of text, appending it to the previous line. This is a
   clearer shortcut for say(val, style, true).
*/
function say_runon(val, style) 
{
    say(val, style, true);
}

/* Print one ink choice. This is a special case which sets the hypertext
   attribute.

   To avoid accepting old choices, the turn argument should be different
   for every input cycle.
*/
function say_choice(index, turn, text)
{
    var link = turn+':'+index;

    var indexstr;
    if (index <= 8)
        indexstr = String.fromCharCode(49+index);
    else if (index <= 34)
        indexstr = String.fromCharCode(65+index-9);
    else
        indexstr = '-';

    game_streamout.push({ content: [
                { style:'note', text:indexstr+': ' },
                { style:'note', text:text, hyperlink:link },
            ] });
    
}

/* This is the top-level game event hook. It's all set up for a basic
   game that accepts line input. */
function game_accept(res) 
{
    if (res.type == 'init') {
        game_metrics = res.metrics;
        startup();
    }
    else if (res.type == 'arrange') {
        game_metrics = res.metrics;
    }
    else if (res.type == 'hyperlink') {
        var ls = res.value.split(':');
        if (ls.length == 2) {
            var turn = parseInt(ls[0]);
            var index = parseInt(ls[1]);
            if (turn == game_turn && index >= 0 && index < story.currentChoices.length) {
                game_choose(index);
                game_cycle();
            }
        }
    }
    else if (res.type == 'char') {
        var index = undefined;
        if (res.value.length == 1) {
            var val = res.value.charCodeAt(0);
            if (val >= 49 && val <= 57)
                index = val - 49;
            else if (val >= 65 && val <= 90)
                index = (val - 65) + 9;
            else if (val >= 97 && val <= 122)
                index = (val - 97) + 9;
        }
        if (index !== undefined && index >= 0 && index < story.currentChoices.length) {
            game_choose(index);
            game_cycle();
        }
    }
    
    game_select();
}

/* This constructs the game display update and sends it to the display.
   It's all set up for a basic game that accepts line input. */
function game_select() 
{
    game_generation = game_generation+1;
    
    var metrics = game_metrics;
    var pwidth = metrics.width;
    var pheight = metrics.height;
    
    var argw = [
        { id: 1, type: 'buffer', rock: 11,
          left: metrics.outspacingx,
          top: metrics.outspacingy,
          width: pwidth-(2*metrics.outspacingx),
          height: pheight-(metrics.outspacingy+metrics.outspacingy) }
    ];
    
    var argc = [ ];
    if (game_streamout.length) {
        var obj = { id: 1 };
        if (game_streamout.length) {
            obj.text = game_streamout.slice(0);

            for (var ix=0; ix<obj.text.length; ix++)
                scrollback.push(obj.text[ix]);
            if (scrollback.length > 100)
                scrollback.splice(0, scrollback.length-100);
        }
        game_streamout.length = 0;
        argc.push(obj);
    }
    
    
    var argi = [];

    if (!game_quit) {
        argi.push({ id: 1, gen: game_generation, type: 'char', hyperlink: true });
    }
    
    var arg = { type:'update', gen:game_generation, windows:argw, content:argc, input:argi };

    if (game_quit) {
        arg.disable = true;
    }
    
    /* If we're doing an autorestore, autorestore_glkstate will 
       contain additional setup information for the first update()
       call only. */
    if (autorestore_glkstate)
        arg.autorestore = autorestore_glkstate;
    autorestore_glkstate = null;

    GlkOte.update(arg);
    
    if (all_options.do_vm_autosave) {
        perform_autosave(game_quit);
    }
}

/* Exception objects are hard to display in Javascript. This is a rough
   attempt.
*/
function show_exception(ex) 
{
    if (typeof(ex) == 'string')
        return ex;
    var res = ex.toString();
    if (ex.message)
        res = res + ' ' + ex.message;
    if (ex.fileName)
        res = res + ' ' + ex.fileName;
    if (ex.lineNumber)
        res = res + ' line:' + ex.lineNumber;
    if (ex.name)
        res = res + ' ' + ex.name;
    if (ex.number)
        res = res + ' ' + ex.number;
    return res;
}

