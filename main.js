'use strict';
const electron = require('electron');
const app = electron.app;
const fs = require('fs');
const path_mod = require('path');

const formats = require('./formats.js');

var package_json = {}; /* parsed form of our package.json file */
var main_extension = {}; /* extra code for bound games */

var isbound = false; /* true if we're a single-game app */
var bound_game_path = null;
var gamewins = {}; /* maps window ID to a game structure */
var aboutwin = null; /* the splash/about window, if active */
var cardwin = null; /* the postcard window, if active */
var prefswin = null; /* the preferences window, if active */
var gamedialog = false; /* track whether the game-open dialog is visible */

var prefs = {
    gamewin_width: 600,
    gamewin_height: 800,
    gamewin_marginlevel: 1,
    gamewin_colortheme: 'light',
    gamewin_font: 'lora',
    gamewin_customfont: null,
    gamewin_zoomlevel: 0
};
var prefspath = path_mod.join(app.getPath('userData'), 'lectrote-prefs.json');
var prefstimer = null;
var prefswriting = false;

var app_ready = false; /* true once the ready event occurs */
var app_quitting = false; /* true once the will-quit event occurs */
var launch_paths = []; /* game files passed in before app_ready */
var aboutwin_initial = false; /* true if the aboutwin was auto-opened */
var window_icon = null; /* icon to apply to all windows (only used on Linux) */

var search_string = ''; /* recent text search in a game window */

/* Return a list of all open game objects. */
function game_list()
{
    var ls = [];
    for (var id in gamewins) {
        var game = gamewins[id];
        ls.push(game);
    }
    return ls;
}

/* Return the game object for a given window. */
function game_for_window(win)
{
    if (!win)
        return undefined;
    return gamewins[win.id];
}

/* Return the game object for a given webcontents. */
function game_for_webcontents(webcontents)
{
    if (!webcontents)
        return undefined;
    for (var id in gamewins) {
        var game = gamewins[id];
        if (game.win && game.win.webContents === webcontents)
            return game;
    }    
    return undefined;
}

function construct_recent_game_menu()
{
    var res = [];

    if (isbound)
        return res;

    /* This requires a utility function because of Javascript's lousy 
       closures. */
    var add = function(path) {
        var opts = {
            label: path_mod.basename(path),
            click: function() {
                launch_game(path);
            }
        };
        res.push(opts);
    };
    
    var recents = prefs.recent_games;
    if (recents && recents.length) {
        for (var ix=0; ix<recents.length; ix++) {
            add(recents[ix]);
        }
    }

    return res;
}

/* Add a game to the recently-opened list. Note that this does *not* affect
   the "File / Open Recent" submenu! This is an Electron limitation:
       https://github.com/atom/electron/issues/527
   The submenu will be filled in next time the app launches.
*/
function add_recent_game(path)
{
    if (isbound) {
        /* We're in bound-game mode and shouldn't be talking about
           open lists at all. */
        return;
    }

    /* The system recent list is easy -- it handles its own ordering
       and uniqueness. This list shows up on the Dock icon on MacOS. */
    app.addRecentDocument(path);

    var recents = prefs.recent_games;
    if (recents === undefined) {
        recents = [];
        prefs.recent_games = recents;
    }

    /* Remove any duplicate so we can move this game to the top. */
    for (var ix=0; ix<recents.length; ix++) {
        if (recents[ix] == path) {
            recents.splice(ix, 1);
            break;
        }
    }

    /* Push onto beginning. */
    recents.unshift(path);

    /* Keep no more than 8. */
    if (recents.length > 8)
        recents.length = 8;

    note_prefs_dirty();
}

/* If you create two windows in a row, the second should be offset. But
   if you create a window, close it, and create a new window, the second
   should not be offset. Sorry, it's messy to describe and messy to
   implement.
   The effect is to pick the lowest offset value not used by any window.
*/
function pick_window_offset()
{
    /* Create a list of all offsets currently in use. */
    var offsets = [];
    for (var id in gamewins) {
        var offset = gamewins[id].offset;
        if (offset !== undefined)
            offsets[offset] = true;
    }

    for (var ix=0; true; ix++) {
        if (!offsets[ix])
            return ix;
    }
}

/* If a game window is moved, we no longer care about offsets, because we're
   now offsetting from a new position. Clear our existing offset info.
*/
function clear_window_offsets()
{
    for (var id in gamewins) {
        delete gamewins[id].offset;
    }
}

/* Called only at app startup. */
function load_prefs()
{
    try {
        var prefsstr = fs.readFileSync(prefspath, { encoding:'utf8' });
        var obj = JSON.parse(prefsstr);
        for (var key in obj) {
            prefs[key] = obj[key];
        }
    }
    catch (ex) {
        /* console.error('load_prefs: unable to load preferences: %s: %s', prefspath, ex); */
    }
    
    /* Check to make sure the recent files still exist. */
    var recents = prefs.recent_games;
    if (recents && recents.length) {
        var ls = [];
        for (var ix=0; ix<recents.length; ix++) {
            try {
                fs.accessSync(recents[ix], fs.R_OK);
                ls.push(recents[ix]);
            }
            catch (ex) {}
        }
        if (ls.length < recents.length) {
            prefs.recent_games = ls;
            note_prefs_dirty();
        }
    }
}

