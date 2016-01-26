'use strict';
const electron = require('electron');
const app = electron.app;
const fs = require('fs');
const path_mod = require('path');

var gamewins = {}; /* maps window ID to a game structure */
var aboutwin = null; /* the splash/about window, if active */
var cardwin = null; /* the postcard window, if active */
var gamedialog = false; /* track whether the game-open dialog is visible */

var prefs = {
    gamewin_width: 600,
    gamewin_height: 800,
    gamewin_marginlevel: 1,
    gamewin_zoomlevel: 0
};
var prefspath = path_mod.join(app.getPath('userData'), 'lectrote-prefs.json');
var prefstimer = null;
var prefswriting = false;

var app_ready = false; /* true once the ready event occurred */
var launch_paths = []; /* game files passed in before app_ready */
var aboutwin_initial = false; /* true if the aboutwin was auto-opened */

function game_for_window(win)
{
    return gamewins[win.id];
}

function construct_recent_game_menu()
{
    var res = [];

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
        console.error('load_prefs: unable to load preferences: %s: %s', prefspath, ex);
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

/* Bring up the select-a-game dialog. 
*/
function select_load_game()
{
    if (gamedialog) {
        /* The dialog is already up. I'd focus it if I had a way to do that,
           but I don't. */
        return;
    }

    var opts = {
        title: 'Select a Glulx game file',
        properties: ['openFile'],
        filters: [ { name: 'Glulx Game File', extensions: ['ulx', 'blorb', 'gblorb'] } ]
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
    if (aboutwin && aboutwin_initial) {
        /* Dispose of the (temporary) splash window. This needs a time delay
           for some annoying internal reason. */
        setTimeout( function() { if (aboutwin) aboutwin.close(); }, 50);
    }

    add_recent_game(path);

    var win = null;
    var game = {
        path: path
    };

    var winopts = {
        width: prefs.gamewin_width, height: prefs.gamewin_height,
        minWidth: 400, minHeight: 400,
        zoomFactor: zoom_factor_for_level(prefs.gamewin_zoomlevel)
    };

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

    /* Game window callbacks */
    
    win.on('closed', function() {
        delete gamewins[game.id];
        game = null;
        win = null;
    });

    win.webContents.on('dom-ready', function() {
        invoke_app_hook(win, 'set_margin_level', prefs.gamewin_marginlevel);
        invoke_app_hook(win, 'load_named_game', game.path);
    });

    win.on('resize', function() {
        prefs.gamewin_width = win.getSize()[0];
        prefs.gamewin_height = win.getSize()[1];
        note_prefs_dirty();
    });
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
    win.loadURL('file://' + __dirname + '/play.html');
}

function open_about_window()
{
    var winopts = { 
        width: 600, height: 420,
        resizable: false
    };
    if (prefs.aboutwin_x !== undefined)
        winopts.x = prefs.aboutwin_x;
    if (prefs.aboutwin_y !== undefined)
        winopts.y = prefs.aboutwin_y;

    aboutwin = new electron.BrowserWindow(winopts);

    aboutwin.on('closed', function() {
            aboutwin = null;
        });
    aboutwin.on('move', function() {
            prefs.aboutwin_x = aboutwin.getPosition()[0];
            prefs.aboutwin_y = aboutwin.getPosition()[1];
            note_prefs_dirty();
        });
    aboutwin.webContents.on('will-navigate', function(ev, url) {
            require('electron').shell.openExternal(url);
            ev.preventDefault();
        });

    aboutwin.loadURL('file://' + __dirname + '/about.html');
}

function open_card_window()
{
    var winopts = { 
        width: 840, height: 660,
        maxWidth: 840, maxHeight: 660,
        javascript: false
    };
    if (prefs.cardwin_x !== undefined)
        winopts.x = prefs.cardwin_x;
    if (prefs.cardwin_y !== undefined)
        winopts.y = prefs.cardwin_y;

    cardwin = new electron.BrowserWindow(winopts);

    cardwin.on('closed', function() {
            cardwin = null;
        });
    cardwin.on('move', function() {
            prefs.cardwin_x = cardwin.getPosition()[0];
            prefs.cardwin_y = cardwin.getPosition()[1];
            note_prefs_dirty();
        });
    cardwin.webContents.on('will-navigate', function(ev, url) {
            require('electron').shell.openExternal(url);
            ev.preventDefault();
        });

    cardwin.loadURL('file://' + __dirname + '/if-card.html');
}

function setup_app_menu()
{
    var name = require('electron').app.getName();

    function find_in_template(key) {
        for (var ix=0; ix<template.length; ix++) {
            var stanza = template[ix];
            if (stanza.label == key)
                return stanza;
        }
        return null;
    };

    var template = [
    {
        label: 'File',
        submenu: [
        {
            label: 'Open Game...',
            accelerator: 'CmdOrCtrl+O',
            click: function() {
                select_load_game();
            }
        },
        {
            label: 'Open Recent',
            type: 'submenu',
            submenu: construct_recent_game_menu()
        },
        {
            label: 'Close Window',
            accelerator: 'CmdOrCtrl+W',
            role: 'close'
        }
        ]
    },
    {
        label: 'Edit',
        submenu: [
        {
            label: 'Undo',
            accelerator: 'CmdOrCtrl+Z',
            role: 'undo'
        },
        {
            label: 'Redo',
            accelerator: 'Shift+CmdOrCtrl+Z',
            role: 'redo'
        },
        {
            type: 'separator'
        },
        {
            label: 'Cut',
            accelerator: 'CmdOrCtrl+X',
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
            role: 'paste'
        },
        {
            label: 'Select All',
            accelerator: 'CmdOrCtrl+A',
            role: 'selectall'
        }
        ]
    },
    {
        label: 'View',
        submenu: [
        {
            label: 'Zoom In',
            accelerator: 'CmdOrCtrl+=',
            click: function(item, win) {
                if (!game_for_window(win))
                    return;
                prefs.gamewin_zoomlevel += 1;
                note_prefs_dirty();
                var val = zoom_factor_for_level(prefs.gamewin_zoomlevel);
                invoke_app_hook(win, 'set_zoom_factor', val);
            }
        },
        {
            label: 'Zoom Normal',
            click: function(item, win) {
                if (!game_for_window(win))
                    return;
                prefs.gamewin_zoomlevel = 0;
                note_prefs_dirty();
                var val = zoom_factor_for_level(prefs.gamewin_zoomlevel);
                invoke_app_hook(win, 'set_zoom_factor', val);
            }
        },
        {
            label: 'Zoom Out',
            accelerator: 'CmdOrCtrl+-',
            click: function(item, win) {
                if (!game_for_window(win))
                    return;
                prefs.gamewin_zoomlevel -= 1;
                note_prefs_dirty();
                var val = zoom_factor_for_level(prefs.gamewin_zoomlevel);
                invoke_app_hook(win, 'set_zoom_factor', val);
            }
        },
        {
            label: 'Margins Wider',
            click: function(item, win) {
                if (!game_for_window(win))
                    return;
                prefs.gamewin_marginlevel += 1;
                if (prefs.gamewin_marginlevel > 5)
                    prefs.gamewin_marginlevel = 5;
                note_prefs_dirty();
                invoke_app_hook(win, 'set_margin_level', prefs.gamewin_marginlevel);
            }
        },
        {
            label: 'Margins Narrower',
            click: function(item, win) {
                if (!game_for_window(win))
                    return;
                prefs.gamewin_marginlevel -= 1;
                if (prefs.gamewin_marginlevel < 0)
                    prefs.gamewin_marginlevel = 0;
                note_prefs_dirty();
                invoke_app_hook(win, 'set_margin_level', prefs.gamewin_marginlevel);
            }
        },
        {
            type: 'separator'
        },
        {
            label: 'Toggle Developer Tools',
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
        label: 'Window',
        role: 'window',
        submenu: [
        {
            label: 'Minimize',
            accelerator: 'CmdOrCtrl+M',
            role: 'minimize'
        }
        ]
    },
    {
        label: 'Help',
        role: 'help',
        submenu: [
        {
            label: 'IF Reference Card',
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
    
    if (process.platform == 'darwin') {
        var stanza = find_in_template('Window');
        if (stanza) {
            stanza.submenu.push({
                type: 'separator'
            });
        }

        template.unshift({
            label: name,
            submenu: [
            {
                label: 'About ' + name,
                click: function(item, win) {
                    if (!aboutwin)
                        open_about_window();
                    else
                        aboutwin.show();
                    aboutwin_initial = false;
                }
            },
            {
                type: 'separator'
            },
            {
                label: 'Services',
                role: 'services',
                submenu: []
            },
            {
                type: 'separator'
            },
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
            {
                type: 'separator'
            },
            {
                label: 'Quit',
                accelerator: 'Command+Q',
                click: function() { app.quit(); }
            },
            ]
        });
    }
    else {
        var stanza = find_in_template('Help');
        if (stanza) {
            stanza.submenu.push({
                label: 'About ' + name,
                click: function(item, win) {
                    if (!aboutwin)
                        open_about_window();
                    else
                        aboutwin.show();
                    aboutwin_initial = false;
                }
            });
        }
    }

    var menu = electron.Menu.buildFromTemplate(template);
    electron.Menu.setApplicationMenu(menu);
}

/* Called when the last window is closed; we shut down.
*/
app.on('window-all-closed', function() {
    app.quit();
});

/* Called when the app is going to quit, either because the last window
   closed or the user hit cmd-Q. 
*/
app.on('will-quit', function() {
    write_prefs_now();
});

electron.ipcMain.on('select_load_game', function() {
    select_load_game();
});

/* Called at applicationWillFinishLaunching time (or before ready).
   Docs recommend setting up the open-file handler here.
*/
app.on('will-finish-launching', function() {
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
});

/* Called when Electron is initialized and ready to run. 
*/
app.on('ready', function() {
    app_ready = true;

    load_prefs();
    setup_app_menu();

    /* If any paths have been received, launch them. If not, open an
       initial splash window. */
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
});
