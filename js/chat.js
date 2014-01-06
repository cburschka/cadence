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
    quit: function(arg) {
      xmpp.disconnect();
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
      if (xmpp.currentRoom == room) {
        return ui.messageAddInfo('You are already in ' + room + '.', 'error');
      }
      xmpp.changeRoom(room);
    },
    me: function(arg) {
      chat.sendMessage('/me ' + arg); // XEP-0245 says to send this in plain.
    }
  },

  cmdAvailableStatus: {
    online: ['join', 'quit', 'nick', 'me'],
    offline: ['connect'],
    waiting: [],
  },

  executeInput: function(text) {
    text = text.trim();
    if (!text) return;
    if (text[0] == '/') {
      chat.executeCommandString(text);
    }
    else {
      chat.sendMessage(text);
    }
  },

  executeCommandString: function(text) {
    parts = /^\/([^\s]*)((\s.*)?)$/.exec(text);
    cmd = parts[1];
    arg = parts[2];
    this.executeCommand(cmd, arg);
  },

  executeCommand: function(cmd, arg) {
    if (this.commands[cmd]) {
      if (this.cmdAvailableStatus[xmpp.status].indexOf(cmd) < 0) {
        return ui.messageAddInfo('/' + cmd + ' command not available while ' + xmpp.status, 'error');
      }
      this.commands[cmd](arg);
    }
    else {
      ui.messageAddInfo('Unknown command: /' + cmd, 'error');
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
    start += (start < end && rep != text) ? rep.length : text[0].length;
    end = start;
    inputField.selectionStart = start;
    inputField.selectionEnd = end;
  }
}
