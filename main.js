'use strict';
const electron = require('electron');
const app = electron.app;

var gamewins = {}; /* maps window ID to a game structure */
var cardwin = null;

var prefs = {
    gamewin_width: 600,
    gamewin_height: 800,
    gamewin_marginlevel: 1,
    gamewin_zoomlevel: 0
};
var prefstimer = null;
var prefswriting = false;

const fs = require('fs');
const path_mod = require('path');

var prefspath = path_mod.join(app.getPath('userData'), 'quixe-prefs.json');

function game_for_window(win)
{
    return gamewins[win.id];
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
    var argval = '';
    if (arg !== undefined)
        argval = JSON.stringify(arg);

    win.webContents.executeJavaScript('AppHooks.'+func+'('+argval+')');
}

/* Bring up the select-a-game dialog. 

   If we're doing this at launch time, we need to attach it to a
   browser window. This is silly, but it's the only way to get focus.
*/
function select_load_game(initial)
{
    var opts = {
        title: 'Select a Glulx game file',
        properties: ['openFile'],
        filters: [ { name: 'Glulx Game File', extensions: ['ulx', 'blorb', 'gblorb'] } ]
    };

    var win = null;
    if (initial) {
        var winopts = {
            width: 600, height: 100
        };
        if (prefs.initwin_x !== undefined)
            winopts.x = prefs.initwin_x;
        if (prefs.initwin_y !== undefined)
            winopts.y = prefs.initwin_y;

        win = new electron.BrowserWindow(winopts);

        win.on('move', function() {
            prefs.initwin_x = win.getPosition()[0];
            prefs.initwin_y = win.getPosition()[1];
            note_prefs_dirty();
        });
    }

    electron.dialog.showOpenDialog(win, opts, function(ls) {
        if (win) {
            /* Dispose of the temporary window. This needs a time delay
               for some annoying internal reason. */
            setTimeout( function() { win.close(); }, 50);
        }
        
        if (!ls || !ls.length)
            return;
        app.addRecentDocument(ls[0]);
        launch_game(ls[0]);
    });
}

/* Open a game window for a given game file.
*/
function launch_game(path)
{
    var win = null;
    var game = {
        path: path
    };

    var winopts = {
        width: prefs.gamewin_width, height: prefs.gamewin_height,
        minWidth: 400, minHeight: 400,
        zoomFactor: zoom_factor_for_level(prefs.gamewin_zoomlevel)
    };
    if (prefs.gamewin_x !== undefined)
        winopts.x = prefs.gamewin_x;
    if (prefs.gamewin_y !== undefined)
        winopts.y = prefs.gamewin_y;
    win = new electron.BrowserWindow(winopts);
    if (!win)
        return;

    game.win = win;
    game.id = win.id;
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
    });

    /* Load the game UI and go. */
    win.loadURL('file://' + __dirname + '/play.html');
}

function setup_app_menu()
{
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
            label: 'IF Reference Card',
            click: function(item, win) {
                if (!cardwin) {
                    var winopts = { 
                        width: 810, height: 620,
                        maxWidth: 810, maxHeight: 620,
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
                else {
                    cardwin.show();
                }
            }
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
        },
        {
            label: 'Debug Command',
            click: function(item) {
                console.log(app.getPath('userData'));
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
        },
        {
            type: 'separator'
        }
        ]
    }
    ];
    
    if (process.platform == 'darwin') {
        var name = require('electron').app.getName();
        template.unshift({
            label: name,
            submenu: [
            {
                label: 'About ' + name,
                role: 'about'
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

/* Called when Electron is initialized and ready to run. 
*/
app.on('ready', function() {
    load_prefs();
    setup_app_menu();

    select_load_game(true);
});
