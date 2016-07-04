'use strict';

const Story = require('./inkjs/ink.cjs.js').Story;

function load_run(dummy, arr)
{
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
