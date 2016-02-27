# Lectrote
<img style="float:right;" src="icon-128.png" alt="Lectrote logo: purple compass">
## The [Quixe][]/GlkOte IF interpreter in an [Electron][] shell

- Version 0.2.0
- Created by Andrew Plotkin <erkyrath@eblong.com>

[Quixe]: http://eblong.com/zarf/glulx/quixe/
[Electron]: http://electron.atom.io
[Node]: http://nodejs.org

Basically, this is a way to package up the Chromium browser and the Quixe IF interpreter as a Mac/Win/Linux app.

This version acts as a general Glulx interpreter. When launched, it prompts you to select a Glulx game file (`.ulx` or `.gblorb`) to play. You can play several games at the same time in separate windows.

Because this relies on the Quixe interpreter, sound is not supported. It's also not as fast as a native interpreter.

## But what about packaged games?

The goal of this project is to let authors make Mac, Windows, and Linux apps out of their Inform games.

I do not yet have all the pieces in place. In particular, a packaged game absolutely has to support auto-save. If the player quits the app and then launches it again, they should be back where they left off. Quixe does not yet support this feature, but I plan to add it.

## For developers

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

### Packaging Lectrote

The `makedist.py` script builds the zip files which you see on the [release page][release]. (Yes, it is silly to use a Python packaging script in a Node.js package. Maybe I'll rewrite it into Javascript. Later.) 

[release]: https://github.com/erkyrath/lectrote/releases

    python3 makedist.py

This creates build directories and then zip files in a "dist" directory. Add `-b` to *only* generate the build dirs; `-z` to transform existing build dirs into zip files.

You can add arguments to narrow down the platforms you are building, e.g.:

    python3 makedist.py darwin
    python3 makedist.py win32
    python3 makedist.py linux
    python3 makedist.py win32-x64

**Note:** This currently requires a custom version of the `electron-packager`, because the Mac package requires features not in the main release. I have submitted a patch. For the moment, use [the zarf branch of this repository][packagerzarf].

[packagerzarf]: https://github.com/erkyrath/electron-packager/tree/zarf

