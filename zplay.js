'use strict';

/* Launch the game. The buf argument must be a Node Buffer.
 */
function load_run(optobj, buf)
{
    parchment.load_library();
}

function get_metadata(key)
{
    return null;
}

window.GiLoad = {
    load_run: load_run,
    get_metadata: get_metadata,
};