/* We can't rely on the web-frame algorithm for this, because we have
   to include it when creating the browser window. So we have our
   own bit of code: basically 10% larger/smaller per unit.
*/
function zoom_factor_for_level(val)
{
    if (!val)
        return 1;
    return Math.exp(val * 0.09531017980432493);
}

/* Send the current zoom factor to all game windows.
*/
function set_zoom_factor_all(val)
{
    for (var id in gamewins) {
        var game = gamewins[id];
        invoke_app_hook(game.win, 'set_zoom_factor', val);
    }
    if (main_extension.set_zoom_factor)
        main_extension.set_zoom_factor(val);
}

/* Set up a window-options object (for creating a BrowserWindow) to have
   a previously-set window position, if there is one.
*/
function window_position_prefs(winopts, key)
{
    var val;

    val = prefs[key+'_x'];
    if (val !== undefined)
        winopts.x = val;

    val = prefs[key+'_y'];
    if (val !== undefined)
        winopts.y = val;
}

/* Set up a window-options object (for creating a BrowserWindow) to have
   a previously-set window size, if there is one. If not, use the
   given defaults.
*/
function window_size_prefs(winopts, key, defwidth, defheight)
{
    var val;

    val = prefs[key+'_width'];
    if (val === undefined)
        val = defwidth;
    winopts.width = val;

    val = prefs[key+'_height'];
    if (val === undefined)
        val = defheight;
    winopts.height = val;
}

/* Create a function that sets the preferences for a window position.
   This can be set as the window's 'move' callback.
*/
function window_position_prefs_handler(key, win)
{
    return function() {
        prefs[key+'_x'] = win.getPosition()[0];
        prefs[key+'_y'] = win.getPosition()[1];
        note_prefs_dirty();
    }
}

/* Create a function that sets the preferences for a window size.
   This can be set as the window's 'resize' callback.
*/
function window_size_prefs_handler(key, win)
{
    return function() {
        prefs[key+'_width'] = win.getSize()[0];
        prefs[key+'_height'] = win.getSize()[1];
        note_prefs_dirty();
    }
}

/* Called whenever we update the prefs object. This waits five seconds 
   (to consolidate writes) and then launches an async file-write.
*/
function note_prefs_dirty()
{
    /* If a timer is in flight, we're covered. */
    if (prefstimer !== null)
        return;
    prefstimer = setTimeout(handle_write_prefs, 5000);
}

/* Callback for prefs-dirty timer. */
function handle_write_prefs()
{
    prefstimer = null;
    /* If prefswriting is true, a writeFile call is in flight. Yes, this
       is an annoying corner case. We have new data to write but we have
       to wait for the writeFile to finish. We do this by punting for
       another five seconds! */
    if (prefswriting) {
        note_prefs_dirty();
        return;
    }

    prefswriting = true;
    var prefsstr = JSON.stringify(prefs);
    fs.writeFile(prefspath, prefsstr, { encoding:'utf8' }, function(err) {
            prefswriting = false;
        });
}

/* Called when the app is shutting down. Write out the prefs if they're dirty.
*/
function write_prefs_now()
{
    if (prefstimer !== null) {
        clearTimeout(prefstimer);
        prefstimer = null;
        var prefsstr = JSON.stringify(prefs);
        fs.writeFileSync(prefspath, prefsstr, { encoding:'utf8' });
    }
}

/* Call one of the functions in apphooks.js (in the game renderer process).
   The argument is passed as a JSON string.
*/
function invoke_app_hook(win, func, arg)
{
    win.webContents.send(func, arg);
}

/* Given a pathname, figure out what kind of game it is. This relies on
   the format list in formats.js. It returns a format object from that
   file.

   Returns null if the game type is not recognized. Throws an exception
   if the file is unreadable.
*/
function game_file_discriminate(path)
{
    var fd = fs.openSync(path, 'r');
    var buf = new Buffer(16);
    var len = fs.readSync(fd, buf, 0, 16, 0);
    fs.closeSync(fd);

    /* Try Blorbs first. */
    if (buf[0] == 0x46 && buf[1] == 0x4F && buf[2] == 0x52 && buf[3] == 0x4D
        && buf[8] == 0x49 && buf[9] == 0x46 && buf[10] == 0x52 && buf[11] == 0x53) {
        /* Blorb file */
        var gametype = parse_blorb(path);
        if (gametype == 'GLUL')
            return formats.formatmap.glulx;
        else if (gametype == 'ZCOD')
            return formats.formatmap.zcode;
    }

    /* Try the format identify functions. */
    for (let i = 0; i < formats.formatlist.length; i++) {
        var format = formats.formatlist[i];
        if (format.identify && format.identify(buf)) {
            return format;
        }
    }

    /* Fall back to checking file extensions. */
    var pathsuffix = path_mod.extname(path).toLowerCase();
    if (pathsuffix.startsWith('.'))
        pathsuffix = pathsuffix.slice(1);

    for (let i = 0; i < formats.formatlist.length; i++) {
        var format = formats.formatlist[i];
        if ((!format.extensions) || (!format.engines))
            continue;
        for (var jx=0; jx<format.extensions.length; jx++) {
            if (format.extensions[jx] == pathsuffix)
                return format;
        }
    }

    return null;
}

