'use strict';

/* Convert font preference strings into a CSS font-family value. */
function get_fontline(fontkey, customfont)
{
    var fontline = null;

    switch (fontkey) {
    case 'custom':
        /* We try to be conservative, since the player can enter anything
           at all for the customfont. We remove dangerous characters,
           split at commas, and then put quotes around each bit.
           (Dangerous characters in the CSS sense: quotes, backslashes,
           curly braces, and newlines. We don't worry about HTML special
           characters; the value will be installed with jQuery el.text()
           so &-escapes are not needed.) */
        if (!customfont) {
            fontline = 'monospace';
            break;
        }
        var val = customfont.replace(/\s/g, ' ');
        val = val.replace(/[""\\{}]/g, '');
        var ls = val.split(',');
        ls = ls.map(val => ('"' + val.trim() + '"'));
        ls = ls.filter(val => (val.length > 2));
        ls.push('monospace');
        fontline = ls.join(', ');
        break;
    case 'georgia':
        fontline = 'Georgia, Cambria, serif';
        break;
    case 'helvetica':
        fontline = '"Helvetica Neue", Helvetica, Arial, sans-serif';
        break;
    case 'gentium':
        fontline = '"Gentium Book Basic", Georgia, Cambria, serif';
        break;
    case 'baskerville':
        fontline = '"Libre Baskerville", Palatino, Georgia, serif';
        break;
    case 'sourcesanspro':
        fontline = '"Source Sans Pro", Helvetica, Arial, sans-serif';
        break;
    case 'courier':
        fontline = 'Courier, monospace';
        break;
    case 'lora':
    default:
        fontline = null;
        break;
    }

    return fontline;
}

exports.get_fontline = get_fontline;
