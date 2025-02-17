'use strict';

const fsp = require('fs/promises');

/* Transcript utility functions. These are used by both the main process
   and the game render process.
*/

/* Read a file as a sequence of newline-separated JSON stanzas.

   A partial stanza at the end will be silently ignored.

   It's okay if the JSON has more whitespace or newlines. You just need
   at least one newline between stanzas.

   If non-JSON occurs at the start or between stanzas, this will throw
   an exception. Bad formatting inside a stanza will silently end the
   parsing (after reading in the entire rest of the file). No, that's not
   ideal.

   We add obj._stanzastart, obj._stanzaend fields to the returned stanzas.
   These are file positions in the file, handy for reloading additions
   later.
   
   This is an async generator (fancy!) You can use it in the following
   ways:

       for await (var obj of stanza_reader(path)) { ... }

       var iter = stanza_reader(path);
       for await (var obj of iter) { ... }
       
       var iter = stanza_reader(path);
       var res = await iter.next();
       while (!res.done) {
           // ...
           res = await iter.next();
       }

   If you want to stop reading early, you must use the iterator form so
   that you can call iter.return(). (This cleans up the file handle;
   you don't want to leak that.)
 */
async function* stanza_reader(path)
{
    const CHUNK = 512;
    
    var buf = Buffer.alloc(CHUNK);
    var buflen = 0; // amount of unconsumed text in buf
    
    var fhan = await fsp.open(path, "r");
    var buffilepos = 0; // file position of buf
    // buffilepos+pos will be our real file position

    try {
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
                var res = await fhan.read(buf, buflen, CHUNK, buffilepos+buflen);
                if (res.bytesRead == 0) {
                    await fhan.close();
                    fhan = null;
                    return; // end of file
                }
                buflen += res.bytesRead;
            }
            
            // pos is now on the first non-whitespace; trim everything before tthat. (We should have nonzero text left.)
            buf = buf.subarray(pos);
            buffilepos += pos;
            buflen -= pos;

            if (buflen == 0) {
                throw new Error('assert: should have text after eating whitespace');
            }

            if (buf[0] != 0x7B) {  // '{'
                // The next text is not a JSON stanza. That's bad.
                throw new Error('non-JSON encountered');
            }

            pos = 0;
            var stanzastart = buffilepos;
            var obj = null;
            
            while (true) {
                // search for the next newline
                while (true) {
                    while (pos < buflen && (buf[pos] != 0x0A && buf[pos] != 0x0D)) {
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
                    var res = await fhan.read(buf, buflen, CHUNK, buffilepos+buflen);
                    if (res.bytesRead == 0) {
                        await fhan.close();
                        fhan = null;
                        return; // end of file
                        // We probably have an incomplete JSON stanza in the buffer, but we ignore that.
                    }
                    buflen += res.bytesRead;
                }

                // pos is now on a newline. Eat that, then check to see if we've got a complete stanza.
                pos++;
                var str = buf.toString('utf8', 0, pos);
                try {
                    obj = JSON.parse(str);
                    obj._stanzastart = stanzastart;
                    obj._stanzaend = buffilepos+pos;
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
            buffilepos += pos;
            buflen -= pos;
            yield obj;
            // We return from here if the caller calls iter.return().
        }
    }
    finally {
        // If we throw or return early...
        if (fhan !== null) {
            await fhan.close();
            fhan = null;
        }
    }
}

/* Metadata keys that we are interested in, in the order we are interested
   in them. */
const metadata_keylist = [
    'title', 'author', 'headline', 'firstpublished',
    'ifid', 'format', 'tuid'
];

/* Parse a transcript file and write a plain-text equivalent to a new file.

   This is a JS port of the read-glktra.py utility in the GlkOte repo.
   
   See add_stanza() etc in trashow.js for a similar implementation. Yes,
   there's a refactor opportunity here.

   Differences:
   - We only pay attention to buffer windows. The status line (assuming
     that's a grid) is lost.
   - If there's more than one buffer window, the output is interleaved
     in a single display stream.
   - Window-clear events are shown as horizontal rules.
   - Graphics are currently not supported. (Not even the alt text.)
 */
async function stanzas_write_to_file(path, trapath, options)
{
    var fhan = null;

    async function add_stanza(obj)
    {
        if (obj.metadata) {
            var anylines = false;
            for (var key of metadata_keylist) {
                if (obj.metadata[key]) {
                    if (!anylines) {
                        anylines = true;
                        await fhan.write(('--'.repeat(36)) + '-\n');
                    }
                    var val = key + ': ' + obj.metadata[key] + '\n';
                    await fhan.write(val);
                }
            }
            if (anylines)
                await fhan.write(('--'.repeat(36)) + '-\n');
        }
        if (obj.output) {
            if (options && options.timestamps) {
                var date = new Date(obj.timestamp);
                var intimestr = date.toTimeString().slice(0, 8) + ', ' + date.toDateString().slice(4);
                var durstr = ': ' + (obj.outtimestamp - obj.timestamp) + ' ms';
                await fhan.write('[' + intimestr + durstr + '] ');
            }
            if (obj.output.content) {
                for (var dat of obj.output.content) {
                    if (dat.text) {
                        if (dat.clear) {
                            await fhan.write('\n' + ('- '.repeat(36)) + '-\n');
                        }
                        if (dat.text) {
                            await add_stanza_linedata(dat.text);
                        }
                    }
                }
            }
        }
    }

    async function add_stanza_linedata(text)
    {
        for (let ix=0; ix<text.length; ix++) {
            const textarg = text[ix];
            const content = textarg.content;
            if (textarg.append) {
                if (!content || !content.length)
                    continue;
            }
            else {
                await fhan.write('\n');
            }
            // skip textarg.flowbreak for now
            if (!content || !content.length) {
                continue;
            }

            for (let sx=0; sx<content.length; sx++) {
                const rdesc = content[sx];
                let rstyle, rtext, rlink;
                if (!(typeof rdesc === 'string' || rdesc instanceof String)) {
                    if (rdesc.special !== undefined) {
                        if (rdesc.special == 'image') {
                            var val;
                            if (rdesc.alttext)
                                val = '[image: ' + rdesc.alttext + ']';
                            else
                                val = '[image ' + rdesc.image + ']';
                            await fhan.write(val);
                        }
                        continue;
                    }
                    rstyle = rdesc.style;
                    rtext = rdesc.text;
                    rlink = rdesc.hyperlink;
                }
                else {
                    rstyle = rdesc;
                    sx++;
                    rtext = content[sx];
                    rlink = undefined;
                }
                // ignore rlink
                await fhan.write(rtext);
            }
        }
    }

    try {
        fhan = await fsp.open(path, "w");
        
        for await (var obj of stanza_reader(trapath)) {
            await add_stanza(obj);
        }
        
        await fhan.write('\n');
    }
    finally {
        // If we throw or return early...
        if (fhan !== null) {
            await fhan.close();
            fhan = null;
        }
    }
}

exports.stanza_reader = stanza_reader;
exports.stanzas_write_to_file = stanzas_write_to_file;
exports.metadata_keylist = metadata_keylist;
