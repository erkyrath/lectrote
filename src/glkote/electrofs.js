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

/* Dialog.open(tosave, usage, gameid, callback) -- open a file-choosing dialog
 *
 * The "tosave" flag should be true for a save dialog, false for a load
 * dialog.
 *
 * The "usage" and "gameid" arguments are arbitrary strings which describe the
 * file. These filter the list of files displayed; the dialog will only list
 * files that match the arguments. Pass null to either argument (or both) to
 * skip filtering.
 *
 * The "callback" should be a function. This will be called with a fileref
 * argument (see below) when the user selects a file. If the user cancels the
 * selection, the callback will be called with a null argument.
*/
function dialog_open(tosave, usage, gameid, callback) {
}

/* Dialog.file_construct_ref(filename, usage, gameid) -- create a fileref
 *
 * Create a fileref. This does not create a file; it's just a thing you can use
 * to read an existing file or create a new one. Any unspecified arguments are
 * assumed to be the empty string.
 */
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

/* Dialog.file_ref_exists(ref) -- returns whether the file exists
 */
function file_ref_exists(ref) {
    //###
}

/* Dialog.file_remove_ref(ref) -- delete the file, if it exists
 */
function file_remove_ref(ref) {
    //###
}

/* Dialog.file_write(dirent, content, israw) -- write data to the file
 *
 * The "content" argument is stored to the file. If "israw" is true, the
 * content must be a string. Otherwise, the content is an array of byte
 * or unicode values which must be converted.
 */
function file_write(dirent, content, israw) {
    //### but we'll start with json-stringify just to demo
}

/* Dialog.file_read(dirent, israw) -- read data from the file
 *
 * Read the (entire) content of the file. If "israw" is true, this returns the
 * string that was stored. Otherwise, the content is converted to an array
 * of byte/unicode values.
 *
 * As a special case, the empty string is converted to an empty array (when not
 * in israw mode).
 */
function file_read(dirent, israw) {
    //### but we'll start with json-stringify just to demo
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
