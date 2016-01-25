#!/usr/bin/env python3

# Usage: python3 makedist.py
#
# This script copies the working files (everything needed to run Lectrote)
# into prebuilt Electron app packages. Fetch these from
#    https://github.com/atom/electron/releases
# and unzip them into a "dist" directory.

import os, os.path
import shutil

files = [
    './package.json',
    './main.js',
    './apphooks.js',
    './play.html',
    './about.html',
    './if-card.html',
    './el-glkote.css',
    './icon-128.png',
    './quixe/lib/elkote.min.js',
    './quixe/lib/jquery-1.11.2.min.js',
    './quixe/lib/quixe.min.js',
    './quixe/media/waiting.gif',
]

def install(resourcedir):
    appdir = os.path.join(resourcedir, 'app')
    print('Installing to: ' + appdir)
    
    os.makedirs(appdir, exist_ok=True)
    qdir = os.path.join(appdir, 'quixe')
    os.makedirs(qdir, exist_ok=True)
    os.makedirs(os.path.join(qdir, 'lib'), exist_ok=True)
    os.makedirs(os.path.join(qdir, 'media'), exist_ok=True)
    
    for filename in files:
        shutil.copyfile(filename, os.path.join(appdir, filename))
        

install('dist/electron-v0.36.5-darwin-x64/Lectrote.app/Contents/Resources')
install('dist/electron-v0.36.5-win32-ia32/resources')
install('dist/electron-v0.36.5-win32-x64/resources')
