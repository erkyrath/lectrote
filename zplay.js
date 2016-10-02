'use strict';

var all_options = {
  container: '#parchment',
  lib_path: 'parchment/',
  lock_story: true,
  lock_option: true,
  page_title: false
};

/* Short string which will (hopefully) be unique per game. We don't need
   this until autosave exists, so we just define a dummy value. */
var signature = 'zcode_dummy';

/* Launch the game. The buf argument must be a Node Buffer.
 */
function load_run(optobj, buf)
{
    if (!optobj)
        optobj = window.game_options;
    if (optobj)
        jQuery.extend(all_options, optobj);

    all_options.default_story = [ buf ];

    /* Now we perform a simplified version of the code from Parchment's
       src/parchment/outro.js. (The intro.js stuff is baked into
       zplay.html.) */

    parchment.options = all_options;

    /* Construct the library object. */
    var library = new parchment.lib.Library();
    /* Replace Parchment's fromRunner handler. */
    library.fromRunner = custom_from_runner;

    parchment.library = library;
    library.load();
}

function get_game_signature()
{
    return signature;
}

function get_metadata(key)
{
    return null;
}

/* Customization of the library.fromRunner() function defined in
   src/parchment/library.js. This handles the save and restore events,
   implementing them in terms of electrofs.js.
*/
function custom_from_runner(runner, event)
{
    var code = event.code;
    
    if (code == 'save') {
        Dialog.open(true, 'save', GiLoad.get_game_signature(), function(fref) {
                if (!fref) {
                    /* Save dialog cancelled. Mark event as having failed? */
                }
                else {
                    const filemode_Write = 0x01;
                    var fl = Dialog.file_fopen(filemode_Write, fref);
                    if (!fl) {
                        /* Could not open file. Mark event as failed? */
                    }
                    else {
                        fl.fwrite(Buffer.from(event.data));
                        fl.fclose();
                    }
                }
                /*### How to mark event as failed? */
                runner.fromParchment( event );
            });
        return;
    }
    
    if (code == 'restore') {
        Dialog.open(false, 'save', GiLoad.get_game_signature(), function(fref) {
                if (!fref) {
                    /* Load dialog cancelled. Mark event as failed. */
                }
                else {
                    const filemode_Read = 0x02;
                    var fl = Dialog.file_fopen(filemode_Read, fref);
                    if (!fl) {
                        /* Could not open file. Mark event as failed. */
                    }
                    else {
                        var res = [];
                        var buf = new Buffer(256);
                        while (true) {
                            var len = fl.fread(buf);
                            if (!len)
                                break;
                            for (var ix=0; ix<len; ix++)
                                res.push(buf[ix]);
                        }
                        fl.fclose();
                        event.data = res;
                    }
                }
                /* The restore event will be considered to have failed
                   if event.data is not set. */
                runner.fromParchment( event );
            });
        return;
    }
    
    runner.fromParchment( event );
}

window.GiLoad = {
    load_run: load_run,
    get_metadata: get_metadata,
    get_game_signature: get_game_signature,
};
