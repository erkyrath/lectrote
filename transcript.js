'use strict';
const electron = require('electron');

var darklight_flag = false;

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
}

electron.ipcRenderer.on('set-darklight-mode', function(ev, arg) {
    apply_darklight(arg);
});
