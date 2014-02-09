#!/bin/bash

echo "Configuring cadence"

./configure \
  --https \
  --domain="calref.net" \
  --session-auth="https://calref.net/xmpp-auth.php" \
  --chatbot="Ligrev" \
  --title="Ligrev's Lounge" \
  --mode=debug \
  $*

echo "Building cadence"

make > /dev/null
