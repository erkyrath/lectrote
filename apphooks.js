'use strict';

const AppHooks = function() {

const electron = require('electron');
const path_mod = require('path');
const fs = require('fs');

const fonts = require('./fonts.js');
const formats = require('./formats.js');

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
    var arr = null;
    if (engine.load)
        arr = engine.load(arg, buf, game_options);

    GiLoad.load_run(game_options, arr, load_options);

    /* Pass some metadata back to the app */
    var obj = {
        title: default_name
    };

    var title = GiLoad.get_metadata('title');
    if (title)
        obj.title = title;

    if (engine.get_signature) {
        var signature = engine.get_signature();
        if (signature)
            obj.signature = signature;
    }

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

var search_input_el = null;
var search_body_el = null;

const searchbar_styles = `

input {
  width: 200px;
  font-size: 14px;
  height: 20px;
  margin-left: 4px;
  margin-right: 4px;
  border: 1px solid #BBB;
}

#searchbar_done {
  margin-left: 4px;
  margin-right: 4px;
}

.SepiaTheme input {
  background: white;
  color: black;
  border: 1px solid #BBB;
}
.SlateTheme input {
  background: black;
  color: white;
  border: 1px solid #555;
}
.DarkTheme input {
  background: black;
  color: white;
  border: 1px solid #555;
}

button {
  -webkit-appearance: none;
  font-size: 12px;
  width: 22px;
  height: 22px;
  background: #C0C0C0;
  border: 1px solid #AAA;
  -webkit-border-radius: 2px;
  padding: 0px;
}

.SepiaTheme button {
  background: #C0C0C0;
  border: 1px solid #AAA;
  color: black;
}
.SlateTheme button {
  background: #505050;
  border: 1px solid #666;
  color: white;
}
.DarkTheme button {
  background: #505050;
  border: 1px solid #666;
  color: white;
}
`;

function construct_searchbar()
{
    var barel = $('#searchbar');
    if (!barel || !barel.length)
        return;

    barel.empty();
    var shadow = barel.get(0).createShadowRoot();

    var bodyel = $('<div>', { id:'searchbar_body' });
    search_body_el = bodyel;

    var inputel = $('<input>', { id:'searchbar_input', type:'text' });
    search_input_el = inputel;
    var prevel = $('<button>', { id:'searchbar_prev' }).text('\u25C4');
    var nextel = $('<button>', { id:'searchbar_next' }).text('\u25BA');
    var doneel = $('<button>', { id:'searchbar_done' }).text('\u2716');

    bodyel.append(inputel);
    bodyel.append(prevel);
    bodyel.append(nextel);
    bodyel.append(doneel);

    var styleel = $('<style>').text(searchbar_styles);

    shadow.appendChild(styleel.get(0));
    shadow.appendChild(bodyel.get(0));

    inputel.on('keypress', function(ev) {
        if (ev.keyCode == 13) {
            var val = inputel.val().trim();
            if (val)
                electron.ipcRenderer.send('search_text', val);
        }
    });

    inputel.on('keydown', function(ev) {
        if (ev.keyCode == 27) {
            barel.css('display', 'none');
            inputel.val('');
            electron.ipcRenderer.send('search_done');
        }
    });

    doneel.on('click', function() {
        barel.css('display', 'none');
        inputel.val('');
        electron.ipcRenderer.send('search_done');
    });

    nextel.on('click', function() {
        electron.ipcRenderer.send('search_again', true);
    });

    prevel.on('click', function() {
        electron.ipcRenderer.send('search_again', false);
    });
}

function search_request(arg)
{
    if ($('#searchbar').css('display') == 'block') {
        if (arg.focus) {
            search_input_el.focus();
            search_input_el.select();
        }
        return; /* already open */
    }

    if (!search_input_el)
        return;

    if (arg.inittext) {
        if (search_input_el.val() == '')
            search_input_el.val(arg.inittext);
    }
    $('#searchbar').css('display', 'block');
    if (arg.focus) {
        search_input_el.focus();
        search_input_el.select();
    }
}

const namespace = {
    load_named_game : load_named_game,
    set_clear_autosave : set_clear_autosave,
    set_zoom_factor : set_zoom_factor,
    set_margin_level : set_margin_level,
    set_color_theme : set_color_theme,
    set_font : set_font,
    search_request : search_request
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
    construct_searchbar();
});

return namespace;
}();