/* Given the pathname of a Blorb file, look through it for a Z-code or
   Glulx chunk. Return 'ZCOD' or 'GLUL', or null if neither is found.
*/
function parse_blorb(path)
{
    var res = null;

    var fd = fs.openSync(path, 'r');
    var buf = new Buffer(16);

    var len = fs.readSync(fd, buf, 0, 16, 0);
    if (!(buf[0] == 0x46 && buf[1] == 0x4F && buf[2] == 0x52 && buf[3] == 0x4D
            && buf[8] == 0x49 && buf[9] == 0x46 && buf[10] == 0x52 && buf[11] == 0x53)) {
        /* not Blorb at all. */
        fs.closeSync(fd);
        return null;
    }

    /* Search through the chunks for a Zcode/Glulx chunk. */
    len = fs.readSync(fd, buf, 0, 12, 0);

    var filelen = buf.readUInt32BE(4) + 8;
    var pos = 12;

    while (pos < filelen) {
        len = fs.readSync(fd, buf, 0, 8, pos);
        pos += 8;
        var chunktype = buf.toString('utf8', 0, 4);
        var chunklen = buf.readUInt32BE(4);
        if (chunktype == 'ZCOD' || chunktype == 'GLUL') {
            res = chunktype;
            break;
        }
        pos += chunklen;
        if (pos & 1)
            pos++;
    }

    fs.closeSync(fd);
    return res;
}

/* Bring up the select-a-game dialog. 
*/
function select_load_game()
{
    if (isbound) {
        /* We're in bound-game mode and shouldn't be opening any other
           games. */
        return;
    }

    if (gamedialog) {
        /* The dialog is already up. I'd focus it if I had a way to do that,
           but I don't. */
        return;
    }

    var filters = [];
    for (var ix=0; ix<formats.formatlist.length; ix++) {
        var format = formats.formatlist[ix];
        filters.push({ name:format.longname, extensions:format.extensions });
    }
    
    if (process.platform !== 'darwin') {
        /* On Win/Linux, the file dialog can only show one filter-row at a
           time. So we construct one that has a union of the types, and
           push it onto the beginning of the filters list. */
        var arr = [];
        for (var ix=0; ix<filters.length; ix++)
            arr = arr.concat(filters[ix].extensions);
        filters.unshift({ name: 'All IF Files', extensions: arr });
    }

    var opts = {
        title: 'Select an IF game file',
        properties: ['openFile'],
        filters: filters,
    };

    gamedialog = true;
    electron.dialog.showOpenDialog(null, opts, function(ls) {
        gamedialog = false;
        if (!ls || !ls.length)
            return;
        launch_game(ls[0]);
    });
}

