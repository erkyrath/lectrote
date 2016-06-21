
AppHooks = function() {

const electron = require('electron');
const path_mod = require('path');
const fs = require('fs');

var search_webview = null;
var color_theme = 'light';

function load_named_game(path)
{
    game_options.default_page_title = path_mod.basename(path);

    var buf = fs.readFileSync(path);
    /* Convert to a generic Array of byte values. */
    var arr = new Array(buf.length);
    for (var ix=0; ix<buf.length; ix++)
        arr[ix] = buf[ix];
    GiLoad.load_run(null, arr, 'array');

    /* Pass some metadata back to the app */
    var obj = {
        title: path_mod.basename(path),
        signature: Quixe.get_signature()
    };

    var title = GiLoad.get_metadata('title');
    if (title)
        obj.title = title;
    
    electron.ipcRenderer.send('game_metadata', obj);
}

function set_clear_autosave(val)
{
    game_options.clear_vm_autosave = val;
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

function set_color_theme(val)
{
    color_theme = val;

    var bodyel = $('body');

    if (color_theme == 'dark') {
        if (!bodyel.hasClass('DarkTheme'))
            bodyel.addClass('DarkTheme');
    }
    else {
        bodyel.removeClass('DarkTheme');
    }

    if (search_webview)
        search_webview.send('set_color_theme', color_theme);
}

function set_font(val)
{
    var fontline = null;

    switch (val) {
    case 'georgia':
        fontline = 'Georgia, Cambria, serif';
        break;
    case 'helvetica':
        fontline = '"Helvetica Neue", Helvetica, Arial, sans-serif';
        break;
    case 'gentium':
        fontline = '"Gentium Book Basic", Georgia, Cambria, serif';
        break;
    case 'baskerville':
        fontline = '"Libre Baskerville", Palatino, Georgia, serif';
        break;
    case 'sourcesanspro':
        fontline = '"Source Sans Pro", Helvetica, Arial, sans-serif';
        break;
    case 'courier':
        fontline = 'Courier, monospace';
        break;
    case 'lora':
    default:
        fontline = null;
        break;
    }

    var el = $('#fontcss');
    if (!fontline) {
        el.remove();
    }
    else {
        if (!el.length) {
            el = $('<style>', { id:'fontcss', type:'text/css' });
            $('#bodycss').before(el);
        }
        var text = '.BufferWindow { font-family: @@; }\n.BufferWindow .Input { font-family: @@; }\n';
        text = text.replace(/@@/g, fontline);
        el.text(text);
    }
}

function search_request(arg)
{
    if (search_webview) {
        //### focus?
        return;
    }

    var searchel = $('<webview>', { id:'searchbar', class:'CanHaveInputFocus', src:'./search.html' });
    searchel.prop('nodeintegration', true);
    $('#content').append(searchel);

    search_webview = searchel.get(0);
    if (search_webview) {
        search_webview.send('set_color_theme', color_theme);
        search_webview.addEventListener('ipc-message', ev => {
                evhan_webview_message(ev.channel, ...ev.args);
            });
    }

    if (arg.inittext) {
        //### pass in the inittext
    }
    //###search_input_el.focus();
    //###search_input_el.select();
}

function evhan_webview_message(msg, arg)
{
    switch (msg) {
    case 'log':
        console.log('webview log:', arg);
        break;
    case 'search_text':
        electron.ipcRenderer.send('search_text', arg);
        break;
    case 'search_done':
        $('#searchbar').remove();
        search_webview = null;
        electron.ipcRenderer.send('search_done');
        break;
    }
}

const namespace = {
    load_named_game : load_named_game,
    set_clear_autosave : set_clear_autosave,
    set_zoom_factor : set_zoom_factor,
    set_margin_level : set_margin_level,
    set_color_theme : set_color_theme,
    set_font : set_font,
    search_request : search_request,
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
});

return namespace;
}();

