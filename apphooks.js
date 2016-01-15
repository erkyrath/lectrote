
AppHooks = function() {

function set_zoom_factor(val) 
{
    var webFrame = require('electron').webFrame;
    webFrame.setZoomFactor(val);
}

return {
    set_zoom_factor : set_zoom_factor
};

}();
