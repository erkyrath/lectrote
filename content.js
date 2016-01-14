
function zoom_level_change(dir) 
{
    var webFrame = require('electron').webFrame;
    var val = webFrame.getZoomLevel();
    if (dir < 0)
        val = val - 1;
    else if (dir > 0)
        val = val + 1;
    else
        val = 0;
    webFrame.setZoomLevel(val);
}

