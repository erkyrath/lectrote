# Lectrote
<img style="float:right;" src="icon-128.png" alt="Lectrote logo: purple compass">
### The [Quixe][]/GlkOte IF interpreter in an [Electron][] shell

- Version 1.0.5
- Created by Andrew Plotkin <erkyrath@eblong.com>

[Quixe]: http://eblong.com/zarf/glulx/quixe/
[Electron]: http://electron.atom.io
[Node]: http://nodejs.org

Basically, this is a way to package up the Chromium browser and the Quixe IF interpreter as a Mac/Win/Linux app.

This version acts as a general Glulx interpreter. When launched, it prompts you to select a Glulx game file (`.ulx` or `.gblorb`) to play. You can play several games at the same time in separate windows.

Because this relies on the Quixe interpreter, sound is not supported. It's also not as fast as a native interpreter.

You can also use this package to construct a "bound game" -- an app which plays a single built-in Glulx game. This is a package containing Chromium, Quixe, your game file, and perhaps some additional configuration.

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

This creates build directories and then zip files in a "dist" directory. Add `-b` to *only* generate the build dirs; `-z` to transform existing build dirs into zip files.

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
- `lectrotePackagedGame`: Pathname to the Glulx game file.
- `lectroteExtraFiles`: An array of extra files to include. These are assumed to be in the game directory, so you do not have to include the directory prefix. (This list must include the Glulx game file -- yes, it's redundant with `lectrotePackagedGame`.)
- `lectroteMacAppID`: If you plan to build a MacOS app, a reverse-DNS ID string to uniquely identify it.
- `lectroteCopyright`: Copyright string (applied to Windows binaries).

(Do not change `lectroteVersion`; that should always show the Lectrote release that you built your bound app from.)

You may also copy any of Lectrote's content files to your game directory and customize them. You will probably want to customize `about.html`, for example.

The `samplegame` directory in the Lectrote source demonstrates the layout. It will be simplest to clone that and alter it.

Once your files are ready, do:

    python3 makedist.py --game GAMEDIR

This will build and package apps for all platforms. (You can test this out of the box by using `samplegame` for the GAMEDIR.) As noted above, you can cut down the stages or targets with the `-b`, `-z` options or by naming platforms.

You cannot launch a bound game by typing `npm start`.

### Customizing your bound app

As noted, you can copy `play.html`, `el-glkote.css`, or other Lectrote files into your gamedir and customize them. When packaging with the `--game` option, files found in the gamedir will replace normal Lectrote files.

If you add new files (not replacing Lectrote files), be sure to list them in the `lectroteExtraFiles` array.

You can extend the functionality of the app -- for example, adding or removing menu items. Add a Javascript file to your gamedir, and name it in your `package.json` file:

	"lectroteMainExtension": "GAMEDIR/FILE.js",

(And add it to `lectroteExtraFiles` as well.)

This file can define new functionality by exporting any of three Javascript functions. For example, you could say:

	exports.launch = function() { ... }

- `exports.launch()`: Called when the app starts up.
- `exports.app_ready()`: Called when the app is ready to open windows. At this point the game window has already been opened.
- `exports.construct_menu_template(template, special)`: Called to customize the app menu template. The `template` argument is a Javascript data structure as described in [the Electron Menu docs][elemenu]. `special` is null for the game window, or one of the strings `"about", "prefs", "card"` for one of Lectrote's special windows. Modify `template` and return it.

[elemenu]: http://electron.atom.io/docs/latest/api/menu/

The main Lectrote module exports several functions you can use in your extension code. I have not yet documented them; see the `main.js` file.
