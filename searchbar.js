'use strict';

const electron = require('electron');

var search_input_el = null;
var search_body_el = null;

function construct_searchbar()
{
    var barel = $('#searchbar');
    if (!barel || !barel.length)
        return;

    barel.empty();
    var shadow = barel.get(0).attachShadow({ mode: 'open' });

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

function get_search_body()
{
    return search_body_el;
}

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

exports.construct_searchbar = construct_searchbar;
exports.search_request = search_request;
exports.get_search_body = get_search_body;
