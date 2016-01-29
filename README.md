# Lectrote
<img style="float:right;" src="icon-128.png" alt="Lectrote logo: purple compass">
## The [Quixe][]/GlkOte IF interpreter in an [Electron][] shell

- Version 0.1.1
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

You must also fetch the Quixe engine (which will live in the `quixe` directory):

    git submodule init
    git submodule update

Now just type

    npm start

...to launch the app.

When run this way, the app will show up named as "Electron", not "Lectrote".

### Packaging

There are NPM run scripts for packaging Lectrote for distribution.

`npm run package:osx` builds the OSX app and packages it in .DMG file.  It goes into `dist/lectrote.dmg`.

NOTE: I did OSX first because that's the machine I have access to today.  Windows & Linux later.

There are also some utility scripts for recreating the image assets based on `icon.svg`.

`npm run makeicns` rebuilds the `lectrote.icns` file from icon.svg.  This is required for the OSX build.

`npm run makepng` rebuilds the `icon-128.png` file from icon.svg.  This is used in the UI.
