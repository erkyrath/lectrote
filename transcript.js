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

var curselected = null;

function set_dir_path(dir)
{
    transcriptdir = dir;
    reload_transcripts();
}

function reload_transcripts()
{
    //### should only call rebuild_list() if the list has materially changed (order, size, any modtimes)
    //### after rebuilding the list, set the cached dir timestamp
    
    if (!transcriptdir) {
        return;
    }
    
    get_transcript_info()
        .then((ls) => {
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
    var ls = await fsp.readdir(transcriptdir);

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

function format_timestamp(val)
{
    var date = new Date();
    date.setTime(val);

    var res = date.toDateString().slice(4);
    res = res + ' ' + date.toTimeString().slice(0, 8);
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

function rebuild_list()
{
    var listel = $('#list');
    listel.empty();

    for (var filename of tralist) {
        var obj = tramap.get(filename);

        var parel = $('<div>', { 'class':'EntryBox' });
        var el = $('<div>', { 'class':'Entry', id:id_for_filename(filename) });
        if (filename == curselected)
            el.addClass('Selected');

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

        el.on('click', { filename:filename }, evhan_set_selection);

        parel.append(el);
        listel.append(parel);
    }
}

function evhan_open_transcript()
{
    if (!curselected)
        return;

    electron.ipcRenderer.send('open_transcript', curselected);
}

function evhan_delete_transcript()
{
    if (!curselected)
        return;

    console.log('### delete', curselected);
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

    $('#openbutton').prop('disabled', (curselected == null));
    $('#deletebutton').prop('disabled', (curselected == null));
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
    //### kick off a timer (two seconds?) which watches the dir timestamp
    $('#list').on('click', { filename:null }, evhan_set_selection);
    $('#openbutton').on('click', evhan_open_transcript);
    $('#deletebutton').on('click', evhan_delete_transcript);
});
