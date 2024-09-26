'use strict';

const fs = require('fs');
const path_mod = require('path');

var transcriptdir = null;
var metadata = null;

var path = null;
var fd = null;

function set_transcriptdir(path)
{
    transcriptdir = path;

    /* We try to create a directory for transcripts at init time.
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
    metadata = Object.assign({}, obj); // copy
    console.log('### metadata', metadata); //###
}

function record_update(obj)
{
    if (path === null) {
        // First time! Open the file.
        var writemeta = false;
        //TODO: more human-readable filenames would be great, but saving that in the autorestore info is hard.
        path = path_mod.join(transcriptdir, obj.sessionId+'.glktra');
        try {
            // Will fail if path already exists.
            fd = fs.openSync(path, "ax");
            writemeta = true;
        }
        catch (ex) {
            // We are appending to an existing file.
            try {
                fd = fs.openSync(path, "a");
            }
            catch (ex) {
                // Could not open transcript at all.
            }
        }
        if (fd === null) {
            console.log('Could not open auto-transcript file', path);
            return;
        }
        
        if (writemeta && metadata != null) {
            var metaobj = {
                metadata: metadata,
                timestamp: (new Date().getTime())
            };
            fs.writeSync(fd, JSON.stringify(metaobj)+'\n');
        }
    }

    if (fd === null)
        return;

    fs.writeSync(fd, JSON.stringify(obj)+'\n');
}


exports.set_transcriptdir = set_transcriptdir;
exports.set_metadata = set_metadata;
exports.record_update = record_update;
