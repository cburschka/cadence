var chat = {
  commands: {
    connect: function(arg) {
      var args = /^([^\s"&'\/:<>@]*)(.*)$/.exec(arg.trim());
      var user = args[1];
      var pass = args[2].trim();
      if (!user || !pass)
        return ui.messageAddError('Error: User and password are required.');
      if (pass[0] == '"' && pass[pass.length-1] == '"') {
        pass = pass.substring(1, pass.length-1);
      }
      xmpp.newConnection(user, pass);
    },
    quit: function(arg) {
      xmpp.disconnect();
    },
    nick: function(arg) {
      var nick = arg.trim();
      if (! /^[^\s]+$/.exec(nick)) {
        return ui.messageAddError('Error: Nicknames cannot contain spaces.');
      }
      xmpp.changeNick(nick);
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
        return ui.messageAddError('/' + cmd + ' command not available while ' + xmpp.status);
      }
      this.commands[cmd](arg);
    }
    else {
      ui.messageAddError("Unknown command: /" + cmd);
    }
  },

  sendMessage: function(text) {
    html = bbcode.render(text);
    xmpp.sendMessage(html);
    //ui.messageAddUser(xmpp.roster[xmpp.currentNick]);
  },
}
