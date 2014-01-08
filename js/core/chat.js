var chat = {
  commands: {
    connect: function(arg) {
      if (typeof arg == 'string') {
        var m = /^([^\s"&'\/:<>@]*)(.*)$/.exec(arg.trim());
        arg = {user: m[1], pass: m[2].trim()};
      }
      if (!arg.user || !arg.pass)
        return ui.messageAddInfo('User and password are required.', 'error');
      if (arg.pass[0] == '"' && arg.pass[arg.pass.length-1] == '"') {
        arg.pass = arg.pass.substring(1, arg.pass.length-1);
      }
      xmpp.newConnection(arg.user, arg.pass);
    },
    me: function(arg) {
      chat.sendMessage('/me ' + arg); // XEP-0245 says to send this in plain.
    },
    nick: function(arg) {
      var nick = arg.trim();
      if (! /^[^\s]+$/.exec(nick)) {
        return ui.messageAddInfo('Nicknames cannot contain spaces.', 'error');
      }
      xmpp.changeNick(nick);
    },
    join: function(arg) {
      var room = arg.trim();
      if (xmpp.room.current == room) {
        return ui.messageAddInfo('You are already in room {room}.', {room:room}, 'error');
      }
      xmpp.joinRoom(room);
      chat.setSetting('xmpp.room', room);
    },
    say: function(arg) {
      chat.sendMessage(arg);
    },
    quit: function(arg) {
      xmpp.disconnect();
    }
  },

  cmdAvailableStatus: {
    online: ['join', 'quit', 'nick', 'me', 'say'],
    offline: ['connect'],
    waiting: [],
  },

  executeInput: function(text) {
    text = text.trim();
    if (!text) return;

    var cmd = 'say';

    if (text[0] == '/') {
      if (text[1] != '/') {
        var i = text.indexOf(' ');
        if (i < 0) i = text.length;
        cmd = text.substring(1, i);
        text = text.substring(i);
      }
      else text = text.substring(1);
    }

    if (this.commands[cmd]) {
      if (this.cmdAvailableStatus[xmpp.status].indexOf(cmd) < 0) {
        return ui.messageAddInfo('/{cmd} command not available while {status}', {cmd:cmd,status:xmpp.status}, 'error');
      }
      this.commands[cmd](text);
    }
    else {
      ui.messageAddInfo('Unknown command: /{cmd}. Type "/say /{cmd}" or "//{cmd}" to say this in chat.', {cmd:cmd}, 'error');
    }
  },

  sendMessage: function(text) {
    html = bbcode.render(text);
    xmpp.sendMessage(html);
  },

  insertText: function(text) {
    ui.dom.inputField.focus();
    var inputFieldJQ = ui.dom.inputField;
    var inputField = inputFieldJQ[0]
    var start = inputField.selectionStart;
    var end = inputField.selectionEnd;
    var old = inputFieldJQ.val();
    rep = (typeof text == 'string') ? text : text[0] + old.substring(start, end) + text[1];
    inputFieldJQ.val(old.substring(0, start) + rep + old.substring(end));
    start += (start < end || rep == text) ? rep.length : text[0].length;
    end = start;
    inputField.selectionStart = start;
    inputField.selectionEnd = end;
  },

  getSetting: function(key) {
    var path = key.split('.');
    var ref = config.settings;
    for (var i = 0; i < path.length; i++) {
      ref = ref[path[i]];
    }
    return ref;
  },

  setSetting: function(key, val) {
    var path = key.split('.');
    var ref = config.settings;
    for (var i = 0; i < path.length - 1; i++) {
      ref = ref[path[i]];
    }
    ref[path[path.length-1]] = val;
    this.saveSettings();
  },

  saveSettings: function() {
    $.cookie(config.sessionName + '_settings', config.settings);
  }
}
