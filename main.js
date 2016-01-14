'use strict';
const electron = require('electron');
const app = electron.app;  // Module to control application life.

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainwin = null;

var prefs = {
    mainwin_width: 600,
    mainwin_height: 800
};
var prefstimer = null;
var prefswriting = false;

const fs = require('fs');
const path = require('path');
var prefspath = path.join(app.getPath('userData'), 'quixe-prefs.json');

/* Called only at app startup. */
function load_prefs() {
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

/* Called whenever we update the prefs object. This waits five seconds 
   (to consolidate writes) and then launches an async file-write.
*/
function note_prefs_dirty() {
    /* If a timer is in flight, we're covered. */
    if (prefstimer !== null)
        return;
    prefstimer = setTimeout(handle_write_prefs, 5000);
}

/* Callback for prefs-dirty timer. */
function handle_write_prefs() {
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
function write_prefs_now() {
    if (prefstimer !== null) {
        clearTimeout(prefstimer);
        prefstimer = null;
        var prefsstr = JSON.stringify(prefs);
        fs.writeFileSync(prefspath, prefsstr, { encoding:'utf8' });
    }
}

function setup_app_menu() {
    var template = [
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
        },
        ]
    },
    {
        label: 'View',
        submenu: [
        {
            label: 'Zoom In',
            accelerator: 'CmdOrCtrl+=',
            click: function(item, win) {
                win.webContents.executeJavaScript('AppHooks.zoom_level_change(+1)');
            }
        },
        {
            label: 'Zoom Out',
            accelerator: 'CmdOrCtrl+-',
            click: function(item, win) {
                win.webContents.executeJavaScript('AppHooks.zoom_level_change(-1)');
            }
        },
        {
            label: 'Zoom Normal',
            click: function(item, win) {
                win.webContents.executeJavaScript('AppHooks.zoom_level_change(0)');
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

    var winopts = { width: prefs.mainwin_width, height: prefs.mainwin_height };
    if (prefs.mainwin_x !== undefined)
        winopts.x = prefs.mainwin_x;
    if (prefs.mainwin_y !== undefined)
        winopts.y = prefs.mainwin_y;
    mainwin = new electron.BrowserWindow(winopts);

    /* Main window callbacks */    
    mainwin.on('closed', function() {
        mainwin = null;
    });

    mainwin.on('resize', function() {
        prefs.mainwin_width = mainwin.getSize()[0];
        prefs.mainwin_height = mainwin.getSize()[1];
        note_prefs_dirty();
    });
    mainwin.on('move', function() {
        prefs.mainwin_x = mainwin.getPosition()[0];
        prefs.mainwin_y = mainwin.getPosition()[1];
        note_prefs_dirty();
    });

    /* Load the game UI and go. */
    mainwin.loadURL('file://' + __dirname + '/play.html');
});