/* Open a game window for a given game file.
*/
function launch_game(path)
{
    var kind = null;

    /* Figure out what kind of game file this is, so we know which play.html
       file to load. */
    try {
        kind = game_file_discriminate(path);
    }
    catch (ex) {
        electron.dialog.showErrorBox('The game file could not be read.', ''+ex);
        return;
    }

    if (!kind) {
        electron.dialog.showErrorBox('Could not recognize game file.', path);
        return;
    }

    if (aboutwin && aboutwin_initial) {
        /* Dispose of the (temporary) splash window. This needs a time delay
           for some annoying internal reason. */
        setTimeout( function() { if (aboutwin) aboutwin.close(); }, 50);
    }

    add_recent_game(path);

    var win = null;
    var game = {
        path: path,
        basehtml: kind.engines[0].html,
        engineid: kind.engines[0].id,
        title: null,
        signature: null
    };

    var winopts = {
        title: require('electron').app.getName(),
        width: prefs.gamewin_width, height: prefs.gamewin_height,
        minWidth: 400, minHeight: 400,
        webPreferences: {
            zoomFactor: zoom_factor_for_level(prefs.gamewin_zoomlevel)
        }
    };
    /* The webPreferences.zoomFactor doesn't seem to take effect in
       Electron 1.6.11, so we'll send it over via IPC later. */

    if (window_icon)
        winopts.icon = window_icon;
    if (process.platform == 'win32' && !isbound) {
        /* On Windows, set the window icon to an appropriate document icon.
           (But not in the bound version -- we leave that as the
           game's app icon.) */
        winopts.icon = path_mod.join(__dirname, kind.docicon);
    }

    /* BUG: The offsetting only applies if you have a window location
       preference. For a brand-new user this will not be true. */
    var offset = pick_window_offset();
    if (prefs.gamewin_x !== undefined)
        winopts.x = prefs.gamewin_x + 20 * offset;
    if (prefs.gamewin_y !== undefined)
        winopts.y = prefs.gamewin_y + 20 * offset;

    win = new electron.BrowserWindow(winopts);
    if (!win)
        return;

    game.win = win;
    game.id = win.id;
    game.offset = offset;
    gamewins[game.id] = game;

    if (process.platform == 'darwin' && !isbound) {
        /* On Mac, set the window document link to the game file URL.
           (But not in the bound version.) */
        win.setRepresentedFilename(game.path);
    }

    /* Game window callbacks */

    win.on('closed', function() {
        delete gamewins[game.id];
        game = null;
        win = null;
        /* In the bound version, closing the game window means closing
           the app. */
        if (isbound)
            app.quit();
    });

    win.webContents.on('dom-ready', function(ev) {
        var game = game_for_webcontents(ev.sender);
        if (!game)
            return;
        invoke_app_hook(win, 'set_zoom_factor', winopts.webPreferences.zoomFactor);
        invoke_app_hook(win, 'set_margin_level', prefs.gamewin_marginlevel);
        invoke_app_hook(win, 'set_color_theme', prefs.gamewin_colortheme);
        invoke_app_hook(win, 'set_font', { font:prefs.gamewin_font, customfont:prefs.gamewin_customfont });
        if (game.suppress_autorestore) {
            invoke_app_hook(win, 'set_clear_autosave', true);
            game.suppress_autorestore = false;
        }
        invoke_app_hook(win, 'load_named_game', { path: game.path, format: kind.id, engine: game.engineid } );
    });

    win.webContents.on('found-in-page', function(ev, res) {
        var game = game_for_webcontents(ev.sender);
        if (!game)
            return;
        if (game.foundinpage && game.foundinpage.requestId == res.requestId) {
            /* merge fields into game.foundinpage */
            Object.assign(game.foundinpage, res);
        }
        else {
            game.foundinpage = res;
        }

        //console.log('### found-in-page', game.foundinpage);

        if (game.foundinpage.finalUpdate && game.foundinpage.activeMatchOrdinal == game.foundinpage.matches && game.foundinpage.matches > 1) {
            /* The last match, by definition, is in the one in the search
               widget. If we've landed on it, search *again* to jump around
               to the beginning (or back, as the case may be). */
            var webcontents = game.win.webContents;
            var forward = game.searchforward;
            webcontents.findInPage(game.last_search, { findNext:true, forward:forward });
        }
    });

    win.on('resize', window_size_prefs_handler('gamewin', win));
    win.on('move', function() {
        prefs.gamewin_x = win.getPosition()[0];
        prefs.gamewin_y = win.getPosition()[1];
        note_prefs_dirty();

        /* We're starting with a new position, so erase the history of
           what windows go here. */
        clear_window_offsets();
        var game = game_for_window(win);
        if (game)
            game.offset = 0;
    });

    /* Load the game UI and go. */
    win.loadURL('file://' + __dirname + '/' + game.basehtml);
}

/* Reset the game by reloading its HTML document.
*/
function reset_game(game)
{
    if (!game.win)
        return;

    var winopts = {
        type: 'question',
        message: 'Are you sure you want to reset the game to the beginning? This will discard all your progress since your last SAVE command.',
        buttons: ['Reset', 'Cancel'],
        cancelId: 0
    };
    if (window_icon)
        winopts.icon = window_icon;

    /* We use a synchronous showMessageBox call, which blocks (is modal for)
       the entire app. The async call would only block the game window, but
       that causes weird results (e.g., cmd-Q fails to shut down the blocked
       game window). */
    var res = electron.dialog.showMessageBox(game.win, winopts);
    if (res == winopts.cancelId) {
        var win = game.win;
        /* Set a flag to inhibit autorestore (but not autosave). This
           will be cleared when the page finishes loading. */
        game.suppress_autorestore = true;
        /* Load the game UI and go. */
        win.loadURL('file://' + __dirname + '/' + game.basehtml);
    }
}

/* Open the "About Lectrote" window. (It must not already exist.)
*/
function open_about_window()
{
    var winopts = { 
        width: 600, height: 450,
        useContentSize: true,
        resizable: false
    };
    if (main_extension.about_window_size) {
        if (main_extension.about_window_size.width)
            winopts.width = main_extension.about_window_size.width;
        if (main_extension.about_window_size.height)
            winopts.height = main_extension.about_window_size.height;
    }
    window_position_prefs(winopts, 'aboutwin');
    if (window_icon)
        winopts.icon = window_icon;

    aboutwin = new electron.BrowserWindow(winopts);

    if (process.platform != 'darwin') {
        var template = construct_menu_template('about');
        var menu = electron.Menu.buildFromTemplate(template);
        aboutwin.setMenu(menu);
    }
    
    aboutwin.on('closed', function() {
            aboutwin = null;
        });
    aboutwin.on('move', window_position_prefs_handler('aboutwin', aboutwin));
    aboutwin.webContents.on('will-navigate', function(ev, url) {
            require('electron').shell.openExternal(url);
            ev.preventDefault();
        });

    aboutwin.webContents.on('dom-ready', function() {
            var ls = construct_recent_game_menu();
            aboutwin.webContents.send('recent-count', ls.length);
        });

    aboutwin.loadURL('file://' + __dirname + '/about.html');
}

