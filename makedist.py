#!/usr/bin/env python3

# Usage: python3 makedist.py
#
# This script copies the working files (everything needed to run Lectrote)
# into prebuilt Electron app packages. Fetch these from
#    https://github.com/atom/electron/releases
# and unzip them into a "dist" directory.

import sys
import os, os.path
import shutil
import subprocess

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
    if not os.path.isdir(resourcedir):
        raise Exception('path does not exist: ' + resourcedir)
    appdir = os.path.join(resourcedir, 'app')
    print('Installing to: ' + appdir)
    
    os.makedirs(appdir, exist_ok=True)
    qdir = os.path.join(appdir, 'quixe')
    os.makedirs(qdir, exist_ok=True)
    os.makedirs(os.path.join(qdir, 'lib'), exist_ok=True)
    os.makedirs(os.path.join(qdir, 'media'), exist_ok=True)
    
    for filename in files:
        shutil.copyfile(filename, os.path.join(appdir, filename))

def makezip(dir):
    prefix = 'electron-v0.36.5-'
    val = os.path.split(dir)[-1]
    val = val.replace('darwin', 'macos')
    if not val.startswith(prefix):
        raise Exception('path does not have the prefix')
    zipfile = 'lectrote-0.1.0-' + val[len(prefix):]
    print('Zipping up: ' + dir + ' to ' + zipfile)
    subprocess.call('cd %s; rm -f ../%s.zip; zip -r ../%s.zip *' % (dir, zipfile, zipfile),
                    shell=True)

install('dist/electron-v0.36.5-darwin-x64/Lectrote.app/Contents/Resources')
install('dist/electron-v0.36.5-linux-ia32/resources')
install('dist/electron-v0.36.5-linux-x64/resources')
install('dist/electron-v0.36.5-win32-ia32/resources')
install('dist/electron-v0.36.5-win32-x64/resources')

if '-z' in sys.argv:
    makezip('dist/electron-v0.36.5-darwin-x64')
    makezip('dist/electron-v0.36.5-linux-ia32')
    makezip('dist/electron-v0.36.5-linux-x64')
    makezip('dist/electron-v0.36.5-win32-ia32')
    makezip('dist/electron-v0.36.5-win32-x64')
