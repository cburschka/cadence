#!/bin/bash

echo "Configuring cadence"

./configure \
  --https \
  --domain="calref.net" \
  --session-auth="https://calref.net/xmpp-auth.php" \
  --chatbot="Ligrev" \
  --title="Ligrev's Lounge" \
  --mode=debug \
  --cdn-url="https://c312441.ssl.cf1.rackcdn.com/chat" \
  --cdn-prefix="/var/www/cloudfiles/calamityrefuge/chat" \
  $*

echo "Building cadence"

make > /dev/null

echo "Installing cadence"

make install > /dev/null
