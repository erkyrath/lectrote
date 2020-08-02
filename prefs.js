'use strict';
const electron = require('electron');

const fonts = require('./fonts.js');
const formats = require('./formats.js');

const tablist = [ 'appear', 'terp' ];

var darklight_flag = false;

/* Set up the initial appearance of the window. This adjusts the controls
   and the sample text, but does not send changes to the app (because there
   have been no changes yet).
*/
function setup_with_prefs(prefs, isbound)
{
    var sel, optel;

    // Function-calling function because closures suck.
    var setclick = function(val) {
        $('#tabbutton-'+val).on('click', function(ev) { 
            set_tab(val); 
            ev.preventDefault();
        });
    }
    for (var ix=0; ix<tablist.length; ix++) {
        setclick(tablist[ix]);
    }
    set_tab('appear');


    sel = $('#sel-color-theme');
    sel.prop('disabled', false);
    sel.empty();

    for (var ix=0; ix<themelist.length; ix++) {
        var theme = themelist[ix];
        optel = $('<option>', { value:theme.key }).text(theme.label);
        if (prefs.gamewin_colortheme == theme.key)
            optel.prop('selected', true);
        sel.append(optel);
    }

    sel.on('change', evhan_color_theme);
    apply_color_theme(prefs.gamewin_colortheme);


    sel = $('#sel-font');
    sel.prop('disabled', false);
    sel.empty();

    for (var ix=0; ix<fontlist.length; ix++) {
        var font = fontlist[ix];
        optel = $('<option>', { value:font.key }).text(font.label);
        if (prefs.gamewin_font == font.key)
            optel.prop('selected', true);
        sel.append(optel);
    }

    sel.on('change', evhan_font);

    var inpel = $('#input-font');
    if (prefs.gamewin_customfont)
        inpel.val(prefs.gamewin_customfont);
    inpel.on('change', evhan_font);

    apply_font(prefs.gamewin_font, prefs.gamewin_customfont);


    sel = $('#range-margin');
    sel.attr('step', 1);
    sel.attr('min', 0);
    sel.attr('max', 5);

    sel.on('input', evhan_margin_level);
    sel.val(prefs.gamewin_marginlevel);
    apply_margin_level(prefs.gamewin_marginlevel);


    sel = $('#range-zoom');
    sel.attr('step', 1);
    sel.attr('min', -6);
    sel.attr('max', 6);

    sel.on('input', evhan_zoom_level);
    sel.val(prefs.gamewin_zoomlevel);
    apply_zoom_level(prefs.gamewin_zoomlevel);


    if (!isbound) {
        sel = $('#sel-glulx-terp');
        sel.prop('disabled', false);
        sel.empty();

        for (var ix=0; ix<formats.formatmap['glulx'].engines.length; ix++) {
            var engine = formats.formatmap['glulx'].engines[ix];
            optel = $('<option>', { value:engine.id }).text(engine.name);
            if (prefs.glulx_terp == engine.id)
                optel.prop('selected', true);
            sel.append(optel);
        }

        sel.on('change', evhan_glulx_terp);
    }
    else {
        sel = $('#tabheader');
        sel.hide();
    }
}

function set_tab(val)
{
    switch (val) {
    case 'appear':
        $('body').removeClass('CurrentTabTerp');
        $('body').addClass('CurrentTabAppear');
        break;
    case 'terp':
        $('body').removeClass('CurrentTabAppear');
        $('body').addClass('CurrentTabTerp');
        break;
    default:
        $('body').removeClass('CurrentTabAppear');
        $('body').removeClass('CurrentTabTerp');
        break;
    }
}

/* The apply_... functions adjust the sample text in this window, but
   do not directly affect the controls or send changes to the app.

   A lot of this code is copied from apphooks.js. It has to be kept
   in sync.
*/

var themelist = [
    { key:'lightdark', label:'System (Light/Dark)' },
    { key:'sepiaslate', label:'System (Sepia/Slate)' },
    { key:'light', label:'Light' },
    { key:'sepia', label:'Sepia' },
    { key:'slate', label:'Slate' },
    { key:'dark', label:'Dark' }
];