/* Open the Preferences window. (It must not already exist.)
*/
function open_prefs_window()
{
    var winopts = { 
        width: 600, height: 500,
        useContentSize: true,
        resizable: false
    };
    window_position_prefs(winopts, 'prefswin');
    if (window_icon)
        winopts.icon = window_icon;

    prefswin = new electron.BrowserWindow(winopts);

    if (process.platform != 'darwin') {
        var template = construct_menu_template('prefs');
        var menu = electron.Menu.buildFromTemplate(template);
        prefswin.setMenu(menu);
    }
    
    prefswin.on('closed', function() {
            prefswin = null;
        });
    prefswin.on('move', window_position_prefs_handler('prefswin', prefswin));

    prefswin.webContents.on('dom-ready', function() {
            prefswin.webContents.send('current-prefs', prefs);
        });

    prefswin.loadURL('file://' + __dirname + '/prefs.html');
}

/* Open the IF reference card window. (It must not already exist.)
*/
function open_card_window()
{
    var winopts = { 
        width: 810, height: 600,
        useContentSize: true,
        javascript: false
    };
    window_position_prefs(winopts, 'cardwin');
    if (window_icon)
        winopts.icon = window_icon;

    cardwin = new electron.BrowserWindow(winopts);

    if (process.platform != 'darwin') {
        var template = construct_menu_template('card');
        var menu = electron.Menu.buildFromTemplate(template);
        cardwin.setMenu(menu);
    }
    
    cardwin.on('closed', function() {
            cardwin = null;
        });
    cardwin.on('move', window_position_prefs_handler('cardwin', cardwin));
    cardwin.webContents.on('will-navigate', function(ev, url) {
            require('electron').shell.openExternal(url);
            ev.preventDefault();
        });

    cardwin.loadURL('file://' + __dirname + '/if-card.html');
}

function find_in_template(template, key)
{
    for (var ix=0; ix<template.length; ix++) {
        var stanza = template[ix];
        if (stanza.id == key)
            return stanza;
    }
    return null;
};

/* A simplistic copy-file utility. This is asynchronous. */
function copy_file(srcpath, destpath, callback)
{
    var rd = fs.createReadStream(srcpath);
    rd.on('error', callback);
    var wr = fs.createWriteStream(destpath);
    wr.on('error', callback);
    wr.on('close', function(ex) {
            callback(null);
        });
    rd.pipe(wr);
}

function export_game_file(path)
{
    var suffix = path_mod.extname(path);
    if (suffix.startsWith('.'))
        suffix = suffix.slice(1);
    if (!suffix)
        suffix = 'gblorb';
    /*### defaulting to gblorb isn't right for ink files, but really
      the path will always have a suffix. */

    var filename = path_mod.basename(path);

    var opts = {
        title: 'Export a portable game file',
        defaultPath: filename,
        filters: [ { name: 'Game File', extensions: [suffix] } ]
    };

    electron.dialog.showSaveDialog(opts, function(destpath) {
        if (!destpath)
            return;
        copy_file(path, destpath, function(ex) {
            if (ex)
                electron.dialog.showErrorBox('Export failed', ''+ex);
        });
    });
}

function get_export_game_path()
{
    var path = bound_game_path;
    if (main_extension.export_game_path)
        path = main_extension.export_game_path();
    if (!path)
        return null;
    return path;
}

function search_text(game, text)
{
    if (!text)
        return;

    search_string = text;
    game.last_search = text;

    var webcontents = game.win.webContents;
    webcontents.findInPage(text, {});
}

function search_again(game, forward)
{
    var text = game.last_search;
    if (!text)
        return;

    /* If the search widget isn't open, open it. */
    invoke_app_hook(game.win, 'search_request', { inittext:text });

    var webcontents = game.win.webContents;
    game.searchforward = forward;
    webcontents.findInPage(text, { findNext:true, forward:forward });
}

function search_cancel(game)
{
    var webcontents = game.win.webContents;
    webcontents.stopFindInPage('keepSelection');
}

function index_in_template(template, key)
{
    for (var ix=0; ix<template.length; ix++) {
        var stanza = template[ix];
        if (stanza.id == key)
            return ix;
    }
    return -1;
};

