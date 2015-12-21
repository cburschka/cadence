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
     * admin <cmd> <msg>:
     *   Execute a server admin command.
     */
    admin: function(arg) {
      var m = chat.parseArgs(arg);
      var defaultArgs = {
        announce: 'body',
        'get-user-lastlogin': 'accountjid',
        'set-motd': 'body',
        'user-stats': 'accountjid',
      }
      if (m[0].length) m.cmd = m[0][0];
      if (m[0].length > 1 && m.cmd in defaultArgs)
        m[defaultArgs[m.cmd]] = arg.substring(m[1][0][0]).trim();

      if (!m.cmd) return ui.messageAddInfo(strings.error.noArgument, 'error');

      var arg = {};
      for (var i in m) if (i != 'cmd' && i != 'interactive' && i*0 != 0) arg[i] = m[i];
      m.interactive = m.interactive || Object.keys(arg).length == 0;

      var query = m.interactive ?
          function(x, submit) { ui.formDialog(ui.dataForm(x, submit)) }
        : arg;

      xmpp.submitCommand(m.cmd, query, function(stanza, status) {
        if (status < 2 && stanza) {
          if ($('forbidden', stanza).length)
            ui.messageAddInfo(strings.error.admin.forbidden, {command: m.cmd}, 'error');
          else if ($('service-unavailable', stanza).length)
            ui.messageAddInfo(strings.error.admin.badCommand, {command: m.cmd}, 'error');
          else if ($('text', stanza).length) ui.messageAddInfo(strings.error.admin.generic, {
            command: m.cmd, text: $('text', stanza).text()
          }, 'error');
          else ui.messageAddInfo(strings.error.admin.unknown, {command: m.cmd}, 'error');
        }
        else {
          var result = [];
          $('field[type!=hidden]', stanza).each(function() {
            result.push('<strong>' + $(this).attr('label') + '</strong>: ' + $(this).text());
          });
          ui.messageAddInfo(strings.info.admin[result.length ? 'result' : 'completed'], {
            command: m.cmd,
            result: result.join("\n")
          });
        }
      });
    },

    /**
     * affiliate owner|admin|member|none [<nick>|<jid>]
     *   Set the affiliation of a particular user, or list all users with an affiliation.
     */
    affiliate: function(arg) {
      arg = chat.parseArgs(arg);
      arg.type = arg.type || arg[0][0];
      if (!arg.jid) arg.nick = arg.nick || arg[0][1];

      var room = xmpp.room.available[xmpp.room.current]
      var roster = xmpp.roster[xmpp.room.current];
      var user = roster[arg.nick] || {jid: Strophe.getBareJidFromJid(arg.jid || arg.nick) };

      if (['owner', 'admin', 'member', 'outcast', 'none'].indexOf(arg.type) < 0)
        return ui.messageAddInfo(strings.error.affiliate.type, {type: arg.type}, 'error')
      if (!arg.jid && !arg.nick) {
        return xmpp.getUsers({affiliation: arg.type}, function(stanza) {
          var users = {};
          $('item', stanza).each(function() { users[$(this).attr('jid').toLowerCase()] = true; });
          for (var nick in roster) {
            var jid = Strophe.getBareJidFromJid(roster[nick].jid).toLowerCase();
            if (jid in users) users[jid] = visual.format.user(roster[nick]);
          }
          var output = [];
          for (var jid in users)
            output.push(users[jid] === true ? visual.format.plain(jid) : users[jid]);

          ui.messageAddInfo(output.length ? strings.info.affiliations[arg.type] : strings.info.affiliationsEmpty, {
            type: arg.type,
            users: output.sort().join('\n')
          });
        }, function(stanza) {
          var type = ($('forbidden', iq).length) ? 'forbidden' : 'default';
          ui.messageAddInfo(strings.error.affiliations[type], {type: arg.type}, 'error');
        });
      }
      if (!user.jid)
        return ui.messageAddInfo(strings.error.affiliate.anon, {user: user}, 'error');
      if (user.jid.indexOf('@') < 0)
        return ui.messageAddInfo(strings.error.affiliate.unknown, {nick: user.jid}, 'error');

      if (!user.nick)
        for (var nick in roster)
          if (Strophe.getBareJidFromJid(roster[nick].jid) == user.jid)
            user = roster[nick];

      xmpp.setUser({jid: user.jid, affiliation: arg.type}, function(iq) {
        if ($(iq).attr('type') == 'result')
          ui.messageAddInfo(strings.info.affiliate[+!!user.nick], {
            jid: user.jid,
            user: user.nick && user,
            room: room,
            type: arg.type
          });
      }, function(code, iq) {
        var error = 'default';
        if ($('not-allowed', iq).length) error = 'notAllowed';
        else if ($('conflict', iq).length) error = 'conflict';
        ui.messageAddInfo(strings.error.affiliate[error], 'error');
      });
    },

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
    back: function(arg) {
      xmpp.sendStatus(null, arg.trim() || null);
    },

    /**
     * ban <nick>|<jid>
     *   Shortcut for "/affiliate outcast <nick|jid>".
     */
    ban: function(arg) {
      arg = chat.parseArgs(arg);
      arg.type = 'outcast';
      if (arg[0]) arg[0].unshift('outcast');
      this.affiliate(arg);
    },

    /**
     * bans:
     *   Shortcut for "/affiliate outcast".
     */
    bans: function() {
      this.affiliate({0: ['outcast']});
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
     * configure [room] <args>
     *   Alter a room configuration.
     */
    configure: function(arg) {
      arg = chat.parseArgs(arg);
      if (arg.help) return ui.messageAddInfo(strings.help.configure);
      if (!arg.name && arg[0]) arg.name = arg[0].join(' ');
      var name = arg.name || xmpp.room.current;
      if (!name)
        return ui.messageAddInfo(strings.error.noRoom, 'error');
      if (!xmpp.room.available[name])
        return ui.messageAddInfo(strings.error.unknownRoom, {name: name}, 'error');
      arg.interactive = arg.interactive || Object.keys(arg).every(
        function(e) { return e == '0' || e == '1' || e == 'name' }
      );
      var room = xmpp.room.available[name];
      var config = arg.interactive ?
          function(x, submit) { ui.formDialog(ui.dataForm(x, submit)) }
        : chat.roomConf(arg);

      xmpp.configureRoom(name, config, function(error) {
        if (!error) ui.messageAddInfo(strings.info.roomConf, {room: room});
        else if (error == '403') ui.messageAddInfo(strings.error.roomConfDenied, {room: room}, 'error');
        else ui.messageAddInfo(strings.error.roomConf, {room: room}, 'error');
      });
    },

    /**
     * connect <user> <pass>
     * connect {user:<user>, pass:<pass>}
     *   Open a connection and authenticate.
     */
    connect: function(arg) {
      var fail = function() { return ui.messageAddInfo(strings.error.userpass, 'error') };
      arg = chat.parseArgs(arg);
      if (arg[0]) {
        arg.user = arg.user || arg[0][0];
        arg.pass = arg.pass || arg[0][1];
      }
      if (!arg.user || !arg.pass) {
        if (config.settings.xmpp.sessionAuth && config.xmpp.sessionAuthURL)
          return chat.sessionAuth(config.xmpp.sessionAuthURL, fail);
        else return fail();
      }
      xmpp.newConnection(arg.user, arg.pass);
    },

    /**
     * create <room> [<args>]
     *   Join a new room and set it up.
     */
    create: function(arg) {
      arg = chat.parseArgs(arg);
      if (arg.help) return ui.messageAddInfo(strings.help.configure);
      if (!arg.name) arg.name = arg[0].join(' ') || arg.title;
      if (!arg.name)
        return ui.messageAddInfo(strings.error.roomCreateName, 'error');

      var config = arg.interactive ?
          function(x, submit) { ui.formDialog(ui.dataForm(x, submit)) }
        : chat.roomConf(arg);

      var name = arg.name.toLowerCase();
      var create = function() {
        var room = chat.getRoomFromTitle(name);
        if (room)
          return ui.messageAddInfo(strings.error.roomExists, {room: room}, 'error');
        xmpp.joinNewRoom(name, config);
        ui.setFragment(name);
        chat.setSetting('xmpp.room', room);
      };
      if (!chat.getRoomFromTitle(name)) create();
      else xmpp.discoverRooms(create);
    },

    destroy: function(arg) {
      arg = chat.parseArgs(arg);
      arg.room = arg.room || (arg[0] && arg[0][0]) || xmpp.room.current;
      if (!arg.room)
        return ui.messageAddInfo(strings.error.noRoom, 'error');
      var room = xmpp.room.available[arg.room];
      if (!room)
        return ui.messageAddInfo(strings.error.unknownRoom, {name: arg.room}, 'error');
      if (!window.confirm(visual.formatText(strings.info.destroyConfirm, {name: room.title}))) return;
      xmpp.destroyRoom(arg.room, arg.alternate, arg.reason, function(error) {
        if (error == '403') ui.messageAddInfo(strings.error.destroyDenied, {room: room}, 'error');
        else if (error) ui.messageAddInfo(strings.error.destroy, {room: room}, 'error');
        else ui.messageAddInfo(strings.info.destroySuccess, {room: room});
      });
    },

    /**
     * dmsg <jid>
     *   Send a direct message to a user outside the chatroom.
     */
    dmsg: function(arg) {
      var m = chat.parseArgs(arg);
      if (m[0].length) {
        m.jid = m[0][0];
        m.msg = arg.substring(m[1][0][0]).trim();
      }

      if (!m.jid || !m.msg) return ui.messageAddInfo(strings.error.noArgument, 'error');
      if (!Strophe.getNodeFromJid(m.jid))
        return ui.messageAddInfo(strings.error.jidInvalid, {jid: m.jid});

      var body = chat.formatOutgoing(m.msg);
      xmpp.sendMessage(body, {jid: m.jid});

      ui.messageAppend(visual.formatMessage({
        type: 'chat',
        to: {jid: m.jid},
        user: {jid: xmpp.currentJid},
        body: body.html
      }));
    },

    /**
     * dnd <msg>:
     *   Send a room presence with <show/> set to "dnd" and
     *   <status/> to "msg".
     */
    dnd: function(arg) {
      xmpp.sendStatus('dnd', arg.trim());
    },

    /**
     * invite [<jid> <msg> | --room <room> --nick <nick> --msg <msg>]
     */
    invite: function(arg) {
      var m = chat.parseArgs(arg);
      if (m.room && m.nick) m.jid = xmpp.jid({room: m.room, nick: m.nick});
      if (m[0] && m[0].length >= 1) {
        m.jid = m[0][0]
        m.msg = arg.substring(m[1][0][0]).trim();
      }
      if (!m.jid)
        return ui.messageAddInfo(strings.error.noArgument, 'error');
      xmpp.invite(m.jid, m.msg);
      ui.messageAddInfo(strings.info.inviteSent,
        {jid: m.jid, room: xmpp.room.available[xmpp.room.current]}
      );
    },

    /**
     * join <room>
     *   Ask XMPP to join <room>. If successful, XMPP
     *   will automatically leave the current room.
     */
    join: function(arg) {
      arg = chat.parseArgs(arg);
      arg.name = arg.name || arg[0].join(" ").trim();
      if (!arg.name) return ui.messageAddInfo(strings.error.noArgument, 'error');
      var room = chat.getRoomFromTitle(arg.name);
      var join = function() {
        var room = chat.getRoomFromTitle(arg.name);
        if (room && xmpp.room.current == room.id) {
          return ui.messageAddInfo(strings.error.joinSame, {room: room}, 'error');
        }
        room = (room ? room.id : arg.name).toLowerCase();
        xmpp.joinExistingRoom(room, arg.password);
        ui.setFragment(room);
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
        for (var room in rooms) links.push(visual.format.room(rooms[room]));
        if (links.length)
          ui.messageAddInfo(strings.info.roomsAvailable, {rooms: links.join(', ')});
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
      var m = chat.parseArgs(arg);
      if (m[0].length) {
        m.nick = m[0][0];
        m.msg = arg.substring(m[1][0][0]).trim();
      }

      if (!m.nick || !m.msg) return ui.messageAddInfo(strings.error.noArgument, 'error');
      if (!(m.nick in xmpp.roster[xmpp.room.current]))
        return ui.messageAddInfo(strings.error.unknownUser, {nick: m.nick}, 'error');

      var body = chat.formatOutgoing(m.msg);
      xmpp.sendMessage(body, {nick: m.nick});
      ui.messageAppend(visual.formatMessage({
        type: 'chat',
        to: xmpp.roster[xmpp.room.current][m.nick],
        user: xmpp.roster[xmpp.room.current][xmpp.nick.current],
        body: body.html
      }));
    },

    /**
     * nick <nick>
     *   Ask XMPP to change the nick in the current room.
     */
    nick: function(arg) {
      var nick = arg.trim();
      if (nick) xmpp.changeNick(nick);
      else ui.messageAddInfo(strings.error.noArgument, 'error');
    },

    /**
     * part
     *   Leave the current room without joining a different one.
     */
    part: function() {
      if (xmpp.room.current) xmpp.leaveRoom(xmpp.room.current);
    },

    /**
     * ping <nick>|<jid>
     *   Send a ping and display the response time.
     */
    ping: function(arg) {
      arg = arg.trim();
      if (!arg) return ui.messageAddInfo(strings.error.noArgument, 'error');
      var room = xmpp.room.available[xmpp.room.current];
      var roster = xmpp.roster[xmpp.room.current];
      var absent = false;

      if (!arg) arg = config.xmpp.domain;
      else if (arg.indexOf('@') < 0 && roster) {
        var user = roster[arg];
        if (!user) return ui.messageAddInfo(strings.error.unknownUser, {nick: arg}, 'error');
        if (!user.jid) return ui.messageAddInfo(strings.error.unknownJid, {user: user}, 'error');
        arg = user.jid;
      }

      var time = (new Date()).getTime();

      xmpp.ping(arg, function(stanza) {
          var elapsed = ((new Date()).getTime() - time).toString();
          ui.messageAddInfo(strings.info.pong, {jid: arg, delay: elapsed});
        }, function(error) {
          var elapsed = ((new Date()).getTime() - time).toString();
          if (error) ui.messageAddInfo(strings.info.pongError, {jid: arg, delay: elapsed});
          else ui.messageAddInfo(strings.error.pingTimeout, {jid: arg, delay: elapsed}, 'error');
        }
      );
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
      if (ui.messages.length == 0)
        return ui.messageAddInfo(strings.error.saveEmpty, 'error');
      var type = arg.trim();
      var data = (type == 'html' ? visual.messagesToHTML : visual.messagesToText)(ui.messages);
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
      var body = chat.formatOutgoing(arg);
      xmpp.sendMessage(body);
    },

    /**
     * unban
     *   Unban a user from the current room.
     */
    unban: function(arg) {
      arg = chat.parseArgs(arg);
      arg.jid = Strophe.getBareJid(arg.jid || arg[0][0]);

      xmpp.getUsers({affiliation: 'outcast'}, function(stanza) {
        if ($('item', stanza).is(function() { return $(this).attr('jid') === arg.jid; }))
          this.affiliate({type: 'none', jid: arg.jid});
        else
          ui.messageAddInfo(strings.error.unbanNone, 'error');
      }.bind(this), function(stanza) {
        if ($('forbidden', iq).length)
          ui.messageAddInfo(strings.error.banList.forbidden, 'error');
        else ui.messageAddInfo(strings.error.banList['default'], 'error');
      });
    },

    /**
     * version
     *   Emit the config.version key.
     */
    version: function() {
      var version = visual.format.plain(config.version);
      version = '<a href="https://github.com/cburschka/cadence/tree/'
              + version + '">' + version + '</a>';
      ui.messageAddInfo(strings.info.versionClient, {version: version});
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
        return ui.messageAddInfo(strings.error[arg ? 'unknownRoom' : 'noRoom'], {name: arg}, 'error');
      if (room.id != xmpp.room.current) {
        xmpp.getOccupants(room.id, function(users) {
          var links = [];
          var nicks = Object.keys(users);
          nicks.sort();
          for (var i in nicks) links.push(visual.format.nick(nicks[i]));
          if (links.length) ui.messageAddInfo(strings.info.usersInRoom, {
            room: room,
            users: links.join(', ')
          });
          else ui.messageAddInfo(strings.info.noUsers, {room: room});
        })
      }
      else {
        var links = [];
        var nicks = Object.keys(xmpp.roster[xmpp.room.current]);
        nicks.sort();
        for (var i in nicks) {
          var user = xmpp.roster[xmpp.room.current][nicks[i]];
          links.push(visual.format.user(user));
        }
        ui.messageAddInfo(strings.info.usersInThisRoom, {users: links.join(', ')});
      }
    },

    /**
     * whois <nick>
     *   Print out information on a participant in the current room.
     */
    whois: function(arg) {
      arg = arg.trim();
      if (!arg) return ui.messageAddInfo(strings.error.noArgument, 'error');
      var user = xmpp.roster[xmpp.room.current][arg];
      if (user) {
        ui.messageAddInfo(strings.info.whois, {
          user: user,
          jid: user.jid || '---',
          privilege: user.role + '/' + user.affiliation,
          status: user.show + (user.status ? ' (' + user.status + ')' : '')
        });
      }
      else ui.messageAddInfo(strings.error.unknownUser, {nick: arg}, 'error');
    }
  },

  /**
   * Validate the current command by xmpp.status.
   */
  cmdAvailableStatus: function(command, silent) {
    var always = ['alias', 'clear', 'nick', 'save', 'version'];
    var chat = ['affiliate', 'away', 'back', 'ban', 'bans', 'dnd', 'invite', 'kick', 'me', 'msg', 'part', 'say', 'unban', 'whois'];
    var offline = ['connect'];
    var waiting = ['quit'];

    // always allow these commands (hence the name).
    if (always.indexOf(command) >= 0) return true;

    switch (xmpp.status) {
      case 'prejoin':
        // do not allow chat commands in prejoin.
        if (chat.indexOf(command) >= 0)
          return !silent && ui.messageAddInfo(strings.error.cmdStatus.prejoin, {cmd:command}, 'error') && false;
      case 'online':
        // do not allow offline commands in prejoin or in rooms.
        if (offline.indexOf(command) >= 0)
          return !silent && ui.messageAddInfo(strings.error.cmdStatus.online, {cmd:command}, 'error') && false;
        return true;

      // switch from blacklist to whitelist here.
      case 'waiting':
        if (waiting.indexOf(command) >= 0) return true;
      case 'offline':
        // allow offline commands while waiting or offline.
        if (offline.indexOf(command) >= 0) return true;
        return !silent && ui.messageAddInfo(strings.error.cmdStatus.offline, {cmd:command}, 'error') && false;
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
   * Format an outgoing message.
   *
   * @param {string} text The message to send.
   * @return {object} An object with `html` and `text` keys, containing
   *         the html and markdown versions of the message.
   */
  formatOutgoing: function(text) {
    text = visual.lengthLimit(text, config.ui.maxMessageLength);
    var html = bbcode.render(visual.format.plain(text));
    if (config.settings.textColor) {
      html = '<span class="color" data-color="' + config.settings.textColor + '">' + html + '</span>';
    }
    return {html: html, text: bbcodeMD.render(text)};
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
  prefixMsg: function(nick, direct) {
    nick = nick.replace(/[\\\s]/g, '\\$&');
    var text = ui.dom.inputField.val();
    var m = text.match(/\/d?msg\s+((\\[\\\s]|[^\\\s])+)/);
    if (m) text = text.substring(m[0].length).trimLeft();
    if (nick) text = (direct ? '/dmsg ' : '/msg ') + nick + ' ' + text;
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
   * Parse a commandline-style argument string.
   *
   * @param {string} args the raw argument string.
   *
   * @return An object with named and positional arguments.
   *         The array of positional arguments is stored in the 0 key.
   *         The 1 key stores the end position of each named or positional argument.
   */
  parseArgs: function(text) {
    if (typeof text !== 'string') return text;
    var key = /(?:--([a-z-]+))/;
    // Values can be single- or double-quoted. Quoted values can contain spaces.
    // All spaces and conflicting quotes can be escaped with backslashes.
    // All literal backslashes must also be escaped.
    var value = /(?:"((?:\\[\\"]|[^\\"])+)"|'((?:\\[\\']|[^\\'])+)'|([^"'\s](?:\\[\\\s]|[^\\\s])*))/;
    // A keyvalue assignment can be separated by spaces or an =.
    // When separated by spaces, the value must not begin with an unquoted --.
    var keyvalue = RegExp(key.source + '(?:=|\\s+(?!--))' + value.source);
    var re = RegExp('\\s+(?:' + keyvalue.source + '|' + key.source + '|' + value.source + ')', 'g');
    var arguments = {0:[], 1:{0:[]}};
    for (var match; match = re.exec(text); ) {
      // keyvalue: 1 = key, 2|3|4 = value
      if (match[1]) {
        var v = (match[2] || match[3] || match[4]).replace(/\\([\\\s"'])/g, '$1');
        if (['0', 'no', 'off', 'false'].indexOf(v) >= 0) v = false;
        arguments[match[1]] = v;
        arguments[1][match[1]] = re.lastIndex;
      }
      // key: 5 = key
      else if (match[5]) {
        arguments[match[5]] = true;
        arguments[1][match[5]] = re.lastIndex;
      }
      // value: 6|7|8 = value
      else {
        arguments[0].push((match[6] || match[7] || match[8]).replace(/\\([\\\s"'])/g, '$1'));
        arguments[1][0].push(re.lastIndex);
      }
    }
    return arguments;
  },

  /**
   * Convert arguments to room configuration form.
   */
  roomConf: function(args) {
    var conf = {};
    conf['muc#roomconfig_roomname'] = args.title || args.name;

    if (args.desc) conf['muc#roomconfig_roomdesc'] = args.desc;
    if (args.log !== undefined)
      conf['muc#roomconfig_enablelogging'] = args.log ? '1' : '0';
    if (args.persistent !== undefined)
      conf['muc#roomconfig_persistentroom'] = args.persistent ? '1' : '0';
    if (args['public'] !== undefined)
      conf['muc#roomconfig_publicroom'] = args['public'] ? '1' : '0';
    if (args.anonymous !== undefined)
      conf['muc#roomconfig_whois'] = args.anonymous ? 'moderators' : 'anyone';
    if (args.password !== undefined) {
      conf['muc#roomconfig_passwordprotectedroom'] = args.password ? '1' : '0';
      conf['muc#roomconfig_roomsecret'] = args.password;
    }
    if (args['members-only'] !== undefined)
      conf['muc#roomconfig_membersonly'] = args.membersonly ? '1' : '0';
    return conf;
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
    if (window.localStorage) {
      localStorage.settings = JSON.stringify(config.settings);
    }
    else {
      Cookies.set(config.clientName + '_settings', config.settings, {expires: 365});
    }
  }
}
