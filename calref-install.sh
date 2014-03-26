#!/bin/bash

echo "Purging CDN"
rm -rf /tmp/cadence-cdn
rm -rf /var/www/cloudfiles/calamityrefuge/chat
# TODO: Rackspace Cloudfiles API edge purge

echo "Configuring cadence"

./configure \
  --https \
  --domain="calref.net" \
  --session-auth="https://calref.net/xmpp-auth.php" \
  --chatbot="Ligrev" \
  --title="Ligrev's Lounge" \
  --mode=debug \
  --cdn-url="https://c312441.ssl.cf1.rackcdn.com/chat" \
  --cdn-prefix="/tmp/cadence-cdn" \
  $*

echo "Building cadence"

make > /dev/null

echo "Installing cadence"

make install > /dev/null

echo "Deploying CDN"

cp -r /tmp/cadence-cdn /var/www/cloudfiles/calamityrefuge/chat