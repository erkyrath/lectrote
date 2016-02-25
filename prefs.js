
function setup_with_prefs(prefs)
{
    var sel, optel;

    sel = $('#sel-color-theme');
    sel.prop('disabled', false);
    sel.empty();
    optel = $('<option>', { value:'light' }).text('Light');
    if (prefs.gamewin_colortheme == 'light')
        optel.prop('selected', true);
    sel.append(optel);
    optel = $('<option>', { value:'dark' }).text('Dark');
    if (prefs.gamewin_colortheme == 'dark')
        optel.prop('selected', true);
    sel.append(optel);

    sel.on('change', evhan_color_theme);
    apply_color_theme(prefs.gamewin_colortheme);
}

function evhan_color_theme()
{
    var sel = $('#sel-color-theme');
    var val = sel.val();
    apply_color_theme(val);
}

function apply_color_theme(val)
{
    var bodyel = $('.Sample');

    if (val == 'dark') {
        if (!bodyel.hasClass('DarkTheme'))
            bodyel.addClass('DarkTheme');
    }
    else {
        bodyel.removeClass('DarkTheme');
    }
}

require('electron').ipcRenderer.on('current-prefs', function(ev, arg) {
        setup_with_prefs(arg);
});
