Dialog = function() {

const fs = require('fs');
const path = require('path');
var userpath = require('electron').remote.app.getPath('userData');
var extfilepath = path.join(userpath, 'quixe-files');

/* We try to create a directory for external files at launch time.
   This will usually fail because there's already a directory there.
*/
try {
    fs.mkdirSync(extfilepath);
}
catch (ex) {}

function dialog_open(tosave, usage, gameid, callback) {
}

function file_construct_ref(filename, usage, gameid) {
    if (!filename)
        filename = '';
    if (!usage)
        usage = '';
    if (!gameid)
        gameid = '';
    var path = path.join(extfilepath, filename);
    var ref = { path:path, usage:usage };
}

function file_ref_exists(ref) {
}

function file_remove_ref(ref) {
}

function file_write(dirent, content, israw) {
}

function file_read(dirent, israw) {
}

/* End of Dialog namespace function. Return the object which will
   become the Dialog global. */
return {
    open: dialog_open,

    file_construct_ref: file_construct_ref,
    file_ref_exists: file_ref_exists,
    file_remove_ref: file_remove_ref,
    file_write: file_write,
    file_read: file_read
};

}();

/* End of Dialog library. */
