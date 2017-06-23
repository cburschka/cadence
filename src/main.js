const $ = require('jquery');
Cadenza = require('./xmpp/core');
ui = require('./ui/core')();
muc = require('./xmpp/muc');
connection = new Cadenza.Connection({url: 'wss://burschka.de:5281/websocket', config: {debug: true}});
strophe = require('strophe.js');
const domain = 'burschka.net';
$('#login').click(async function () {
  const user = $('#user').val();
  const password = $('#pass').val();
  await connection.connect({user, password, domain});
});