function construct_menu_template(special)
{
    var name = require('electron').app.getName();

    var template = [
    {
        label: 'File',
        id: 'menu_file',
        submenu: [
        {
            label: 'Open Game...',
            id: 'open_game',
            accelerator: 'CmdOrCtrl+O',
            click: function() {
                select_load_game();
            }
        },
        {
            label: 'Open Recent',
            id: 'open_recent',
            type: 'submenu',
            submenu: construct_recent_game_menu()
        },
        { type: 'separator' },
        {
            label: 'Reset Game...',
            id: 'reset_game',
            accelerator: 'CmdOrCtrl+R',
            enabled: (!special),
            click: function(item, win) {
                var game = game_for_window(win);
                if (!game)
                    return;
                reset_game(game);
            }
        },
        {
            label: 'Export Portable Game File...',
            id: 'export_game',
            visible: (isbound && get_export_game_path() != null),
            click: function(item, win) {
                export_game_file(get_export_game_path());
            }
        },
        { type: 'separator' },
        {
            label: 'Close Window',
            id: 'close_window',
            accelerator: 'CmdOrCtrl+W',
            role: 'close'
        }
        ]
    },
    {
        label: 'Edit',
        id: 'menu_edit',
        submenu: [
        {
            label: 'Cut',
            accelerator: 'CmdOrCtrl+X',
            enabled: (!special),
            role: 'cut'
        },
        {
            label: 'Copy',
            accelerator: 'CmdOrCtrl+C',
            role: 'copy'
        },
        {
            label: 'Paste',
            accelerator: 'CmdOrCtrl+V',
            enabled: (!special),
            role: 'paste'
        },
        {
            label: 'Select All',
            accelerator: 'CmdOrCtrl+A',
            role: 'selectall'
        },
        { type: 'separator' },
        {
            label: 'Find...',
            id: 'find',
            accelerator: 'CmdOrCtrl+F',
            enabled: !special,
            click: function(item, win) {
                var game = game_for_window(win);
                if (!game)
                    return;
                invoke_app_hook(win, 'search_request', { inittext:search_string, focus:true });
            }
        },
        {
            label: 'Find Next',
            id: 'find_next',
            accelerator: 'CmdOrCtrl+G',
            enabled: !special,
            click: function(item, win) {
                var game = game_for_window(win);
                if (!game)
                    return;
                search_again(game, true);
            }
        },
        {
            label: 'Find Previous',
            id: 'find_prev',
            accelerator: 'CmdOrCtrl+Shift+G',
            enabled: !special,
            click: function(item, win) {
                var game = game_for_window(win);
                if (!game)
                    return;
                search_again(game, false);
            }
        },
        { type: 'separator' },
        {
            label: 'Preferences',
            id: 'preferences',
            accelerator: 'CmdOrCtrl+,',
            enabled: (special != 'prefs'),
            click: function() {
                if (!prefswin)
                    open_prefs_window();
                else
                    prefswin.show();
            }
        }
        ]
    },
    {
        label: 'View',
        id: 'menu_view',
        submenu: [
        {
            label: 'Zoom In',
            accelerator: 'CmdOrCtrl+=',
            click: function(item, win) {
                prefs.gamewin_zoomlevel += 1;
                if (prefs.gamewin_zoomlevel > 6)
                    prefs.gamewin_zoomlevel = 6;
                note_prefs_dirty();
                var val = zoom_factor_for_level(prefs.gamewin_zoomlevel);
                set_zoom_factor_all(val);
                if (prefswin)
                    prefswin.webContents.send('set-zoom-level', prefs.gamewin_zoomlevel);
            }
        },
        {
            label: 'Zoom Normal',
            accelerator: 'CmdOrCtrl+0',
            click: function(item, win) {
                prefs.gamewin_zoomlevel = 0;
                note_prefs_dirty();
                var val = zoom_factor_for_level(prefs.gamewin_zoomlevel);
                set_zoom_factor_all(val);
                if (prefswin)
                    prefswin.webContents.send('set-zoom-level', prefs.gamewin_zoomlevel);
            }
        },
        {
            label: 'Zoom Out',
            accelerator: 'CmdOrCtrl+-',
            click: function(item, win) {
                prefs.gamewin_zoomlevel -= 1;
                if (prefs.gamewin_zoomlevel < -6)
                    prefs.gamewin_zoomlevel = -6;
                note_prefs_dirty();
                var val = zoom_factor_for_level(prefs.gamewin_zoomlevel);
                set_zoom_factor_all(val);
                if (prefswin)
                    prefswin.webContents.send('set-zoom-level', prefs.gamewin_zoomlevel);
            }
        }
        ]
    },
    {
        label: 'Window',
        id: 'menu_window',
        role: 'window',
        submenu: [
        {
            label: 'Minimize',
            id: 'minimize_window',
            role: 'minimize'
        },
        {
            label: 'Full Screen',
            id: 'fullscreen_window',
            role: 'togglefullscreen'
        },
        {
            label: 'Toggle Developer Tools',
            id: 'toggle_devel_tools',
            accelerator: (function() {
                if (process.platform == 'darwin')
                    return 'Alt+Command+I';
                else
                    return 'Ctrl+Shift+I';
            })(),
            click: function(item, focusedWindow) {
                if (focusedWindow)
                    focusedWindow.toggleDevTools();
            }
        }
        ]
    },
    {
        label: 'Help',
        id: 'menu_help',
        role: 'help',
        submenu: [
        {
            label: 'IF Reference Card',
            id: 'if_ref_card',
            enabled: (special != 'card'),
            click: function(item, win) {
                if (!cardwin)
                    open_card_window();
                else
                    cardwin.show();
            }
        }
        ]
    }
    ];

    if (isbound) {
        /* In bound-game mode, we knock the open options out of the
           File menu. */
        var stanza = find_in_template(template, 'menu_file');
        if (stanza) {
            var submenu = stanza.submenu;
            var pos = index_in_template(submenu, 'open_game');
            if (pos >= 0)
                submenu.splice(pos, 1);
            var pos = index_in_template(submenu, 'open_recent');
            if (pos >= 0)
                submenu.splice(pos, 1);
            if (submenu.length && submenu[0].type == 'separator')
                submenu.splice(0, 1);
        }
    }
    
    if (process.platform == 'darwin') {
        var stanza = find_in_template(template, 'menu_window');
        if (stanza) {
            stanza.submenu.push({ type: 'separator' });
        }

        template.unshift({
            label: name,
            submenu: [
            {
                label: 'About ' + name,
                id: 'about_app',
                enabled: (special != 'about'),
                click: function() {
                    if (!aboutwin)
                        open_about_window();
                    else
                        aboutwin.show();
                    aboutwin_initial = false;
                }
            },
            { type: 'separator' },
            {
                label: 'Services',
                role: 'services',
                submenu: []
            },
            { type: 'separator' },
            {
                label: 'Hide ' + name,
                accelerator: 'Command+H',
                role: 'hide'
            },
            {
                label: 'Hide Others',
                accelerator: 'Command+Shift+H',
                role: 'hideothers'
            },
            {
                label: 'Show All',
                role: 'unhide'
            },
            { type: 'separator' },
            {
                label: 'Quit',
                accelerator: 'Command+Q',
                click: function() { app.quit(); }
            },
            ]
        });
    }
    else {
        /* Windows and Linux... */

        var stanza = find_in_template(template, 'menu_help');
        if (stanza) {
            stanza.submenu.push({
                label: 'About ' + name,
                id: 'about_app',
                enabled: (special != 'about'),
                click: function(item, win) {
                    if (!aboutwin)
                        open_about_window();
                    else
                        aboutwin.show();
                    aboutwin_initial = false;
                }
            });
        }

        if (special) {
            /* Drop the View menu for special windows. */
            var pos = index_in_template(template, 'menu_view');
            if (pos >= 0) {
                template.splice(pos, 1);
            }
        }
    }

    if (main_extension.construct_menu_template)
        template = main_extension.construct_menu_template(template, special);
    
    return template;
}

