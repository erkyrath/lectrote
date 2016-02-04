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

lectrote_version = '0.1.2'

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
    appdir = resourcedir
    print('Installing to: ' + appdir)
    
    os.makedirs(appdir, exist_ok=True)
    qdir = os.path.join(appdir, 'quixe')
    os.makedirs(qdir, exist_ok=True)
    os.makedirs(os.path.join(qdir, 'lib'), exist_ok=True)
    os.makedirs(os.path.join(qdir, 'media'), exist_ok=True)
    
    for filename in files:
        shutil.copyfile(filename, os.path.join(appdir, filename))

def makezip(dir, unwrapped=False):
    prefix = 'Lectrote-'
    val = os.path.split(dir)[-1]
    if not val.startswith(prefix):
        raise Exception('path does not have the prefix')
    zipfile = 'Lectrote-' + lectrote_version + '-' + val[len(prefix):]
    print('Zipping up: ' + dir + ' to ' + zipfile)
    if unwrapped:
        subprocess.call('cd %s; rm -f ../%s.zip; zip -q -r ../%s.zip *' % (dir, zipfile, zipfile),
                        shell=True)
    else:
        dirls = os.path.split(dir)
        subdir = dirls[-1]
        topdir = os.path.join(*os.path.split(dir)[0:-1])
        subprocess.call('cd %s; rm -f %s.zip; zip -q -r %s.zip %s' % (topdir, zipfile, zipfile, subdir),
                        shell=True)

install('tempapp')

if '-b' in sys.argv:
    subprocess.call('npm run package-darwin-x64', shell=True)
    subprocess.call('npm run package-linux-ia32', shell=True)
    subprocess.call('npm run package-linux-x64', shell=True)
    subprocess.call('npm run package-win32-ia32', shell=True)
    subprocess.call('npm run package-win32-x64', shell=True)

if '-z' in sys.argv:
    makezip('dist/Lectrote-darwin-x64')
    makezip('dist/Lectrote-linux-ia32')
    makezip('dist/Lectrote-linux-x64')
    makezip('dist/Lectrote-win32-ia32', True)
    makezip('dist/Lectrote-win32-x64', True)
