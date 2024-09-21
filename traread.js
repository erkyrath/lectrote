'use strict';

const fsp = require('fs/promises');

/* Read a file as a sequence of newline-separated JSON stanzas.

   A partial stanza at the end will be silently ignored.

   It's okay if the JSON has more whitespace or newlines. You just need
   at least one newline between stanzas.

   If non-JSON occurs at the start or between stanzas, this will throw
   an exception. Bad formatting inside a stanza will silently end the
   parsing (after reading in the entire rest of the file). No, that's not
   ideal.
   
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
                var res = await fhan.read(buf, buflen, CHUNK);
                if (res.bytesRead == 0) {
                    await fhan.close();
                    fhan = null;
                    return; // end of file
                }
                buflen += res.bytesRead;
            }
            
            // pos is now on the first non-whitespace; trim everything before tthat. (We should have nonzero text left.)
            buf = buf.subarray(pos);
            buflen -= pos;

            if (buflen == 0) {
                throw new Error('assert: should have text after eating whitespace');
            }

            if (buf[0] != 0x7B) {  // '{'
                // The next text is not a JSON stanza. That's bad.
                throw new Error('non-JSON encountered');
            }

            pos = 0;
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
                    var res = await fhan.read(buf, buflen, CHUNK);
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


exports.stanza_reader = stanza_reader;