/* --------------------------------------------------------------------
   Begin app setup.
 */

/* Ensure that only one Lectrote process exists at a time. */

var secondary = app.makeSingleInstance(function(argv, cwd) {
    /* This callback arrives when a second process tries to launch.
       Its arguments are sent here. */
    var count = 0;
    for (var ix=1; ix<argv.length; ix++) {
        var path = argv[ix];
        if (path_mod.basename(path) == 'main.js' || path_mod.basename(path) == '.')
            continue;
        if (process.platform == 'darwin' && path.startsWith('-psn'))
            continue;
        if (!app_ready)
            launch_paths.push(path);
        else
            launch_game(path);
        count++;
    }

    if (!count) {
        /* The app was launched with no game arguments. To show willing,
           we'll pop up the about window. */
        if (!aboutwin) {
            open_about_window();
            aboutwin_initial = true;
        }
        else {
            aboutwin.show();
        }
    }
});
if (secondary) {
    /* Another process already exists. Our arguments have been sent
       to it. */
    app.quit();
    return;
}

/* Set up handlers. */

/* Called when the last window is closed; we shut down.
*/
app.on('window-all-closed', function() {
    app.quit();
});

/* Called when the app is going to quit, either because the last window
   closed or the user hit cmd-Q. (This happens before windows close.)
*/
app.on('before-quit', function() {
    app_quitting = true;
});

/* Called when the app is quitting, either because the last window
   closed or the user hit cmd-Q. 
*/
app.on('will-quit', function() {
    write_prefs_now();
});

electron.ipcMain.on('select_load_game', function() {
    if (isbound)
        return;
    select_load_game();
});

electron.ipcMain.on('select_load_recent', function() {
    if (isbound)
        return;
    var template = construct_recent_game_menu();
    if (!template || !template.length)
        return;
    var menu = electron.Menu.buildFromTemplate(template);
    menu.popup(aboutwin);
});

electron.ipcMain.on('game_metadata', function(ev, arg) {
    var game = game_for_webcontents(ev.sender);
    if (game) {
        if (arg.title)
            game.title = arg.title;
        if (arg.signature)
            game.signature = arg.signature;
    }
});

electron.ipcMain.on('pref_font', function(ev, fontkey, customfont) {
    prefs.gamewin_font = fontkey;
    prefs.gamewin_customfont = customfont;
    note_prefs_dirty();
    for (var id in gamewins) {
        var game = gamewins[id];
        invoke_app_hook(game.win, 'set_font', { font:prefs.gamewin_font, customfont:prefs.gamewin_customfont });
    }
});

electron.ipcMain.on('pref_color_theme', function(ev, arg) {
    prefs.gamewin_colortheme = arg;
    note_prefs_dirty();
    for (var id in gamewins) {
        var game = gamewins[id];
        invoke_app_hook(game.win, 'set_color_theme', prefs.gamewin_colortheme);
    }
});

