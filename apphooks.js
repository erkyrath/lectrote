'use strict';

const AppHooks = function() {

const electron = require('electron');
const path_mod = require('path');
const fs = require('fs');

const fonts = require('./fonts.js');
const searchbar = require('./searchbar.js');
const formats = require('./formats.js');
const traread = require('./traread.js');
const tragen = require('./tragen.js');

function load_named_game(arg)
{
    const engine = formats.enginemap[arg.engine];
    if (!engine) {
        throw new Error('Unrecognized engine: ' + arg.engine);
    }

    var path = arg.path;
    var default_name = path_mod.basename(path);
    var buf = fs.readFileSync(path);
    var load_options = { format:'array' };

    game_options.default_page_title = default_name;
    game_options.game_format_name = engine.name; /* label used for loading error messages */
    game_options.engine_name = engine.name; /* label used in page title */
    game_options.recording_handler = tragen.record_update;
    
    var arr = null;
    if (engine.load)
        arr = engine.load(arg, buf, game_options);

    GiLoad.load_run(game_options, arr, load_options);
    /* Note that load_run() is synchronous with this config (the "not a
       URL at all" path). So Blorb should now be safely inited. */
    var Blorb = GiLoad.getlibrary('Blorb');
    if ((!Blorb) || (!Blorb.inited())) {
        console.log('Blorb is not inited after load_run()!');
    }

    /* Pass some metadata back to the app. A fallback title at the
       very least. */
    var obj = {
        title: default_name
    };

    if (Blorb && Blorb.get_metadata) {
        for (var key of traread.metadata_keylist) {
            var val = Blorb.get_metadata(key);
            if (val)
                obj[key] = val;
        }
    }

    if (engine.get_signature) {
        var signature = engine.get_signature();
        if (signature)
            obj.signature = signature;
    }

    var coverimageres = undefined;
    if (Blorb && Blorb.get_cover_pict) {
        coverimageres = Blorb.get_cover_pict();
    }
    if (coverimageres !== undefined) {
        obj.coverimageres = coverimageres;
    }

    /* Also pass the info to the transcript module. */
    tragen.set_transcriptdir(arg.transcriptdir);
    tragen.set_metadata(obj);
    
    electron.ipcRenderer.send('game_metadata', obj);
}

function set_clear_autosave(val)
{
    game_options.clear_vm_autosave = val;
}

function set_disable_autosave(val)
{
    game_options.do_vm_autosave = (!val);
}

function display_cover_art(dat)
{
    /* If the cover art pane is already up, remove it. */
    var panel = $('#cover_art_pane');
    if (panel.length) {
        panel.remove();
        return;
    }
    
    if (dat) {
        /* dat is an object containing { url, width, height } of an image. */
    }
    else {
        var Blorb = GiLoad.getlibrary('Blorb');
        
        /* dat is null; try to use the cover image data from the blorb. */
        if (!(Blorb && Blorb.get_cover_pict))
            return;
        var coverimageres = Blorb.get_cover_pict();
        if (coverimageres === undefined)
            return;
        
        var info = Blorb.get_image_info(coverimageres);
        if (!info)
            return;
        var url = Blorb.get_image_url(coverimageres);

        dat = { url:url, width:info.width, height:info.height };
    }

    if (!dat.url || !dat.width || !dat.height)
        return;
    
    var panel = $('<div>', { id:'cover_art_pane' });
    var imgel = $('<img>', { src:dat.url });
    var heightval = Math.round(90 * dat.height / dat.width);
    imgel.css({ width:'90vmin', height:heightval+'vmin' });
    panel.append(imgel);
    var inpel = $('<input>');
    inpel.val(' Hit any key ');
    panel.append(inpel);

    var removefunc = function() {
        $('#cover_art_pane').remove();
        return true;
    };
    panel.on('click', removefunc);
    inpel.on('keypress', removefunc);
    inpel.on('keydown', removefunc);

    $('#content').append(panel);
    inpel.focus();
}
    
function set_zoom_factor(val) 
{
    var webFrame = electron.webFrame;
    webFrame.setZoomFactor(val);
}

function set_margin_level(val)
{
    var str = '0px ' + (5*val) + '%';
    $('#gameport').css({'margin':str});
}

function set_color_theme(obj)
{
    var val = obj.theme;
    var darklight_flag = obj.darklight;
    
    // System-reactive themes:
    if (val == 'lightdark') {
        val = (darklight_flag ? 'dark' : 'light');
    }
    else if (val == 'sepiaslate') {
        val = (darklight_flag ? 'slate' : 'sepia');
    }

    var bodyel = $('body');

    bodyel.removeClass('SepiaTheme');
    bodyel.removeClass('SlateTheme');
    bodyel.removeClass('DarkTheme');

    var search_body_el = searchbar.get_search_body();
    
    if (search_body_el) {
        search_body_el.removeClass('SepiaTheme');
        search_body_el.removeClass('SlateTheme');
        search_body_el.removeClass('DarkTheme');
    }

    switch (val) {

    case 'sepia':
        bodyel.addClass('SepiaTheme');
        if (search_body_el)
            search_body_el.addClass('SepiaTheme');
        break;

    case 'slate':
        bodyel.addClass('SlateTheme');
        if (search_body_el)
            search_body_el.addClass('SlateTheme');
        break;

    case 'dark':
        bodyel.addClass('DarkTheme');
        if (search_body_el)
            search_body_el.addClass('DarkTheme');
        break;

    default:
        /* Light theme is the default. */
        break;
    }
}

function set_font(obj)
{
    var fontline = fonts.get_fontline(obj.font, obj.customfont);

    var fontclass = '.BufferWindow';
    /* In Parchment the buffer-div class is different, so check the
       game options for that. (Parchment is not part of Lectrote any
       more, but we keep the option.) */
    if (game_options.lectrote_font_class)
        fontclass = game_options.lectrote_font_class;

    var el = $('#fontcss');
    if (!fontline) {
        el.remove();
    }
    else {
        if (!el.length) {
            el = $('<style>', { id:'fontcss', type:'text/css' });
            $('#bodycss').before(el);
        }
        var text = '@@2 { font-family: @@1; }\n@@2 .Input { font-family: @@1; }\n';
        text = text.replace(/@@1/g, fontline);
        text = text.replace(/@@2/g, fontclass);
        el.text(text);
    }
}

function sequence(argls)
{
    /* The argument is a list of { key, arg } pairs. */
    for (var arg of argls) {
        var func = namespace[arg.key];
        if (!func) {
            console.log('sequence: unable to find handler: ' + arg.key);
            continue;
        }
        func(arg.arg);
    }
}
    
const namespace = {
    load_named_game : load_named_game,
    set_clear_autosave : set_clear_autosave,
    set_disable_autosave : set_disable_autosave,
    display_cover_art : display_cover_art,
    set_zoom_factor : set_zoom_factor,
    set_margin_level : set_margin_level,
    set_color_theme : set_color_theme,
    set_font : set_font,
    search_request : searchbar.search_request,
    sequence : sequence
};

/* We hook up the namespace to IPC events, so that the main process can
   send to it.
   This requires a utility function because of Javascript's lousy closures.
*/
function attach(name, func)
{ 
    require('electron').ipcRenderer.on(name, function(ev, arg) {
        func(arg);
    });
}
for (var name in namespace) {
    attach(name, namespace[name]);
}

$(document).ready(function() {
    searchbar.construct_searchbar();
});

return namespace;
}();

