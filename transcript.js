'use strict';

const fs = require('fs');
const path_mod = require('path');

var transcriptdir = null;
var metadata = {};

function set_transcriptdir(path)
{
    transcriptdir = path;
    console.log('### path', transcriptdir); //###

    /* We try to create a directory for external files at init time.
       This will usually fail because there's already a directory there.
    */
    try {
        // should be async, I know
        fs.mkdirSync(transcriptdir);
    }
    catch (ex) {}

}

function set_metadata(obj)
{
    metadata = obj;
    console.log('### metadata', metadata); //###
}

function record_update(obj)
{
    console.log('### record', JSON.stringify(obj));
}


exports.set_transcriptdir = set_transcriptdir;
exports.set_metadata = set_metadata;
exports.record_update = record_update;
