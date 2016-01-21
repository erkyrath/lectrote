
AppHooks = function() {

const fs = require('fs');

function load_named_game(path)
{
    var buf = fs.readFileSync(path);
    /* Convert to a generic Array of byte values. */
    var arr = new Array(buf.length);
    for (var ix=0; ix<buf.length; ix++)
        arr[ix] = buf[ix];
    GiLoad.load_run(null, arr, 'array');
}

function set_zoom_factor(val) 
{
    var webFrame = require('electron').webFrame;
    webFrame.setZoomFactor(val);
}

function set_margin_level(val)
{
    var str = '0px ' + (5*val) + '%';
    $('#gameport').css({'margin':str});
}

return {
    load_named_game : load_named_game,
    set_zoom_factor : set_zoom_factor,
    set_margin_level : set_margin_level
};

}();
