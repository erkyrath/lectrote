'use strict';

const Story = require('./inkjs/ink.cjs.js').Story;

var story = null;

function load_run(dummy, src)
{
    /* First we strip the BOM, if there is one. Dunno why ink can't deal
       with a BOM in JSON data, but okay. */
    src = src.replace(/^\uFEFF/, '');

    story = new Story(src);
    window.story = story; //### export for debugging
}

function get_game_signature()
{
    return 'XXX'; //###
}

function get_metadata(key)
{
    return null;
}

window.GiLoad = {
    load_run: load_run,
    get_metadata: get_metadata,
    get_game_signature: get_game_signature,
};
