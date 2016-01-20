'use strict';
const electron = require('electron');
const app = electron.app;

var mainwin = null;
var cardwin = null;

var prefs = {
    mainwin_width: 600,
    mainwin_height: 800,
    mainwin_zoomlevel: 0
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

/* We can't rely on the web-frame algorithm for this, because we have
   to include it when creating the browser window. So we have our
   own bit of code: basically 10% larger/smaller per unit.
*/
function zoom_factor_for_level(val) {
    if (!val)
        return 1;
    return Math.exp(val * 0.09531017980432493);
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
                if (win != mainwin)
                    return;
                prefs.mainwin_zoomlevel += 1;
                note_prefs_dirty();
                var val = zoom_factor_for_level(prefs.mainwin_zoomlevel);
                win.webContents.executeJavaScript('AppHooks.set_zoom_factor('+val+')');
            }
        },
        {
            label: 'Zoom Normal',
            click: function(item, win) {
                if (win != mainwin)
                    return;
                prefs.mainwin_zoomlevel = 0;
                note_prefs_dirty();
                var val = zoom_factor_for_level(prefs.mainwin_zoomlevel);
                win.webContents.executeJavaScript('AppHooks.set_zoom_factor('+val+')');
            }
        },
        {
            label: 'Zoom Out',
            accelerator: 'CmdOrCtrl+-',
            click: function(item, win) {
                if (win != mainwin)
                    return;
                prefs.mainwin_zoomlevel -= 1;
                note_prefs_dirty();
                var val = zoom_factor_for_level(prefs.mainwin_zoomlevel);
                win.webContents.executeJavaScript('AppHooks.set_zoom_factor('+val+')');
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

    var winopts = {
        width: prefs.mainwin_width, height: prefs.mainwin_height,
        zoomFactor: zoom_factor_for_level(prefs.mainwin_zoomlevel)
    };
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
