var chat = {
  commands: {
    connect: function(arg) {
      if (typeof arg == 'string') {
        var m = /^([^\s"&'\/:<>@]*)(.*)$/.exec(arg.trim());
        arg = {user: args[1], pass: args[2].trim()};
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
    }
  },

  cmdAvailableStatus: {
    online: ['join', 'quit', 'nick'],
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
    console.log("Execute: " + text);
    parts = /^\/([^\s]*)((\s.*)?)$/.exec(text);
    cmd = parts[1];
    arg = parts[2];
    console.log(cmd, arg);
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
    //ui.messageAddUser(xmpp.roster[xmpp.currentNick]);
  },
}
