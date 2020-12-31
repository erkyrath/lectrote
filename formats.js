'use strict';

/* This module is used by both the main process (main.js) and the game
   process (apphooks.js). And the prefs window too, come to think of it.
   It contains all the information about the game formats which Lectrote
   understands.

   The bulk of this module is a list of format entries, each of which
   contains (zero or more) engine entries.

   A format entry contains:

   - id: key
   - longname: long description of file type (used in Windows file dialogs)
   - name: one-word description of file type (used in loading error
     messages)
   - extensions: list of file suffixes
   - docicon: Windows document icon filename
   - identify: function which looks at the first 16 bytes of the file and
     returns whether that file matches this format
   - engines: list of engines

   An engine entry contains:
   
   - id: key
   - name: engine name (used in page titles)
   - html: HTML file used for the game page
   - load: function which takes the loading args, the loaded file (as an
     array), and an options object. The function must add any needed options
     to the options object, and then return the loaded file with any
     modifications needed for load_run().
   - get_signature: function which returns the signature of the loaded
     file (as a string).

   Note that the load() and get_signature() functions are only called in
   the game process. They may require modules which are not available in
   the main process.
 */

/* TODO: Switch to the new module format, where modules are provided as classes rather than window.Module.
   I think the engine will provide a getlibrary() call. Then this function can do:
   opts.Dialog = engine.getlibrary('Dialog');
   opts.GlkOte = engine.getlibrary('GlkOte');
   ...and so on.
   (Referring to window.GiLoad will remain valid.)
*/

function common_emglken_load(file, buf, opts) {
    var engine = new ( require(`./emglken/${file}.js`) )();
    const data = Uint8Array.from(buf);
    const vm = opts.vm = window.engine = engine;
    opts.Dialog = window.Dialog;
    opts.Glk = opts.io = {
        fatal_error: window.GlkOte.fatal_error,
        init(opts) {
            // Call prepare here because GiLoad will send extracted Glulx files rather than the whole blorb
            vm.prepare(data, opts);
            // start will call GlkOte later on
            vm.start(opts);
        },
    };
    opts.GlkOte = window.GlkOte;
    if (file === 'git' || file === 'glulxe') {
        opts.blorb_gamechunk_type = 'GLUL';
    }
    return data;
}

