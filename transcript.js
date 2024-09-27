'use strict';
const electron = require('electron');
const fs = require('fs');
const fsp = require('fs/promises');
const path_mod = require('path');

const traread = require('./traread.js');

var darklight_flag = false;

var transcriptdir = null;
var tralist = []; // filenames, ordered by modtime
var tramap = new Map(); // maps filenames to data

var dirmodtime = null; // last time we checked the dir timestamp
var reading_dir = false; // set while in the middle of get_transcript_info()

var curselected = null;

function set_dir_path(dir)
{
    transcriptdir = dir;
    reload_transcripts();
}

/* Read the list of transcript files, grabbing the metadata for each
   (if possible).
*/
function reload_transcripts()
{
    //### should only call rebuild_list() if the list has materially changed (order, size, any modtimes)
    
    if (!transcriptdir) {
        return;
    }

    if (reading_dir) {
        // async op in progress; let that finish.
        return;
    }
    
    get_transcript_info()
        .then((ls) => {
            if (ls === null)
                return;
            tramap.clear();
            tralist.length = 0;
            for (var obj of ls) {
                tralist.push(obj.filename);
                tramap.set(obj.filename, obj);
            }
            tralist.sort( (o1, o2) => (tramap.get(o2).modtime - tramap.get(o1).modtime) );
            rebuild_list();
        })
        .catch((ex) => {
            console.log('get_transcript_info failed:', ex);
        });
}

async function get_transcript_info()
{
    async function readone(filename) {
        var path = path_mod.join(transcriptdir, filename);
        var stat = await fsp.stat(path);
        if (!stat.isFile()) {
            throw new Error('not a file');
        }
        
        var res = { 'title': '???' };
        
        var iter = traread.stanza_reader(path);
        for await (var obj of iter) {
            if (obj.timestamp) {
                res.starttime = obj.timestamp;
            }
            if (obj.metadata) {
                Object.assign(res, obj.metadata);
            }
            // break after the first stanza, regardless
            iter.return();
            break;
        }
        
        res.modtime = stat.mtime.getTime();
        res.filesize = stat.size;
        res.filename = filename;
        res.filepath = path;
        return res;
    }

    if (reading_dir) {
        return null;
    }
    reading_dir = true;

    try {
        try {
            var stat = await fsp.stat(transcriptdir);
            dirmodtime = stat.mtime;
        }
        catch (ex) {
            // It's not an error for the transcript dir to not exist yet.
            return null;
        }
        
        var ls = await fsp.readdir(transcriptdir);
        
        var reqs = []; // array of Promises
        for (var filename of ls) {
            if (filename.endsWith('.glktra')) {
                reqs.push(readone(filename));
            }
        }
        
        var settled = await Promise.allSettled(reqs);
        var results = [];
        for (var obj of settled) {
            if (obj.status == 'fulfilled') {
                results.push(obj.value);
            }
        }
        
        return results;
    }
    finally {
        reading_dir = false;
    }
}

function format_timestamp(val)
{
    var date = new Date(val);
    var res = date.toTimeString().slice(0, 5) + ', ' + date.toDateString().slice(4);
    return res;
}

var idmap = new Map();

function id_for_filename(filename)
{
    var id = idmap.get(filename);
    if (!id) {
        id = 'entry_' + idmap.size;
        idmap.set(filename, id);
    }
    return id;
}

/* Recreate the displayed list of transcript entries.
*/
function rebuild_list()
{
    var listel = $('#list');
    listel.empty();

    var foundselected = false;

    for (var filename of tralist) {
        var obj = tramap.get(filename);

        var parel = $('<div>', { 'class':'EntryBox' });
        var el = $('<div>', { 'class':'Entry', id:id_for_filename(filename) });
        if (filename == curselected) {
            el.addClass('Selected');
            foundselected = true;
        }

        var subel = $('<div>', { 'class':'Data' });
        subel.append($('<span>', { 'class':'Title' }).text(obj.title ?? '???'));
        if (obj.author) {
            subel.append($('<span>', { 'class':'' }).text(' \u2014 '));
            subel.append($('<span>', { 'class':'' }).text(obj.author));
        }
        el.append(subel);

        var subel = $('<div>', { 'class':'Data' });
        var modstr = format_timestamp(obj.modtime);
        subel.append($('<span>', { 'class':'Label' }).text('updated: '));
        subel.append($('<span>', { 'class':'' }).text(modstr));
        if (obj.starttime) {
            var startstr = format_timestamp(obj.starttime);
            subel.append($('<span>', { 'class':'' }).text(' \xA0 '));
            subel.append($('<span>', { 'class':'Label' }).text('created: '));
            subel.append($('<span>', { 'class':'' }).text(startstr));
        }
        el.append(subel);

        var butel = $('<button>');
        butel.text('Open');
        butel.on('click', { filename:filename }, evhan_open_transcript);
        el.append(butel);
        
        el.on('click', { filename:filename }, evhan_set_selection);

        parel.append(el);
        listel.append(parel);
    }

    if (!foundselected) {
        curselected = null;
    }
}

/* Check to see if the transcript directory has changed. This will notice
   if a file is added or deleted. (But not if an existing transcript file
   has been extended.)

   Called once per second.
*/
function timer_watchdirtime()
{
    if (!transcriptdir)
        return;

    var stat = null;
    try {
        stat = fs.statSync(transcriptdir);
    }
    catch (ex) {
        return;
    }

    if (dirmodtime === null || dirmodtime < stat.mtime) {
        reload_transcripts();
    }
}

function evhan_open_transcript(ev)
{
    electron.ipcRenderer.send('open_transcript', ev.data.filename);
}

function evhan_set_selection(ev)
{
    ev.stopPropagation();
    ev.preventDefault();

    if (curselected) {
        var id = id_for_filename(curselected);
        var el = $('#'+id);
        if (el.length)
            el.removeClass('Selected');
    }

    curselected = ev.data.filename;
    
    if (curselected) {
        var id = id_for_filename(curselected);
        var el = $('#'+id);
        if (el.length)
            el.addClass('Selected');
        else
            curselected = null;
    }

    electron.ipcRenderer.send('set_selected_transcript', curselected);
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
electron.ipcRenderer.on('reload_transcripts', function(ev, arg) {
    reload_transcripts();
});
electron.ipcRenderer.on('set-darklight-mode', function(ev, arg) {
    apply_darklight(arg);
});
electron.ipcRenderer.on('on-focus', function(ev, arg) {
    var el = $('body');
    if (arg) {
        el.removeClass('InBackground');
    }
    else {
        el.addClass('InBackground');
    }
});

$(document).on('ready', function() {
    $('#list').on('click', { filename:null }, evhan_set_selection);

    setInterval(timer_watchdirtime, 1000); // every second
});
