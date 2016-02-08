#!/bin/sh

LIB="`npm root -g`"
$LIB/lectrote/node_modules/.bin/electron $LIB/lectrote/main.js "$@" &