const formatlist = [

    {
        id: 'blorb',
        longname: 'Blorbed Game File',
        extensions: ['blorb', 'blb'],
        /* No engine; this exists solely to supply file suffixes for the
           open-game dialog. */
    },

    {
        id: 'glulx',
        longname: 'Glulx Game File',
        name: 'Glulx',
        extensions: ['ulx', 'gblorb', 'glb'],
        docicon: 'docicon-glulx.ico',
        identify: buf => (buf[0] == 0x47 && buf[1] == 0x6C && buf[2] == 0x75 && buf[3] == 0x6C),
        engines: [
            {
                id: 'quixe',
                name: 'Quixe',
                html: 'play.html',
                load: (arg, buf, opts) => {
                    opts.vm = Quixe;
                    /* Further Glulx options are set up by gi_load.js. */

                    /* Convert to a generic Array of byte values. */
                    var arr = new Array(buf.length);
                    for (var ix=0; ix<buf.length; ix++)
                        arr[ix] = buf[ix];
                    return arr;
                },
                get_signature: () => Quixe.get_signature(),
            },
            {
                id: 'git',
                name: 'Git',
                html: 'emglkenplay.html',
                load: (arg, buf, opts) => common_emglken_load('git', buf, opts),
                //get_signature: () => window.engine.get_signature(),
            },
            {
                id: 'glulxe',
                name: 'Glulxe',
                html: 'emglkenplay.html',
                load: (arg, buf, opts) => common_emglken_load('glulxe', buf, opts),
                //get_signature: () => window.engine.get_signature(),
            },
            /*{
                id: 'glulxe-profiler',
                name: 'Glulxe (Profiler)',
                html: 'emglkenplay.html',
                load: (arg, buf, opts) => {
                    var engine = new ( require('./emglken/glulxe-profiler.js') )();
                    opts.vm = window.engine = engine;
                    opts.Glk = window.Glk;
                    opts.GiDispa = window.GiDispa;
                    opts.blorb_gamechunk_type = 'GLUL';
                    return Uint8Array.from(buf);
                },
                get_signature: () => window.engine.get_signature(),
            },*/
        ],
    },

    {
        id: 'zcode',
        longname: 'Z-Code Game File',
        name: 'Z-Code',
        extensions: ['z3', 'z4', 'z5', 'z8', 'zblorb', 'zlb'],
        docicon: 'docicon-zcode.ico',
        identify: buf => (buf[0] >= 3 && buf[0] <= 8),
        engines: [
            {
                id: 'zvm',
                name: 'ZVM',
                html: 'zplay.html',
                load: (arg, buf, opts) => {
                    /* TODO: switch to module format. See comment on common_emglken_load() above. */
                    opts.blorb_gamechunk_type = 'ZCOD';
                    opts.vm = window.engine = new window.ZVM();
                    opts.vm.init = opts.vm.prepare;
                    opts.Glk = window.Glk;
                    opts.Dialog = window.Dialog;
                    return Uint8Array.from(buf);
                },
                /* ### this doesn't work, because the engine does not
                   set its signature until some time after load_run is
                   called. */
                get_signature: () => window.engine.get_signature(),
            },
        ],
    },

    {
        id: 'hugo',
        longname: 'Hugo Game File',
        name: 'Hugo',
        extensions: [ 'hex' ],
        docicon: 'docicon-hugo.ico',
        engines: [
            {
                id: 'hugo',
                name: 'Hugo',
                html: 'emglkenplay.html',
                load: (arg, buf, opts) => common_emglken_load('hugo', buf, opts),
                //get_signature: () => window.engine.get_signature(),
            },
        ],
    },

    {
        id: 'ink-json',
        longname: 'Ink JSON File',
        name: 'Ink',
        extensions: [ 'json' ],
        docicon: 'docicon-json.ico',
        identify: buf => {
            /* Ink is a text (JSON) format, which is hard to check. We skip
               whitespace and non-ASCII characters and look for '{"ink'. */
            var checkascii = [ 0x7B, 0x22, 0x69, 0x6E, 0x6B ];
            var pos = 0;
            for (var ix=0; ix<buf.length; ix++) {
                var ch = buf[ix];
                if (!(ch > 32 && ch < 127))
                    continue;
                if (ch != checkascii[pos]) 
                    break;
                pos++;
                if (pos >= checkascii.length)
                    return true;
            }
        },
        engines: [
            {
                id: 'inkjs',
                name: 'InkJS',
                html: 'inkplay.html',
                load: (arg, buf, opts) => {
                    /* Does not use gi_load.js, so no additional options needed */
                    /* Pass the Buffer directly to the load_run function. */
                    return buf;
                },
                get_signature: () => GiLoad.get_game_signature(),
            },
        ],
    },

    {
        id: 'tads',
        longname: 'TADS Game File',
        name: 'TADS',
        extensions: [ 'gam', 't3' ],
        docicon: 'docicon-tads.ico',
        engines: [
            {
                id: 'tads',
                name: 'TADS',
                html: 'emglkenplay.html',
                load: (arg, buf, opts) => common_emglken_load('tads', buf, opts),
                //get_signature: () => window.engine.get_signature(),
            },
        ],
    },

];

/* Create the maps. */
const formatmap = {};
const enginemap = {};

for (let i = 0; i < formatlist.length; i++) {
    var entry = formatlist[i];
    formatmap[entry.id] = entry;
    if (entry.engines) {
        for (let j = 0; j < entry.engines.length; j++) {
            var engine = entry.engines[j];
            engine.format = entry.id;
            enginemap[engine.id] = engine;
        }
    }
}

exports.formatlist = formatlist;
exports.formatmap = formatmap;
exports.enginemap = enginemap;