function apply_color_theme(val)
{
    // System-reactive themes:
    if (val == 'lightdark') {
        val = (darklight_flag ? 'dark' : 'light');
    }
    else if (val == 'sepiaslate') {
        val = (darklight_flag ? 'slate' : 'sepia');
    }

    var bodyel = $('.Sample');

    bodyel.removeClass('SepiaTheme');
    bodyel.removeClass('SlateTheme');
    bodyel.removeClass('DarkTheme');

    switch (val) {

    case 'sepia':
        bodyel.addClass('SepiaTheme');
        break;

    case 'slate':
        bodyel.addClass('SlateTheme');
        break;

    case 'dark':
        bodyel.addClass('DarkTheme');
        break;

    default:
        /* Light theme is the default. */
        break;
    }
}

var fontlist = [
    { key:'lora', label:'Lora' },
    { key:'gentium', label:'Gentium Book' },
    { key:'georgia', label:'Georgia' },
    { key:'baskerville', label:'Libre Baskerville' },
    { key:'helvetica', label:'Helvetica' },
    { key:'sourcesanspro', label:'Source Sans Pro' },
    { key:'courier', label:'Courier' },
    { key:'custom', label:'Other Font...' }
];

function apply_font(fontkey, customfont)
{
    var inpel = $('#input-font');

    if (fontkey == 'custom') {
        if (inpel.css('display') != 'inline-block') {
            inpel.css('display', 'inline-block');
            inpel.select();
            inpel.focus();
        }
    }
    else {
        if (inpel.css('display') != 'none') {
            inpel.css('display', 'none');
        }
    }

    //### check if anything's changed
    var fontline = fonts.get_fontline(fontkey, customfont);

    var el = $('#fontcss');
    if (!fontline) {
        el.remove();
    }
    else {
        if (!el.length) {
            el = $('<style>', { id:'fontcss', type:'text/css' });
            $('#bodycss').before(el);
        }
        var text = '.Sample { font-family: @@; }\n';
        text = text.replace(/@@/g, fontline);
        el.text(text);
    }
}

function apply_margin_level(val)
{
    var str = '0px ' + (5*val) + '%';
    $('.SampleText').css({'margin':str});

    var el = $('#display-margin');
    var text = 'None';
    if (val > 0)
        text = (val*5) + '%';
    el.text(text);
}

function apply_zoom_level(val)
{
    var factor = 1;
    if (val)
        factor = Math.exp(val * 0.09531017980432493);

    $('.SampleText').css({'font-size':factor+'em'});

    var el = $('#display-zoom');
    var text = 'Normal';
    if (val > 0)
        text = 'Zoom In ' + val;
    else if (val < 0)
        text = 'Zoom Out ' + (-val);
    el.text(text);
}

function apply_darklight(val)
{
    darklight_flag = val;
    
    var el = $('body');
    if (!darklight_flag) {
        el.addClass('LightMode');
        el.removeClass('DarkMode');
    }
    else {
        el.addClass('DarkMode');
        el.removeClass('LightMode');
    }
    
    var sel = $('#sel-color-theme');
    var val = sel.val();
    apply_color_theme(val);
}

/* The evhan_... functions respond to user manipulation of the controls.
   They invoke apply_... to adjust the sample text, and then send a
   pref update to the app. */

function evhan_color_theme()
{
    var sel = $('#sel-color-theme');
    var val = sel.val();
    apply_color_theme(val);
    electron.ipcRenderer.send('pref_color_theme', val);
}

function evhan_font()
{
    var fontkey = $('#sel-font').val();
    var customfont = $('#input-font').val();
    apply_font(fontkey, customfont);
    electron.ipcRenderer.send('pref_font', fontkey, customfont);
}

function evhan_margin_level()
{
    var sel = $('#range-margin');
    var val = Math.round(1 * sel.val()); /* cast to int */
    apply_margin_level(val);
    electron.ipcRenderer.send('pref_margin_level', val);
}

function evhan_zoom_level()
{
    var sel = $('#range-zoom');
    var val = Math.round(1 * sel.val()); /*cast to int */
    apply_zoom_level(val);
    electron.ipcRenderer.send('pref_zoom_level', val);
}

function evhan_glulx_terp()
{
    var sel = $('#sel-glulx-terp');
    var val = sel.val();
    electron.ipcRenderer.send('pref_glulx_terp', val);
}

/* Respond to messages from the app. */

electron.ipcRenderer.on('set-darklight-mode', function(ev, arg) {
    apply_darklight(arg);
});
electron.ipcRenderer.on('current-prefs', function(ev, arg) {
    setup_with_prefs(arg.prefs, arg.isbound);
});
electron.ipcRenderer.on('set-zoom-level', function(ev, arg) {
    $('#range-zoom').val(arg);
    apply_zoom_level(arg);
});
