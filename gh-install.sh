#!/bin/bash

echo "Configuring cadence"

./configure \
  --https \
  --domain="calref.net" \
  --title="Calamity Refuge" \
  $*

echo "Building cadence"

make > /dev/null

echo "Installing cadence"

make install > /dev/null



