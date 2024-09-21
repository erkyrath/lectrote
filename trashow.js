'use strict';
const electron = require('electron');
const fs = require('fs');
const path_mod = require('path');

const fonts = require('./fonts.js');
const traread = require('./traread.js');

var tra_filename = null;
var tra_path = null;

var loading_visible = null;

var windowdic = new Map(); // Glk window information

/* Not yet implemented. */
var search_input_el = null;
var search_body_el = null;

function load_transcript(arg)
{
    console.log('### load_transcript', arg);
    tra_filename = arg.filename;
    tra_path = arg.path;

    document.title = arg.title + ' - Transcript';

    async function readall() {
        var iter = traread.stanza_reader(tra_path);
        for await (var obj of iter) {
            add_stanza(obj);
        }
    }

    readall()
        .then(() => {
            hide_loading();
        })
        .catch((ex) => {
            glkote_error('Error reading transcript: ' + ex);
        });
}

function add_stanza(obj)
{
    if (obj.output) {
        if (obj.output.windows) {
            windowdic.clear();
            for (var win of obj.output.windows) {
                windowdic.set(win.id, win);
            }
        }
        if (obj.output.content) {
            for (var dat of obj.output.content) {
                var win = windowdic.get(dat.id);
                if (win && win.type == 'buffer') {
                    //### if dat.clear, show a horizontal rule?
                    for (var el of dat.text) {
                        //###
                    }
                }
            }
        }
    }
}

function hide_loading() {
    if (loading_visible == false)
        return;
    loading_visible = false;

    const el = document.getElementById('loadingpane');
    if (el) {
        el.style.display = 'none';  /* el.hide() */
    }
}

function glkote_error(msg) {
    if (!msg)
        msg = '???';

    let el = document.getElementById('errorcontent');
    if (!el) return;
    
    remove_children(el);
    el.appendChild(document.createTextNode(msg));

    el = document.getElementById('errorpane');
    if (el.className == 'WarningPane')
        el.className = null;
    el.style.display = '';   /* el.show() */
    //error_visible = true;

    hide_loading();
}

function remove_children(parent) {
    const ls = parent.childNodes;
    while (ls.length > 0) {
        const obj = ls.item(0);
        parent.removeChild(obj);
    }
}

/* Preference-handling functions are copied from apphooks.js. Could be
   refactored. */

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
    load_transcript : load_transcript,
    set_zoom_factor : set_zoom_factor,
    set_margin_level : set_margin_level,
    set_color_theme : set_color_theme,
    set_font : set_font,
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
