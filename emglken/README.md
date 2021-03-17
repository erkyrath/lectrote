Emglken: Glk meets Emscripten
=============================

Over the years many Interactive Fiction interpreters have been written which use the Glk API, or have been adapted to do so. Emglken takes some of these interpreters, compiles them to use the [RemGlk](https://github.com/erkyrath/remglk) Glk library using [Emscripten](https://emscripten.org/), and then outputs to Javascript and WebAssembly. These interpreters, which once needed to be compiled for each distinct operating system and CPU combination, can now be run anywhere there's a modern Javascript runtime: on the web with [Parchment](https://github.com/curiousdannii/parchment), in desktop apps like [Lectrote](https://github.com/erkyrath/lectrote), or in Node.js directly.

Emglken itself doesn't have a lot of code, RemGlk does most of the work for us. What Emglken does provide is a virtual file system for Emscripten which lets RemGlk think it is running on a normal Linux filesystem, but is actually transformed to use [GlkOte](https://github.com/erkyrath/glkote)'s Dialog API. Emglken also provides a common interpreter interface to handle setting up the connections between each interpreter and GlkOte.

Both RemGlk and the Emglken customisations are MIT licensed, as are some of the interpreters, but others are licensed under other Free Software licenses as listed below.

Included Projects
-----------------

Name   | Upstream repo | License
------ | ------------- | -------
Bocfel | [garglk/garglk](https://github.com/garglk/garglk) | [GPL-2.0](https://github.com/garglk/garglk/blob/master/terps/bocfel/COPYING.GPLv2)/[GPL-3.0](https://github.com/garglk/garglk/blob/master/terps/bocfel/COPYING.GPLv3)
Git    | [DavidKinder/Git](https://github.com/DavidKinder/Git) | [MIT](https://github.com/DavidKinder/Git/blob/master/README.txt)
Glulxe | [erkyrath/glulxe](https://github.com/erkyrath/glulxe) | [MIT](https://github.com/erkyrath/glulxe/blob/master/LICENSE)
Hugo   | [0branch/hugo-unix](https://github.com/0branch/hugo-unix) | [BSD-2-Clause](https://github.com/0branch/hugo-unix/blob/master/License.txt)
RemGlk | [erkyrath/remglk](https://github.com/erkyrath/remglk) | [MIT](https://github.com/erkyrath/remglk/blob/master/LICENSE)
TADS   | [garglk/garglk](https://github.com/garglk/garglk) | [GPL-2.0](https://github.com/garglk/garglk/blob/master/tads/COPYING)

npm package and console app
---------------------------

Emglken has been published to the [npm package repository](https://www.npmjs.com/package/emglken). You can install the emglken package and use each interpreter as you wish. A basic console app is also provided, just run `emglken` with the path to the storyfile you want to run.

```
emglken storyfile.gblorb
```