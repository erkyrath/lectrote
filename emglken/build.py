#!/usr/bin/env python

# Shove emglken_dispatch.js and gi_load.js together into a file
# which can be packaged into Lectrote. This is a cheap hack.

from __future__ import absolute_import
from __future__ import division
from __future__ import print_function

import sys
import re
import subprocess

def compress_source(target, srcls):
    print('Writing', target)
    with open(target, 'wb') as targetfl:
        proc = subprocess.Popen([sys.executable, 'quixe/tools/rjsmin.py'],
                                stdin=subprocess.PIPE,
                                stdout=targetfl)
        for src in srcls:
            with open(src, 'rb') as fl:
                dat = fl.read()
            proc.stdin.write(dat)
        proc.stdin.close()
        ret = proc.wait()
        if (ret):
            raise Exception('Process result code %d' % (ret,))

compress_source(
    'emglken/emglken_dispload.min.js', [
        'emglken/emglken_dispatch.js',
        'quixe/src/quixe/gi_load.js',
        ])
