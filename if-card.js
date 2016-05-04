'use strict';

/* These are the values defined in main.js, not in the HTML. */
const base_width = 810;
const base_height = 600;

function evhan_resize(ev)
{
    var width = $(window).width();
    var height = $(window).height();

    var ratio = Math.min(width / base_width, height / base_height);

    if (ratio < 1.0)
        $('#card').css('transform', '');
    else
        $('#card').css('transform', 'scale('+ratio+','+ratio+')');
}

$(document).ready(function() {
    $('#card').css('transform-origin', 'top left');
    $('#card').css('margin-left', '10px');
    $(window).on('resize', evhan_resize);
});