electron.ipcMain.on('pref_margin_level', function(ev, arg) {
    prefs.gamewin_marginlevel = arg;
    note_prefs_dirty();
    for (var id in gamewins) {
        var game = gamewins[id];
        invoke_app_hook(game.win, 'set_margin_level', prefs.gamewin_marginlevel);
    }
});

electron.ipcMain.on('pref_zoom_level', function(ev, arg) {
    prefs.gamewin_zoomlevel = arg;
    note_prefs_dirty();
    var val = zoom_factor_for_level(prefs.gamewin_zoomlevel);
    set_zoom_factor_all(val);
});

electron.ipcMain.on('search_done', function(ev, arg) {
    var game = game_for_webcontents(ev.sender);
    if (!game)
        return;
    search_cancel(game);
});

electron.ipcMain.on('search_text', function(ev, arg) {
    var game = game_for_webcontents(ev.sender);
    if (!game)
        return;
    search_text(game, arg);
});

electron.ipcMain.on('search_again', function(ev, arg) {
    var game = game_for_webcontents(ev.sender);
    if (!game)
        return;
    search_again(game, arg);
});

/* Called at applicationWillFinishLaunching time (or before ready).
   Docs recommend setting up the open-file handler here.
*/
app.on('will-finish-launching', function() {
    try {
        var path = path_mod.join(__dirname, 'package.json');
        var val = fs.readFileSync(path, { encoding:'utf8' });
        package_json = JSON.parse(val);
    }
    catch (ex) { }

    if (package_json.lectroteMainExtension) {
        main_extension = require(path_mod.join(__dirname, package_json.lectroteMainExtension));
        if (main_extension.launch)
            main_extension.launch(package_json);
    }
        
    var boundpath = package_json.lectrotePackagedGame;
    if (boundpath) {
        /* We're in single-game mode. Do not handle command-line
           arguments or open-file events. Launch with the built-in
           path and no other. */
        isbound = true;
        bound_game_path = path_mod.join(__dirname, boundpath);
        launch_paths.push(bound_game_path);
        return;        
    }

    /* open-file events can come from the dock/taskbar, or (on MacOS)
       from the Finder handing us a double-clicked file. See 
       Lectrote.app/Contents/Info.plist for the definition of what
       file types the Finder will hand us. 

       This event can be received before ready time. If it is, then
       we have to stash the path for later use.
    */
    app.on('open-file', function(ev, path) {
        if (!app_ready)
            launch_paths.push(path);
        else
            launch_game(path);
    });

    /* If we were launched with "npm start game.ulx" then "game.ulx" is
       in process.argv. Unfortunately, the first argument may be "main.js"
       or not, depending on how we were launched. I don't know a way to
       distinguish this other than just special-casing "main.js".
       We also special-case the "-psn..." argument which MacOS sometimes
       throws in. */
    for (var ix=1; ix<process.argv.length; ix++) {
        var path = process.argv[ix];
        if (path_mod.basename(path) == 'main.js' || path_mod.basename(path) == '.')
            continue;
        if (process.platform == 'darwin' && path.startsWith('-psn'))
            continue;
        launch_paths.push(path);
    }
});

/* Called when Electron is initialized and ready to run. 
*/
app.on('ready', function() {
    app_ready = true;

    load_prefs();

    if (process.platform != 'darwin' && process.platform != 'win32') {
        /* Mac windows don't have icons; Windows windows inherit their
           icon from the app's .ico resource. On Linux, we want to
           apply a generic icon. */
        window_icon = path_mod.join(__dirname, 'icon-128.png');
    }
    
    var template = construct_menu_template();
    var menu = electron.Menu.buildFromTemplate(template);
    electron.Menu.setApplicationMenu(menu);

    /* If any paths have been received, launch them. If not, open an
       initial splash window. (In bound-game mode, launch_paths should
       contain exactly one path.) */

    if (!launch_paths.length) {
        open_about_window();
        aboutwin_initial = true;
    }
    else {
        for (var ix=0; ix<launch_paths.length; ix++)
            launch_game(launch_paths[ix]);
    }

    /* Won't need this any more */
    launch_paths = null;

    if (main_extension.app_ready)
        main_extension.app_ready();
});

/* Export some API calls needed for extensions. */
exports.game_list = game_list;
exports.construct_menu_template = construct_menu_template;
exports.prefs_get = function(key) { return prefs[key]; };
exports.prefs_set = function(key, val) { prefs[key] = val; note_prefs_dirty(); };
exports.window_position_prefs = window_position_prefs;
exports.window_position_prefs_handler = window_position_prefs_handler;
exports.window_size_prefs = window_size_prefs;
exports.window_size_prefs_handler = window_size_prefs_handler;
exports.zoom_factor = function() { return zoom_factor_for_level(prefs.gamewin_zoomlevel); };
exports.is_app_ready = function() { return app_ready; };
exports.is_app_quitting = function() { return app_quitting; };
