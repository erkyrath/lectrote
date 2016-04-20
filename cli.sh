#!/bin/sh

# If we are in the lectrote package directory, run the app locally.
# If not, run it from the global node directory. I think this is
# the right way to handle this.

PREFIX="`npm prefix`"

if /bin/test "`basename $PREFIX`" "!=" "lectrote";
then
  LIB="`npm root -g`";
  PREFIX="$LIB/lectrote";
fi

$PREFIX/node_modules/.bin/electron $PREFIX/main.js "$@" &


