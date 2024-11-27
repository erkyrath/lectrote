'use strict';
const electron = require('electron');
const fs = require('fs');
const path_mod = require('path');

const fonts = require('./fonts.js');
const searchbar = require('./searchbar.js');
const traread = require('./traread.js');

var tra_filename = null;
var tra_path = null;

var loading_visible = null;

function load_transcript(arg)
{
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

/* Add a stanza to the output "buffer window". This is almost exactly
   what glkote.js does when an update message arrives. It is also
   almost the same code as stanzas_write_to_file(), just creating DOM
   elements rather than writing text.

   Differences:
   - We only pay attention to buffer windows. The status line (assuming
     that's a grid) is lost.
   - If there's more than one buffer window, the output is interleaved
     in a single display stream.
   - Window-clear events are shown as horizontal rules.
   - Hyperlinks are clickable but do nothing.
   - Graphics are currently not supported.
*/
function add_stanza(obj)
{
    if (obj.metadata) {
        var bioel = null;
        for (var key of traread.metadata_keylist) {
            if (obj.metadata[key]) {
                if (!bioel) {
                    bioel = $('<div>', { 'class':'MetadataBox' });
                    $('#window').append(bioel);
                }
                var metel = $('<div>');
                metel.append($('<span>', { 'class':'MetadataKey' }).text(key+':'));
                metel.append($('<span>').text(' '));
                var valel = $('<span>', { 'class':'MetadataValue' });
                if (key == 'title')
                    valel.addClass('MetadataTitle');
                valel.text(obj.metadata[key]);
                metel.append(valel);
                bioel.append(metel);
            }
        }
        if (bioel) {
            add_hrule();
        }
    }
    
    if (obj.output) {
        if (obj.output.content) {
            for (var dat of obj.output.content) {
                /* We assume that if a content stanza has "text", it's a
                   buffer window. It would be tidier to track open window
                   types, but this might be a partial transcript with no
                   "arrange" event, so we can't do that. */
                if (dat.text) {
                    if (dat.clear) {
                        add_hrule();
                    }
                    if (dat.text) {
                        add_stanza_linedata(dat.text, obj.timestamp, obj.outtimestamp);
                    }
                }
            }
        }
    }
}

function add_stanza_linedata(text, intimestamp, outtimestamp)
{
    var frameel = $('#window');
    var firsttime = true;
    
    for (let ix=0; ix<text.length; ix++) {
        const textarg = text[ix];
        const content = textarg.content;
        let divel = null;
        if (textarg.append) {
            if (!content || !content.length)
                continue;
            divel = null;
            var udivel = last_child_of(frameel); /* not wrapped */
            if (udivel && udivel.tagName == 'DIV')
                divel = $(udivel);
        }
        if (divel == null) {
            /* Create a new paragraph div */
            divel = $('<div>', { 'class': 'BufferLine BlankPara' });
            divel.data('blankpara', true);
            frameel.append(divel);
        }
        // skip textarg.flowbreak for now
        if (!content || !content.length) {
            if (divel.data('blankpara'))
                divel.append($('<span>', { 'class':'BlankLineSpan' }).text(' '));
            continue;
        }
        if (divel.data('blankpara')) {
            divel.data('blankpara', false);
            divel.removeClass('BlankPara');
            divel.empty();
        }

        if (firsttime) {
            firsttime = false;
            var date = new Date(intimestamp);
            var intimestr = date.toTimeString().slice(0, 8) + ', ' + date.toDateString().slice(4);
            var durstr = 'executed in ' + (outtimestamp - intimestamp) + ' ms';
            divel.find('.TimeAnchor').remove(); // only one per paragraph please
            const timeel = $('<div>', { 'class':'TimeAnchor' });
            timeel.append($('<div>', { 'class':'Dot' }).text('\u25C6'));
            const popel = $('<div>', { 'class':'Popup' }).text(intimestr);
            popel.append($('<br>'));
            popel.append($('<span>').text(durstr));
            timeel.prepend(popel);
            divel.prepend(timeel);
        }

        for (let sx=0; sx<content.length; sx++) {
            const rdesc = content[sx];
            let rstyle, rtext, rlink;
            if (!(typeof rdesc === 'string' || rdesc instanceof String)) {
                if (rdesc.special !== undefined) {
                    if (rdesc.special == 'image') {
                        var val;
                        if (rdesc.alttext)
                            val = '[image: ' + rdesc.alttext + ']';
                        else
                            val = '[image ' + rdesc.image + ']';
                        const specel = $('<span>', { 'class': 'Special_Image' } );
                        specel.text(val);
                        divel.append(specel);
                    }
                    continue;
                }
                rstyle = rdesc.style;
                rtext = rdesc.text;
                rlink = rdesc.hyperlink;
            }
            else {
                rstyle = rdesc;
                sx++;
                rtext = content[sx];
                rlink = undefined;
            }
            const el = $('<span>',
                         { 'class': 'Style_' + rstyle } );
            if (rlink == undefined) {
                // Autodetect URLs?
                el.append(document.createTextNode(rtext));
            }
            else {
                const ael = $('<a>',
                              { 'href': '#', 'class': 'Internal' } );
                ael.text(rtext);
                ael.on('click', (ev) => {}); // ignore clicks
                el.append(ael);
            }
            divel.append(el);
        }
        
    }
}

function add_hrule()
{
    var frameel = $('#window');
    var el = $('<hr>');
    frameel.append(el);
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

function last_child_of(obj) {
    const ls = obj.children();
    if (!ls || !ls.length)
        return null;
    return ls.get(ls.length-1);
}

function set_show_timestamps(flag)
{
    var bodyel = $('body');
    if (flag) {
        bodyel.addClass('DisplayAnchors');
    }
    else {
        bodyel.removeClass('DisplayAnchors');
    }
}

function evhan_delete_transcript()
{
    electron.ipcRenderer.send('delete_transcript', tra_filename, true);
}

function evhan_save_transcript_text()
{
    electron.ipcRenderer.send('save_transcript_text', tra_filename, true);
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

    var search_body_el = searchbar.get_search_body();
    
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
    set_show_timestamps : set_show_timestamps,
    set_zoom_factor : set_zoom_factor,
    set_margin_level : set_margin_level,
    set_color_theme : set_color_theme,
    set_font : set_font,
    search_request : searchbar.search_request,
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

$(document).ready(function() {
    searchbar.construct_searchbar();
});

