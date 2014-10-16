/**
 * chat.js contains all the functions that alter the state
 * in response to user requests.
 *
 * @author Christoph Burschka <christoph@burschka.de>
 * @year 2014
 * @license GPL3+
 */
var chat = {
  history: [],
  historyIndex: 0,

  /**
   * All commands executable in chat by prefixing them with '/'.
   */
  commands: {
    /**
     * alias <cmd> <commands>
     *   Create a macro.
     */
    alias: function(arg) {
      arg = arg.trim();
      if (!arg) {
        var out = '';
        for (var macro in config.settings.macros) {
          out += '    /' + macro + ' - ' + config.settings.macros[macro].join('; ') + '\n';
        }
        if (out) return ui.messageAddInfo(strings.info.macros, {
          macros: out
        });
        else return ui.messageAddInfo(strings.error.noMacros, 'error');
      }
      var m = arg.match(/^\/*(\S+)/);
      if (!m) return ui.messageAddInfo(strings.error.aliasFormat, 'error');
      var cmd = m[1];
      if (chat.commands[cmd]) return ui.messageAddInfo(strings.error.aliasConflict, {
        cmd: cmd
      }, 'error');
      var macro = arg.substring(m[0].length).trim();
      if (!macro) {
        delete config.settings.macros[cmd];
        chat.saveSettings();
        return ui.messageAddInfo(strings.info.aliasDelete, {cmd: cmd});
      }
      macro = macro.split(';');
      for (var i in macro) {
        macro[i] = macro[i].trim();
      }
      if (macro.length == 1 && !macro[0].match(/\$/)) macro[0] += ' $';

      var search = function(c, t) {
        if (c) for (var i in c) {
          var m = c[i].match(/^\/(\S+)/);
          var u = m && ((m[1] == cmd && t.concat([m[1]])) || search(config.settings.macros[m[1]], t.concat([m[1]])));
          if (u) return u;
        }
        return false;
      }
      var rec = search(macro, [cmd]);
      if (rec) return ui.messageAddInfo(strings.error.aliasRecursion, {
        cmd: cmd, path: rec.join(' -> ')
      }, 'error');

      if (config.settings.macros[cmd]) {
        ui.messageAddInfo(strings.info.aliasReplace, {cmd: cmd});
      }
      else ui.messageAddInfo(strings.info.aliasAdd, {cmd: cmd});
      config.settings.macros[cmd] = macro;
      chat.saveSettings();
    },

    /**
     * admin <cmd> <msg>:
     *   Execute a server admin command.
     */
    admin: function(arg) {
      arg = arg.trim();
      var m = arg.match(/^(\S+)/);
      if (!m) return;
      var command = m[1];
      arg = arg.substring(m[0].length).trim();
      var error = function(stanza, status) {
        if (status < 2 && stanza) {
          if ($('forbidden', stanza).length) {
            ui.messageAddInfo(strings.error.admin.forbidden, {command: command}, 'error');
          }
          else {
            var message = $('text', stanza).text();
            console.log(message);
            ui.messageAddInfo(strings.error.admin.generic, {command: command, text: message}, 'error');
          }
        }
      };
      var commands = {
        announce: function() { xmpp.submitCommand('announce', {body: arg}, error); },
        motd: function() { xmpp.submitCommand('set-motd', {body: arg}, error); }
      };

      if (commands[command]) commands[command]();
      else ui.messageAddInfo(strings.error.admin.badCommand, {command: command}, 'error');
    },

    /**
     * away <msg>:
     *   Send a room presence with <show/> set to "away" and
     *   <status/> to "msg".
     */
    away: function(arg) {
      xmpp.sendStatus('away', arg.trim());
    },

    /**
     * back <msg>:
     *   Send an empty room presence that unsets <show/> and <status/>.
     */
    back: function() {
      xmpp.sendStatus();
    },

    /**
     * ban [<nick>|<node>|<jid>]
     *   Ban a user currently in the room by their nick, or ban a user on the
     *   same domain as the logged-in user by their username, or ban a user
     *   by JID.
     */
    ban: function(arg) {
      arg = arg.trim();
      var room = xmpp.room.available[xmpp.room.current]
      var roster = xmpp.roster[xmpp.room.current];
      var absent = false;

      if (arg.indexOf('@') < 0) {
        var user = roster[arg];
        if (!user) return ui.messageAddInfo(strings.error.ban.unknown, {nick: arg, room: room}, 'error')
        if (!user.jid) return ui.messageAddInfo(strings.error.ban.anon, {user: user}, 'error')
        arg = Strophe.getBareJidFromJid(user.jid);
      }
      else {
        arg = Strophe.getBareJidFromJid(arg);
        for (var nick in roster)
          if (roster[nick].jid && arg == Strophe.getBareJidFromJid(roster[nick].jid))
            user = roster[nick];
        if (!user) {
          user = {jid: arg, nick: arg};
          var absent = true;
        }
      }

      xmpp.setUser({jid: arg, affiliation: 'outcast'}, function(iq) {
        if ($(iq).attr('type') == 'result' && absent)
          ui.messageAddInfo(strings.info.banSuccess, {user: user, room: room});
      }, function(code, iq) {
        var error = 'default';
        if ($('conflict', iq).length || arg == Strophe.getBareJidFromJid(xmpp.connection.jid))
          error = 'self';
        else if ($('not-allowed', iq).length)
          error = 'notAllowed';
        ui.messageAddInfo(strings.error.ban[error], {user: user, room: room}, 'error');
      });
    },

    /**
     * bans:
     *   Get the ban list.
     */
    bans: function() {
      xmpp.getUsers({affiliation: 'outcast'}, function(stanza) {
        var users = [];
        $('item', stanza).each(function() { users.push($(this).attr('jid')); });
        ui.messageAddInfo(users.length ? strings.info.banList : strings.info.banListEmpty, {users: users.join('\n')});
      }, function(stanza) {
        if ($('forbidden', iq).length)
          ui.messageAddInfo(strings.error.banList.forbidden);
        else ui.messageAddInfo(strings.error.banList['default']);
      });
    },

    /**
     * clear:
     *   Clear the entire chat list screen.
     */
    clear: function() {
      ui.clearMessages();
      this.history = [];
      this.historyIndex = 0;
    },

    /**
     * connect <user> <pass>
     * connect {user:<user>, pass:<pass>}
     *   Open a connection and authenticate.
     */
    connect: function(arg) {
      var fail = function() { return ui.messageAddInfo(strings.error.userpass, 'error') };
      if (typeof arg == 'string') {
        arg = arg.trim();
        var m = /^[^\s"&'\/:<>@]+/.exec(arg);
        if (!m) return fail();
        arg = {user: m[0], pass: arg.substring(m[0].length).trim()};
        if (arg.pass[0] == '"' && arg.pass[arg.pass.length-1] == '"') {
          arg.pass = arg.pass.substring(1, arg.pass.length-1);
        }
      }
      if (!arg.user || !arg.pass) {
        if (config.settings.xmpp.sessionAuth && config.xmpp.sessionAuthURL)
          return chat.sessionAuth(config.xmpp.sessionAuthURL, fail);
        else return fail();
      }
      xmpp.newConnection(arg.user, arg.pass);
    },

    /**
     * create <room>
     *   Join a new room and set it up.
     */
    create: function(arg) {
      var name = arg.trim();
      var room = chat.getRoomFromTitle(arg.trim());
      if (room)
        return ui.messageAddInfo(strings.error.roomExists, {room: room}, 'error');
      xmpp.joinNewRoom(name);
    },

    /**
     * join <room>
     *   Ask XMPP to join <room>. If successful, XMPP
     *   will automatically leave the current room.
     */
    join: function(arg) {
      var name = arg.trim();
      var room = chat.getRoomFromTitle(name);
      var join = function() {
        var room = chat.getRoomFromTitle(name);
        if (room && xmpp.room.current == room.id) {
          return ui.messageAddInfo(strings.error.joinSame, {room: room}, 'error');
        }
        room = room ? room.id : name;
        xmpp.joinExistingRoom(room);
        chat.setSetting('xmpp.room', room);
      };
      // If the room is known, join it now. Otherwise, refresh before joining.
      if (room) join();
      else xmpp.discoverRooms(join);
    },

    /**
     * kick <nick>
     *   Ask XMPP to kick a user.
     *   The client will not validate the command or its authority; that's the
     *   server's job.
     */
    kick: function(arg) {
      var nick = arg.trim();
      xmpp.setUser({nick: nick, role: 'none'}, function() {}, function(errorCode) {
        ui.messageAddInfo(strings.error.kick[errorCode], {nick: nick}, 'error');
      });
    },

    /**
     * list:
     *   List available rooms.
     */
    list: function() {
      xmpp.discoverRooms(function(rooms) {
        var links = [];
        for (var room in rooms) {
          links.push(
               '<a href="javascript:void()" onclick="chat.commands.join(\''
             + room + '\');"'
             + (room == xmpp.room.current ? ' style="font-weight: bold"' : '')
             + '>' + visual.format.room(rooms[room]) + '</a>'
          );
        }
        if (links.length)
          ui.messageAddInfo(strings.info.roomsAvailable, {'raw.rooms': links.join(', ')});
        else ui.messageAddInfo(strings.error.noRoomsAvailable, 'error');
      });
    },

    /**
     * me <msg>
     *   Alias for /say "/me <msg>".
     */
    me: function(arg) {
      this.say('/me' + arg); // XEP-0245 says to send this in plain.
    },

    /**
     * msg <nick> <msg>
     *   Send a private message to another occupant.
     */
    msg: function(arg) {
      var m = /^\s*(((\\\s)?\S)+)\s*/.exec(arg);
      var nick = m[1].replace(/\\(\s)/g, '$1');
      var msg = arg.substring(m[0].length);
      if (!xmpp.roster[xmpp.room.current][nick])
        return ui.messageAddInfo(strings.error.unknownUser, {nick: nick}, 'error');
      var msg = visual.lengthLimit(visual.format.plain(msg), config.ui.maxMessageLength);
      chat.sendMessage(msg, nick);
      ui.messageAppend(visual.formatMessage({
        type: 'chat',
        to: nick,
        user: xmpp.roster[xmpp.room.current][xmpp.nick.current],
        body: chat.formatOutgoing(msg)
      }));
    },

    /**
     * nick <nick>
     *   Ask XMPP to change the nick in the current room.
     */
    nick: function(arg) {
      var nick = arg.trim();
      if (nick) xmpp.changeNick(nick);
      else ui.messageAddInfo(strings.error.noNick, 'error');
    },

    /**
     * part
     *   Leave the current room without joining a different one.
     */
    part: function() {
      if (xmpp.room.current) xmpp.leaveRoom(xmpp.room.current);
    },

    /**
     * quit
     *   Ask XMPP to disconnect.
     */
    quit: function() {
      xmpp.disconnect();
    },

    /**
     * save
     *   Create a text file (by data: URI) from the chat history.
     */
    save: function(arg) {
      var type = arg.trim();
      type = type == 'html' ? 'html' : 'plain';
      var data = type == 'html' ? ui.dom.chatList.html() : visual.messagesToText(ui.messages);
      var blob = new Blob([data], {type: 'text/' + type + ';charset=utf-8'});
      var timestamp = moment(new Date(ui.messages[0].timestamp)).format('YYYY-MM-DD');
      var suffix = type == 'html' ? 'html' : 'log';
      saveAs(blob, xmpp.room.current + '-' + timestamp + '.' + suffix);
    },

    /**
     * say <msg>
     *   The default command that simply sends a message verbatim.
     */
    say: function(arg) {
      arg = visual.lengthLimit(visual.format.plain(arg.trim()), config.ui.maxMessageLength);
      chat.sendMessage(arg);
    },

    /**
     * unban
     *   Unban a user from the current room.
     */
    unban: function(arg) {
      arg = arg.trim()
      if (arg.indexOf('@') < 0) arg += '@';
      xmpp.getUsers({affiliation: 'outcast'}, function(stanza) {
        var user = null;
        $('item', stanza).each(function() {
          var x = $(this).attr('jid');
          if (arg == x.substring(0, arg.length)) user = x;
        });
        if (!user) return ui.messageAddInfo(strings.error.unbanNone, 'error');
        xmpp.setUser({jid: user, affiliation: 'none'},
          function(info) {
            ui.messageAddInfo(strings.info.unbanSuccess, {jid: user});
          },
          function(info) {
            ui.messageAddInfo(strings.error.unban, {jid: user}, 'error');
          }
        );
      }, function(stanza) {
        if ($('forbidden', iq).length)
          ui.messageAddInfo(strings.error.banList.forbidden);
        else ui.messageAddInfo(strings.error.banList['default']);
      });
    },

    /**
     * version
     *   Emit the config.version key.
     */
    version: function() {
      var version = '<a href="https://github.com/cburschka/cadence/tree/'
                  + config.version + '">' + 'cadence-' + config.version + '</a>';
      ui.messageAddInfo(strings.info.versionClient, {'raw.version': version});
      if (xmpp.status == 'online' || xmpp.status == 'prejoin') {
        xmpp.getVersion(function(version) {
          if (version) ui.messageAddInfo(strings.info.versionServer, version);
        });
      }
    },

    /**
     * who [room]
     *   Query the user list of a room.
     */
    who: function(arg) {
      arg = arg.trim();
      var room = arg ? chat.getRoomFromTitle(arg) : xmpp.room.available[xmpp.room.current];
      if (!room)
        return ui.messageAddInfo(arg ? strings.error.unknownRoom : 'You are not in a room.', {name: arg}, 'error');
      if (room.id != xmpp.room.current) {
        xmpp.getOccupants(room.id, function(users) {
          var out = [];
          for (var nick in users) out.push(visual.format.nick(nick))
          if (out.length) ui.messageAddInfo(strings.info.usersInRoom, {
            room: room,
            'raw.users': out.join(', ')
          });
          else ui.messageAddInfo(strings.info.noUsers, {room: room});
        })
      }
      else {
        var links = []
        for (var user in xmpp.roster[xmpp.room.current])
          links.push(visual.format.user(xmpp.roster[xmpp.room.current][user]));
        ui.messageAddInfo(strings.info.usersInThisRoom, {'raw.users': links.join(', ')});
      }
    }
  },

  /**
   * Validate the current command by xmpp.status.
   */
  cmdAvailableStatus: function(command) {
    var always = ['alias', 'clear', 'nick', 'save', 'version'];
    var chat = ['away', 'back', 'ban', 'bans', 'kick', 'me', 'msg', 'part', 'say', 'unban'];
    var offline = ['connect'];
    var waiting = ['quit'];

    // always allow these commands (hence the name).
    if (always.indexOf(command) >= 0) return true;

    switch (xmpp.status) {
      case 'prejoin':
        // do not allow chat commands in prejoin.
        if (chat.indexOf(command) >= 0)
          return ui.messageAddInfo(strings.error.cmdStatus.prejoin, {cmd:command}, 'error') && false;
      case 'online':
        // do not allow offline commands in prejoin or in rooms.
        if (offline.indexOf(command) >= 0)
          return ui.messageAddInfo(strings.error.cmdStatus.online, {cmd:command}, 'error') && false;
        return true;

      // switch from blacklist to whitelist here.
      case 'waiting':
        if (waiting.indexOf(command) >= 0) return true;
      case 'offline':
        // allow offline commands while waiting or offline.
        if (offline.indexOf(command) >= 0) return true;
        return ui.messageAddInfo(strings.error.cmdStatus.offline, {cmd:command}, 'error') && false;
    }
  },

  /**
   * Parse input sent by the user and execute the appropriate command.
   */
  executeInput: function(text, macro) {
    if (!macro) {
      this.history.push(text);
      this.historyIndex = this.history.length;
    }
    text = text.replace(/\s\s*$/, '');
    if (!text) return;

    // Without commands, execute /say.
    var cmd = 'say';

    // Execute /cmd, but turn //cmd into /say /cmd.
    var m = /^\/(\/?)(\S+)/.exec(text);
    if (m) {
      if (!m[1]) {
        cmd = m[2];
        text = text.substring(m[0].length);
      }
      else text = text.substring(1);
    }

    if (this.commands[cmd]) {
      if (this.cmdAvailableStatus(cmd)) this.commands[cmd](text);
    }
    else if (config.settings.macros[cmd])
      this.executeMacro(config.settings.macros[cmd], text);
    else
      ui.messageAddInfo(strings.error.cmdUnknown, {cmd:cmd}, 'error');
  },

  /**
   * Run a stored macro:
   *
   * @param {[string]} macro: An array of commands.
   * @param {string} text: A string to replace $ with in the command array.
   */
  executeMacro: function(macro, text) {
    for (var i in macro) {
      this.executeInput(macro[i].replace(/\$/g, text.trim()), true);
    }
  },

  /**
   * Ask XMPP to send a message to the current room, or one of its occupants.
   *
   * @param {string} text: The message to send (already escaped, but pre-BBCode).
   * @param {string} nick: The recipient, or undefined.
   */
  sendMessage: function(text, nick) {
    html = this.formatOutgoing(text);
    xmpp.sendMessage(html, nick);
  },

  /**
   * Format an outgoing message.
   *
   * @param {string} text The message to send.
   * @return {string} The HTML output.
   */
  formatOutgoing: function(text) {
    html = bbcode.render(text);
    if (config.settings.textColor) {
      html = '<span class="color color-' + config.settings.textColor.substring(1) + '">' + html + '</span>';
    }
    return html;
  },

  /**
   * Go up to the previously sent message.
   */
  historyUp: function() {
    // Stop at the beginning.
    if (this.historyIndex <= 0) return false;

    // If a new non-history command is entered, save it first.
    if (this.historyIndex == this.history.length && ui.dom.inputField.val().trim())
      this.history.push(ui.dom.inputField.val());
    return ui.dom.inputField.val(this.history[--this.historyIndex]);
  },

  /**
   * Go down to the next sent message.
   */
  historyDown: function() {
    // Stop at the end.
    if (this.historyIndex >= this.history.length) return false;

    return ui.dom.inputField.val(this.history[++this.historyIndex] || '');
  },

  /**
   * Insert a text into the input field.
   * @param {string} text The text to insert.
   * @param {array} text The beginning and end tags to insert.
   *
   * If an array is given, then it will be wrapped around the selected
   * text. A string will replace the selected text.
   * If an array is given and no text is selected, the cursor will
   * be moved between the tags. Otherwise it will be moved to the end
   * of the inserted text.
   */
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

  /**
   * Prepend a /msg <nick> prefix.
   * This will replace any existing /msg <nick> prefix.
   */
  prefixMsg: function(nick) {
    var text = ui.dom.inputField.val();
    var m = text.match(/\/msg\s+((\\\s|\S)+)/);
    if (m) text = text.substring(m[0].length).trimLeft();
    if (nick) text = '/msg ' + decodeURIComponent(nick) + ' ' + text;
    ui.dom.inputField.val(text);
    ui.dom.inputField.focus();
  },

  /**
   * Find a room by its title.
   */
  getRoomFromTitle: function(title) {
    if (xmpp.room.available[title]) return xmpp.room.available[title];
    for (var room in xmpp.room.available) {
      if (xmpp.room.available[room].title == title)
          return xmpp.room.available[room];
    }
  },

  /**
   * Attempt to authenticate using an existing web session.
   */
  sessionAuth: function(url, callback) {
    var salt = (new Date().getTime()) + Math.random();
    $.post(url, {salt: salt}, function(data) {
      if (!data) return;
      if (data.user && data.secret) {
        ui.messageAddInfo(strings.info.sessionAuth, {username:data.user});
        chat.commands.connect({user:data.user, pass:data.secret});
      }
      else {
        ui.setStatus('offline');
        if (callback) callback();
      }
    }, 'json').fail(callback);
  },

  /**
   * Set the volume.
   */
  setAudioVolume: function(volume) {
    buzz.all().setVolume(volume);
  },

  /**
   * Take a dotted string and return the respective value
   * in the settings dictionary.
   */
  getSetting: function(key) {
    var path = key.split('.');
    var ref = config.settings;
    for (var i = 0; i < path.length; i++) {
      ref = ref[path[i]];
    }
    return ref;
  },

  /**
   * Take a dotted string and set that settings key to the
   * given value. Immediately saves.
   */
  setSetting: function(key, val) {
    var path = key.split('.');
    var ref = config.settings;
    for (var i = 0; i < path.length - 1; i++) {
      ref = ref[path[i]];
    }
    ref[path[path.length-1]] = val;
    this.saveSettings();
  },

  /**
   * Serialize the settings object and save it in the cookie.
   */
  saveSettings: function() {
    $.cookie(config.clientName + '_settings', config.settings);
  }
}
