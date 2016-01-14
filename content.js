
AppHooks = function() {

function zoom_level_change(dir) 
{
    var webFrame = require('electron').webFrame;
    var val = webFrame.getZoomLevel();
    if (dir < 0)
        val = val - 0.5;
    else if (dir > 0)
        val = val + 0.5;
    else
        val = 0;
    webFrame.setZoomLevel(val);
}

return {
    zoom_level_change : zoom_level_change
};

}();
