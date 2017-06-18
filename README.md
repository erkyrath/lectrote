# Lectrote
<img style="float:right;" src="icon-128.png" alt="Lectrote logo: purple compass">

### The IF interpreter in an [Electron][] shell

- Version 1.2.5
- Created by Andrew Plotkin <erkyrath@eblong.com>
- [Download the latest Lectrote app][releases]

[Electron]: http://electron.atom.io
[Node]: http://nodejs.org
[releases]: https://github.com/erkyrath/lectrote/releases

Lectrote packages up IF interpreters with the Chromium browser as a [Mac/Win/Linux app][releases].

When launched, it prompts you to select a game file to play. You can play several games at the same time in separate windows. Your position is always autosaved; when you launch a game, your last play session will automatically be resumed.

Lectrote currently supports:

- [Glulx][] games (`.ulx` or `.gblorb`), as produced by [Inform 7][i7].
- [Z-code][] games (`.z3/.z4/.z5/.z8` or `.zblorb`), as produced by [Inform 7][i7] or earlier versions of Inform.
- [Hugo][] games (`.hex`).
- [Ink][] compiled game files (`.json`), as produced by the [Ink][] scripting language.

[i7]: http://inform7.com/
[Glulx]: http://eblong.com/zarf/glulx/
[Hugo]: http://www.generalcoffee.com/hugo/gethugo.html
[Ink]: http://www.inklestudios.com/ink
[Z-code]: http://inform-fiction.org/zmachine/standards/z1point1

You can also use this package to construct a "bound game" -- an app which plays a single built-in game. This is a package containing Chromium, the interpreter, your game file, and perhaps some additional configuration. You can distribute this as a standalone game application; it's bulky but it lets people play your game.

## Glulx (Inform 7) support

Because this relies on the [Quixe][] interpreter, sound is not supported. It's also not as fast as a native interpreter.

[Quixe]: http://eblong.com/zarf/glulx/quixe/

## Z-code support

Lectrote uses the [ZVM][] interpreter for Z-machine support. (V3/4/5 and V8 only.)

[ZVM]: https://github.com/curiousdannii/ifvms.js

## Hugo support

The Hugo engine does not currently support autosave.

## Ink support

This relies on the [inkjs][] interpreter. It is a deliberately non-fancy presentation -- no attempt to slow-print the output or hide the choice list.

[inkjs]: https://github.com/y-lohse/inkjs

# For developers

If you've just downloaded the source code for this puppy, it's easy to make a runnable version.

First, you need to have the [Node][] development tools installed. Everything relies on the `npm` command-line tool. See [Installing Node.js via package manager][npminstall].

[npminstall]: https://nodejs.org/en/download/package-manager/

To fetch all the necessary Node packages and place them in a `node_modules` directory:

    npm install

This command also fetches the Quixe submodule (which will live in the `quixe` directory). You must have `git` installed for this to work.

Now just type

    npm start

...to launch the app.

When run this way, the app will show up named as "Electron", not "Lectrote".

## Packaging Lectrote

The `makedist.py` script builds the zip files which you see on the [release page][release]. (Yes, it is silly to use a Python packaging script in a Node.js package. Maybe I'll rewrite it into Javascript. Later.) 

[release]: https://github.com/erkyrath/lectrote/releases

    python3 makedist.py

This creates build directories and then zip files in a `dist` directory. Add `-b` to *only* generate the build dirs; `-z` to transform existing build dirs into zip files.

You can add arguments to narrow down the platforms you are building, e.g.:

    python3 makedist.py darwin
    python3 makedist.py win32
    python3 makedist.py linux
    python3 makedist.py win32-x64

If you want to code-sign the Mac version, you currently have to do it manually between the `-b` and `-z` steps. Yes, I should add an option for this.

## Packaging a bound game

You will need to create a separate directory for your game's files. Copy `package.json` to the directory, adding or modifying these lines:

- `name`: A node package name. This is not used anywhere, so it doesn't really matter.
- `productName`: The display name for the app.
- `version`: Version number of your game.
- `author`: You, the game's author.
- `description`: One-line description of your game.
- `lectrotePackagedGame`: Pathname to the game file.
- `lectroteSoleInterpreter`: Set to `"glulx"`, `"ifvms"`, `"hugo"`, or `"inkjs"` to include just one of Lectrote's interpreter engines. (Optional, but it saves a little bit of space.)
- `lectroteExtraFiles`: An array of extra files to include. These are assumed to be in the game directory, so you do not have to include the directory prefix. (This list must include the game file -- yes, it's redundant with `lectrotePackagedGame`.)
- `lectroteMacAppID`: If you plan to build a MacOS app, a reverse-DNS ID string to uniquely identify it.
- `lectroteCopyright`: Copyright string (applied to Windows binaries).

(Do not change `lectroteVersion`; that should always show the Lectrote release that you built your bound app from.)

You may also copy any of Lectrote's content files to your game directory and customize them. You will probably want to customize `about.html`, for example.

The `samplegame` directory in the Lectrote source demonstrates the layout. It will be simplest to clone that and alter it.

Once your files are ready, do:

    python3 makedist.py --game GAMEDIR

This will build and package apps for all platforms. (You can test this out of the box by using `samplegame` for the GAMEDIR.) As noted above, you can cut down the stages or targets with the `-b`, `-z` options or by naming platforms.

You cannot launch a bound game by typing `npm start`. You have to package it, at least to the `-b` stage, and run it from the `dist` directory.

### Customizing your bound app

As noted, you can copy `play.html`, `el-glkote.css`, or other Lectrote files into your gamedir and customize them. When packaging with the `--game` option, files found in the gamedir will replace normal Lectrote files.

If you add new files (not replacing Lectrote files), be sure to list them in the `lectroteExtraFiles` array.

You can extend the functionality of the app -- for example, adding or removing menu items. Add a Javascript file to your gamedir, and name it in your `package.json` file:

    "lectroteMainExtension": "GAMEDIR/FILE.js",

(And add it to `lectroteExtraFiles` as well.)

This file can define new functionality by exporting any of the following Javascript functions. For example, you could say:

    exports.launch = function() { ... }

- `exports.launch()`: Called when the app starts up.
- `exports.app_ready()`: Called when the app is ready to open windows. At this point the game window has already been opened.
- `exports.construct_menu_template(template, special)`: Called to customize the app menu template. The `template` argument is a Javascript data structure as described in [the Electron Menu docs][elemenu]. `special` is null for the game window, or one of the strings `"about", "prefs", "card"` for one of Lectrote's special windows. Modify `template` and return it.
- `exports.set_zoom_factor(val)`: Called when the app's zoom level changes. The argument is suitable for Electron's `setZoomFactor()` method.
- `exports.export_game_path()`: The bound app normally has an "Export Portable Game File..." menu option, which lets the user extract your game file for use in other interpreters. You can implement this function and return null to suppress this menu option. You can also return the pathname of a different game file, which is not actually a useful thing to do.
- `exports.about_window_size`: An object `{ width:W, height:H }` which customizes the size of the about.html window. (Defaults to `{ width:600, height:450 }`.)

[elemenu]: http://electron.atom.io/docs/latest/api/menu/

The main Lectrote module exports several functions you can use in your extension code. I have not yet documented them; see the `main.js` file.

