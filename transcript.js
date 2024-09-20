'use strict';
const electron = require('electron');
const fs = require('fs');
const fsp = require('fs/promises');
const path_mod = require('path');

var darklight_flag = false;

var transcriptdir = null;
var tmap = new Map();

function set_dir_path(dir)
{
    transcriptdir = dir;
    reload_transcripts();
}

function reload_transcripts()
{
    tmap.clear();
    //### should be async with a guard flag
    
    if (transcriptdir) {
        try {
            var ls = fs.readdirSync(transcriptdir);
            for (var filename of ls) {
                if (filename.endsWith('.glktra')) {
                    //### try, store return value
                    try {
                        load_transcript_info(filename);
                    }
                    catch (ex) {
                        throw ex; //###
                    }
                }
            }
        }
        catch (ex) {}
    }
}

function load_transcript_info(filename)
{
    var path = path_mod.join(transcriptdir, filename);
    console.log('### reading path', path);

    async function readall(path) {
        for await (var obj of stanza_reader(path)) {
            console.log('### stanza', obj);
        }
    }

    readall(path)
        .then(() => { console.log('### done'); })
        .catch((ex) => { console.log('### ex', ex); });
}

async function* stanza_reader(path)
{
    const CHUNK = 128;
    
    var buf = Buffer.alloc(CHUNK);
    var buflen = 0;
    
    var fhan = await fsp.open(path, "r");

    while (true) {
        // eat whitespace
        var pos = 0;
        while (true) {
            while (pos < buflen
                   && (buf[pos] == 0x20 || buf[pos] == 0x0A || buf[pos] == 0x0D || buf[pos] == 0x09)) {   // whitespaces
                pos++;
            }
            if (pos < buflen) {
                break;
            }
            // ate whitespace to end of buffer; read a chunk and keep eating
            if (buflen+CHUNK > buf.length) {
                var newlen = buflen + CHUNK;
                buf = Buffer.concat([buf], newlen);
            }
            var res = await fhan.read(buf, buflen, CHUNK);
            if (res.bytesRead == 0) {
                await fhan.close();
                return; // end of file
            }
            buflen += res.bytesRead;
        }
        
        // pos is now on non-whitespace; trim that. (We should have nonzero text left after that.)
        buf = buf.subarray(pos);
        buflen -= pos;

        if (buflen == 0) {
            throw new Error('assert: should have text after eating whitespace');
        }

        if (buf[0] != 0x7B) {  // '{'
            // The next text is not a JSON stanza. That's bad.
            throw new Error('non-JSON encountered');
        }

        var obj = null;
        
        while (true) {
            // search for the next newline
            while (true) {
                while (pos < buflen && buf[pos] != '\n') {
                    pos++;
                }
                if (pos < buflen) {
                    break;
                }
                // ate non-newlines to end of buffer; read a chunk and keep eating
                if (buflen+CHUNK > buf.length) {
                    var newlen = buflen + CHUNK;
                    buf = Buffer.concat([buf], newlen);
                }
                var res = await fhan.read(buf, buflen, CHUNK);
                if (res.bytesRead == 0) {
                    await fhan.close();
                    return; // end of file
                    // We probably have an incomplete JSON stanza in the buffer, but we ignore that.
                }
                buflen += res.bytesRead;
            }

            // pos is now on a newline. Eat that, then check to see if we've got a complete stanza.
            pos++;
            var str = buf.toString('utf8', 0, pos);
            console.log('### trying str:', str);
            try {
                obj = JSON.parse(str);
                console.log('### valid obj:', obj);
                break;
            }
            catch (ex) {
                // Nope, look for the next newline
                continue;
            }
        }

        if (obj === null) {
            throw new Error('assert: left loop without object');
        }
        
        // Trim buffer, yield, and continue
        buf = buf.subarray(pos);
        buflen =- pos;
        yield obj;
    }
}

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

electron.ipcRenderer.on('set-dir-path', function(ev, arg) {
    set_dir_path(arg);
});
electron.ipcRenderer.on('set-darklight-mode', function(ev, arg) {
    apply_darklight(arg);
});
