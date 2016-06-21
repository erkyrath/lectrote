'use strict';
const electron = require('electron');

electron.ipcRenderer.on('set_color_theme', function(sender, val) {
    var bodyel = $('#container');

    if (val == 'dark') {
        if (!bodyel.hasClass('DarkTheme'))
            bodyel.addClass('DarkTheme');
    }
    else {
        bodyel.removeClass('DarkTheme');
    }

});

$(document).ready(function() {
    electron.ipcRenderer.sendToHost('log', '### search.js log');

    var inputel = $('#searchbar_input');
    var doneel = $('#searchbar_done');
    var prevel = $('#searchbar_prev');
    var nextel = $('#searchbar_next');

    inputel.focus();
    inputel.select();

    inputel.on('keypress', function(ev) {
        if (ev.keyCode == 13) {
            var val = inputel.val().trim();
            if (val)
                electron.ipcRenderer.sendToHost('search_text', { text:val, first:true, forward:true });
        }
    });

    inputel.on('keydown', function(ev) {
        if (ev.keyCode == 27) {
            $('#searchbar').css('display', 'none');
            inputel.val('');
            electron.ipcRenderer.sendToHost('search_done');
        }
    });

    doneel.on('click', function() {
        $('#searchbar').css('display', 'none');
        inputel.val('');
        electron.ipcRenderer.sendToHost('search_done');
    });

    nextel.on('click', function() {
        var val = inputel.val().trim();
        if (val)
            electron.ipcRenderer.sendToHost('search_text', { text:val, first:false, forward:true });
    });

    prevel.on('click', function() {
        var val = inputel.val().trim();
        if (val)
            electron.ipcRenderer.sendToHost('search_text', { text:val, first:false, forward:false });
    });

});
