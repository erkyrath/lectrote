#!/usr/bin/env node

/* This invokes makeUniversalApp to stitch dist/Lectrote-darwin-x64 and
   dist/Lectrote-darwin-arm64 together into a universal binary, which
   winds up in dist/Lectrote-darwin-univ.

   See https://www.npmjs.com/package/@electron/universal for this package.

   A wrinkle: /usr/bin/file on MacOS crashes on some of the files in
   the Electron package! For example, this generates an error:

       file emglken/git-core.wasm

   The makeUniversalApp script checks every file with /usr/bin/file,
   and chokes on this error. To work around this, I've included a script
   tools/file which calls /usr/bin/file but swallows the error code.
*/

const path = require('path');
const fs = require('fs');
var { makeUniversalApp } = require('@electron/universal');

var cwd = process.cwd();
var outpath = path.join(cwd, 'dist/Lectrote-darwin-univ/Lectrote.app');

console.log('Writing to', outpath);

/* Make sure the destination directory exists and the destination
   binary does not. */

if (!fs.existsSync('dist/Lectrote-darwin-univ')) {
    fs.mkdirSync('dist/Lectrote-darwin-univ');
}
if (fs.existsSync(outpath)) {
    fs.rmdirSync(outpath, { recursive:true });
}

/* Include ./tools in the path, because makeUniversalApp needs to use
   ./tools/file rather than /usr/bin/file. 
*/
var execpath = process.env['PATH'];
process.env['PATH'] = path.join(cwd, 'tools') + ':' + execpath

/* Do it. */

makeUniversalApp({
    x64AppPath: path.join(cwd, 'dist/Lectrote-darwin-x64/Lectrote.app'),
    arm64AppPath: path.join(cwd, 'dist/Lectrote-darwin-arm64/Lectrote.app'),
    outAppPath: outpath,
}).catch(function(ex) {
    console.log('Failed:', ex);
    process.exit(1);
}).then(function() {
    console.log('Success.');
});

