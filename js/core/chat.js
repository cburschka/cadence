/**
 * chat.js contains all the functions that alter the state
 * in response to user requests.
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

      var query = m.interactive ? (x, submit) => { ui.formDialog(ui.dataForm(x, submit)); } : arg;
      var command = m.cmd;

      xmpp.submitCommand(command, query, (stanza, status) => {
        if (status < 2 && stanza) {
          if ($('forbidden', stanza).length)
            ui.messageAddInfo(strings.error.admin.forbidden, {command}, 'error');
          else if ($('service-unavailable', stanza).length)
            ui.messageAddInfo(strings.error.admin.badCommand, {command}, 'error');
          else if ($('text', stanza).length)
            ui.messageAddInfo(strings.error.admin.generic, {command, text: $('text', stanza).text()}, 'error');
          else ui.messageAddInfo(strings.error.admin.unknown, {command}, 'error');
        }
        else {
          var result = [];
          $('field[type!="hidden"]', stanza).each(function() {
            result.push($('<strong>').text($(this).attr('label') + ': '), $(this).text(), $('<br>'));
          });
          ui.messageAddInfo(strings.info.admin[result.length ? 'result' : 'completed'], {command, result});
        }
      });
    },

    /**
     * affiliate owner|admin|member|none [<nick>|<jid>]
     *   Set the affiliation of a particular user, or list all users with an affiliation.
     */
    affiliate: function(arg) {
      arg = chat.parseArgs(arg);

      const type = arg.type || arg[0][0];

      const nick = arg.nick || arg[0][1];
      const jid = xmpp.JID.parse(arg.jid || arg[0][1]);

      const roster = xmpp.roster[xmpp.room.current];
      // Look up the nickname unless --jid was explicitly used.
      const user = !arg.jid && roster[nick] || String(jid) && {jid};

      if (['owner', 'admin', 'member', 'outcast', 'none'].indexOf(type) < 0)
        return ui.messageAddInfo(strings.error.affiliate.type, {type}, 'error')

      // List users with a specific affiliation.
      if (!user) {
        return xmpp.getUsers({affiliation: type}).then((stanza) => {
          // Create a dictionary of non-occupant users:
          const users = {};
          $('item', stanza).map((s,t) => {
            return xmpp.JID.parse(t.getAttribute('jid'));
          }).each((i,jid) => {
            users[jid.toLowerCase()] = {jid};
          });

          if ($.isEmptyObject(users)) {
            return ui.addMessageInfo(strings.info.affiliationsEmpty, {type});
          }

          // Find users who are occupants:
          for (let nick in roster) {
            let jid = roster[nick].jid.bare().toLowerCase();
            if (jid in users) users[jid] = roster[nick];
          }

          for (let jid in users) users[jid] = visual.format.user(users[jid]);

          ui.messageAddInfo(strings.info.affiliations[type], {type, list: users});
        }, (stanza) => {
          var type = ($('forbidden', iq).length) ? 'forbidden' : 'default';
          ui.messageAddInfo(strings.error.affiliations[type], {type}, 'error');
        });
      }

      // User is present but anonymous:
      if (!user.jid)
        return ui.messageAddInfo(strings.error.affiliate.anon, {user}, 'error');
      // User is not in the room (therefore their JID is actually just a nick).
      if (!user.jid.node)
        return ui.messageAddInfo(strings.error.affiliate.unknown, {nick: user.jid}, 'error');

      // If a JID was given, fetch the user if they're present.
      if (!user.nick)
        for (let nick in roster)
          if (roster[nick].jid.bare() == user.jid) user = roster[nick];

      // Attempt to set user's affiliation.
      xmpp.setUser({jid: user.jid, affiliation: type}).then(() => {
        const room = xmpp.room.available[xmpp.room.current];
        ui.messageAddInfo(strings.info.affiliate, {user, room, type});
      }, (e) => {
        let error = 'default';
        if ($('not-allowed', e).length) error = 'notAllowed';
        else if ($('conflict', e).length) error = 'conflict';
        ui.messageAddInfo(strings.error.affiliate[error], {user, type}, 'error');
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
        if (out) return ui.messageAddInfo($('<div>').html(strings.info.macros), {
          macros: out
        });
        else return ui.messageAddInfo(strings.error.noMacros, 'error');
      }
      var m = arg.match(/^\/*(\S+)/);
      if (!m) return ui.messageAddInfo($('<div>').html(strings.error.aliasFormat), 'error');
      var command = m[1];
      if (chat.commands[command]) return ui.messageAddInfo(strings.error.aliasConflict, {command}, 'error');
      var macro = arg.substring(m[0].length).trim();
      if (!macro) {
        delete config.settings.macros[command];
        chat.saveSettings();
        return ui.messageAddInfo(strings.info.aliasDelete, {command});
      }
      macro = macro.split(';');
      for (var i in macro) {
        macro[i] = macro[i].trim();
      }
      if (macro.length == 1 && !macro[0].match(/\$/)) macro[0] += ' $';

      var search = (c, t) => {
        if (c) for (var i in c) {
          var m = c[i].match(/^\/(\S+)/);
          var u = m && ((m[1] == command && t.concat([m[1]])) || search(config.settings.macros[m[1]], t.concat([m[1]])));
          if (u) return u;
        }
        return false;
      };
      var rec = search(macro, [command]);
      if (rec) return ui.messageAddInfo(strings.error.aliasRecursion, {
        command, path: rec.join(' -> ')
      }, 'error');

      if (config.settings.macros[command]) {
        ui.messageAddInfo(strings.info.aliasReplace, {command});
      }
      else ui.messageAddInfo(strings.info.aliasAdd, {command});
      config.settings.macros[command] = macro;
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
      chat.history = [];
      chat.historyIndex = 0;
    },

    /**
     * configure [room] <args>
     *   Alter a room configuration.
     */
    configure: function(arg) {
      arg = chat.parseArgs(arg);
      if (arg.help)
        return ui.messageAddInfo($('<div>').html(strings.help.configure));

      const name = arg.name || arg[0].join(' ') || xmpp.room.current;
      if (!name)
        return ui.messageAddInfo(strings.error.noRoom, 'error');

      const room = xmpp.room.available[name] || {id: name, title: name};

      // Define error handler separately, since it's used both on getting
      // and submitting the form, which use distinct promise chains.
      const error = (stanza) => {
        if ($('item-not-found', stanza).length)
          ui.messageAddInfo(strings.error.unknownRoom, {name}, 'error');
        else if ($('forbidden', stanza).length)
          ui.messageAddInfo(strings.error.roomConfDenied, {room}, 'error');
        else
          ui.messageAddInfo(strings.error.roomConf, {room}, 'error');
      };

      xmpp.roomConfig(name).then(
        (config) => {
          // Interactive configuration with --interactive, or with a command
          // that contains no named arguments other than --name.
          const interactive = arg.interactive || Object.keys(arg).every(
            (key) => { return key*0 === 0 || key == 'name' }
          );

          // Form submission uses a callback because it can be triggered multiple times.
          const form = ui.dataForm(config, (data) => {
            xmpp.roomConfigSubmit(name, data).then(() => {
              ui.messageAddInfo(strings.info.roomConf)
            }, error);
          });
          ui.formDialog(form, {cancel: () => { xmpp.roomConfigCancel(name); }});
        }, error
      );
    },

    /**
     * connect <user> <pass>
     * connect {user:<user>, pass:<pass>}
     *   Open a connection and authenticate.
     */
    connect: function(arg) {
      var fail = () => { return ui.messageAddInfo(strings.error.userpass, 'error') };
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
      if (arg.help)
        return ui.messageAddInfo($('<div>').html(strings.help.configure));

      const name = arg.name || arg[0].join(' ') || arg.title;
      const id = name.toLowerCase();
      if (!name)
        return ui.messageAddInfo(strings.error.roomCreateName, 'error');

      const room = {id, title: arg.title || name};

      // Look for the room to make sure it doesn't exist.
      xmpp.getRoomInfo(id)
      .then((room) => {
        ui.messageAddInfo(strings.error.roomExists, {room}, 'error');
        throw 'exists' ;
      }, (error) => {
        // Catch only an <item-not-found> error.
        if (!$('item-not-found', error).length) {
          throw error;
        }
      })
      .then(() => {
        ui.messageAddInfo(strings.info.creating, {
          room,
          user: {
            nick: xmpp.nick.target,
            jid: xmpp.connection.jid
          }
        });

        // Start a new Promise chain here, in order to abort on an "exists" error.
        return xmpp.joinRoom({room: id})
        // Request the configuration form.
        .then(() => {
          return xmpp.roomConfig(id);
        })
        .then((conf) => {
          // Unlike /configure, this form is in the promise chain.
          // It can only be submitted once.
          return new Promise((resolve, reject) => {
            if (arg.interactive) {
              const form = ui.dataForm(conf, resolve);
              ui.formDialog(form, {cancel: () => { reject('cancel'); }, apply: false});
            }
            // Use command-line arguments or just set the room title.
            else resolve(chat.roomConf(arg) || {
              'muc#roomconfig_roomname': room.title
            });
          });
        })
        .then(
          (data) => {
            return xmpp.roomConfigSubmit(id, data);
          },
          (reason) => {
            if (reason == 'cancel') xmpp.roomConfigCancel(id);
            throw reason;
          }
        )
        .then(
          () => {
            chat.setSetting('xmpp.room', id);
            ui.setFragment(id);
            ui.messageAddInfo(strings.info.roomCreated, {room});
          },
          (reason) => {
            if (reason == 'cancel') {
              // The server may not destroy the room on its own:
              xmpp.leaveRoom(id);
              ui.messageAddInfo(strings.error.roomCreateCancel, 'error');
              throw reason;
            }
            else ui.messageAddInfo(strings.error.roomConf, {room}, 'error');
          }
        )
        .then(() => { return xmpp.discoverRooms(); })
        .then((rooms) => {
          const room = rooms[id];
          ui.updateRoom(id, xmpp.roster[id]);
          ui.messageAddInfo(strings.info.joined, {room});
        });
      })
      .catch(() => {});
    },

    destroy: function(arg) {
      arg = chat.parseArgs(arg);

      const name = arg.room || (arg[0] && arg[0][0]) || xmpp.room.current;
      if (!name)
        return ui.messageAddInfo(strings.error.noRoom, 'error');

      const room = xmpp.room.available[name];
      if (!room)
        return ui.messageAddInfo(strings.error.unknownRoom, {name}, 'error');

      const confirm = visual.formatText(strings.info.destroyConfirm, {room});
      if (!window.confirm(confirm.text())) return;

      xmpp.destroyRoom(name, arg.alternate, arg.reason).then(
        () => {
          ui.messageAddInfo(strings.info.destroySuccess, {room});
        },
        (stanza) => {
          if ($('forbidden', stanza).length)
            ui.messageAddInfo(strings.error.destroyDenied, {room}, 'error');
          else
            ui.messageAddInfo(strings.error.destroy, {room}, 'error');
        }
      );
    },

    /**
     * dmsg <jid>
     *   Send a direct message to a user outside the chatroom.
     */
    dmsg: function(arg) {
      const m = chat.parseArgs(arg);

      let jid = m.jid;
      let msg = m.msg;
      if (m[0].length) {
        jid = jid || m[0][0];
        msg = msg || arg.substring(m[1][0][0]).trim();
      }

      if (!jid || !msg)
        return ui.messageAddInfo(strings.error.noArgument, 'error');

      jid = xmpp.JID.parse(jid);

      if (!jid.node)
        return ui.messageAddInfo(strings.error.jidInvalid, {arg: jid});

      var body = chat.formatOutgoing(msg);
      xmpp.sendMessage(body, {jid});

      ui.messageAppend(visual.formatMessage({
        type: 'chat',
        to: {jid},
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
        m.jid = m[0][0];
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
      const name = arg.name || arg[0].join(" ").trim();
      if (!name) return ui.messageAddInfo(strings.error.noArgument, 'error');

      // Keep room in function scope to avoid passing it through the promises.
      let room = false;

      // Refresh room list and try to find the room.
      return xmpp.discoverRooms()
      .then(() => {
        room = chat.getRoomFromTitle(name);
        if (!room)
          throw ui.messageAddInfo(strings.error.unknownRoom, {name}, 'error');
        else if (room.id == xmpp.room.current)
          throw ui.messageAddInfo(strings.error.joinSame, {room}, 'error');
      })
      // Maybe find a registered nick, ignoring errors.
      .then(() => {
        if (config.settings.xmpp.registerNick)
          return xmpp.getReservedNick(room.id).catch(() => {});
      })
      .then((nick) => {
        ui.messageAddInfo(strings.info.joining, {
          room,
          user: {
            nick: xmpp.nick.target,
            jid: xmpp.currentJid
          }
        }, 'verbose');
        return xmpp.joinRoom({room: room.id, nick, password: arg.password});
      })
      .then(() => {
        ui.updateRoom(room.id, xmpp.roster[room.id]);
        ui.setFragment(room.id);
        chat.setSetting('xmpp.room', room.id);
        ui.messageAddInfo(strings.info.joined, {room});
      });
    },

    /**
     * kick <nick>
     *   Ask XMPP to kick a user.
     *   The client will not validate the command or its authority; that's the
     *   server's job.
     */
    kick: function(arg) {
      var nick = arg.trim();
      xmpp.setUser({nick, role: 'none'}, () => {}, (errorCode) => {
        ui.messageAddInfo(strings.error.kick[errorCode], {nick}, 'error');
      });
    },

    /**
     * list:
     *   List available rooms.
     */
    list: function() {
      xmpp.discoverRooms().then(
        (rooms) => {
          let links = {};
          for (var room in rooms) links[room] = visual.format.room(rooms[room]);
          if (Object.keys(links).length)
            ui.messageAddInfo(strings.info.roomsAvailable, {list: links});
          else
            ui.messageAddInfo(strings.error.noRoomsAvailable, 'error');
        },
        (error) => {
          const type = ($('remote-server-not-found', error).length) ? 404 : 'default';
          let text = $('text', error).text();
          text = text ? ' (' + text + ')' : '';
          ui.messageAddInfo(strings.error.muc[type] + text, {domain: config.xmpp.mucService}, 'error');
        }
      );
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
      if (xmpp.status != 'online')
        ui.messageAddInfo(strings.info.nickPrejoin, {nick});
    },

    /**
     * part
     *   Leave the current room without joining a different one.
     */
    part: function() {
      const room = xmpp.room.current;
      if (room) {
        ui.setFragment(null);
        xmpp.leaveRoom(room);
        ui.messageAddInfo(strings.info.leave, {room: xmpp.room.available[room]}, 'verbose');
      }
      else {
        ui.messageAddInfo("You're not in a room.", 'error');
      }
    },

    /**
     * ping <nick>|<jid>
     *   Send a ping and display the response time.
     */
    ping: function(arg) {
      arg = arg.trim();
      const jid = xmpp.JID.parse(arg);
      const direct = !!jid.resource; // Only accept full JIDs.

      const target = arg && (direct ? {jid} : {nick: arg});
      const user = !direct && xmpp.roster[xmpp.room.current][arg] || target;
      const time = (new Date()).getTime();

      xmpp.ping(target && xmpp.jid(target)).then((stanza) => {
        const delay = ((new Date()).getTime() - time).toString();
        ui.messageAddInfo(strings.info.pong[+!!user], {user, delay});
      }, (stanza) => {
        if ($('item-not-found', stanza).length)
          ui.messageAddInfo(strings.error.unknownUser, {nick: arg}, 'error');
        else if (stanza)
          ui.messageAddInfo(strings.error.pingError, 'error');
        else {
          const delay = ((new Date()).getTime() - time).toString();
          ui.messageAddInfo(strings.error.pingTimeout[+!!user], {user, delay}, 'error');
        }
      });
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
      var timestamp = moment(new Date(ui.messages[0].timestamp)).format('YYYY-MM-DD');
      if (type == 'html') {
        data = '<!DOCTYPE html>' + $('<html>')
             .append($('<head>').append($('<title>').text(
               xmpp.room.available[xmpp.room.current].title + ' (' + timestamp + ')'
             )))
             .append($('<body>').append(data))
             .html();
      }
      var blob = new Blob([data], {type: 'text/' + type + ';charset=utf-8'});
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
     * time [<nick>|<jid>]
     *   Send a time request and display the response.
     */
    time: function(arg) {
      arg = arg.trim();
      if (!arg)
        return ui.messageAddInfo(strings.error.noArgument, 'error');

      const jid = xmpp.JID.parse(arg);
      const direct = !!jid.resource; // Only accept full JIDs.
      const target = direct ? {jid} : {nick: arg};
      const user = !direct && xmpp.roster[xmpp.room.current][arg] || target;
      const start = new Date();

      xmpp.getTime(xmpp.jid(target)).then((stanza) => {
        const now = new Date();
        const tzo = $('tzo', stanza).text();
        const utc = new Date($('utc', stanza).text());
        const time = moment(utc).utcOffset(tzo);
        let offset = (utc - now) + (now - start) / 2
        if (offset > 0) offset = '+' + offset;
        ui.messageAddInfo(strings.info.time, {user, tzo, time, offset});
      }, (stanza) => {
        if ($('item-not-found', stanza).length)
          ui.messageAddInfo(strings.error.unknownUser, {nick: arg}, 'error');
        else
          ui.messageAddInfo(strings.error.query[1], {user}, 'error');
      });
    },

    /**
     * unban
     *   Unban a user from the current room.
     */
    unban: function(arg) {
      arg = chat.parseArgs(arg);
      const jid = xmpp.JID.parse(arg.jid || arg[0][0]);

      xmpp.getUsers({affiliation: 'outcast'}).then((stanza) => {
        const isBanned = $('item', stanza).is(function() {
          return this.getAttribute('jid') == jid;
        });
        if (isBanned) this.affiliate({type: 'none', jid});
        else
          ui.messageAddInfo(strings.error.unbanNone, 'error');
      }, (stanza) => {
        if ($('forbidden', iq).length)
          ui.messageAddInfo(strings.error.banList.forbidden, 'error');
        else ui.messageAddInfo(strings.error.banList['default'], 'error');
      });
    },

    /**
     * version
     *   Either print the client and server version, or query another user.
     */
    version: function(arg) {
      arg = arg.trim();
      if (!arg) {
        ui.messageAddInfo(strings.info.versionClient, {
          version: $('<a>')
            .attr('href', 'https://github.com/cburschka/cadence/tree/' + config.version)
            .text(config.version)
        });
      }
      if (xmpp.status == 'offline')
        return arg && ui.messageAddInfo(strings.error.cmdStatus.offline, {command: 'version'}, 'error');

      const jid = xmpp.JID.parse(arg);
      const direct = !!jid.resource;
      const target = arg ? (direct ? {jid} : {nick: arg}) : {};
      const user = arg && (!direct && xmpp.roster[xmpp.room.current][arg] || target);

      return xmpp.getVersion(xmpp.jid(target)).then((stanza) => {
        const name = $('name', stanza).text();
        const version = $('version', stanza).text();
        const os = $('os', stanza).text();
        if (user)
          ui.messageAddInfo(strings.info.versionUser, {name, version, os, user});
        else
          ui.messageAddInfo(strings.info.versionServer, {name, version, os});
      }, (stanza) => {
        if ($('item-not-found', stanza).length != 0)
          ui.messageAddInfo(strings.error.unknownUser, {nick: arg}, 'error');
        else
          ui.messageAddInfo(strings.error.query[+!!user], {user}, 'error');
      });
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
        xmpp.getOccupants(room.id, (users) => {
          var list = {};
          for (var nick in users) list[nick] = visual.format.nick(nick);
          if (links.length) ui.messageAddInfo(strings.info.usersInRoom, {
            room: room,
            list: list
          });
          else ui.messageAddInfo(strings.info.noUsers, {room});
        })
      }
      else {
        var list = {};
        var roster = xmpp.roster[xmpp.room.current];
        for (var nick in roster) {
          list[nick] = visual.format.user(roster[nick]);
        }
        ui.messageAddInfo(strings.info.usersInThisRoom, {list});
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
          user,
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
          return !silent && ui.messageAddInfo(strings.error.cmdStatus.prejoin, {command}, 'error') && false;
      case 'online':
        // do not allow offline commands in prejoin or in rooms.
        if (offline.indexOf(command) >= 0)
          return !silent && ui.messageAddInfo(strings.error.cmdStatus.online, {command}, 'error') && false;
        return true;

      // switch from blacklist to whitelist here.
      case 'waiting':
        if (waiting.indexOf(command) >= 0) return true;
      case 'offline':
        // allow offline commands while waiting or offline.
        if (offline.indexOf(command) >= 0) return true;
        return !silent && ui.messageAddInfo(strings.error.cmdStatus.offline, {command}, 'error') && false;
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
    var command = 'say';

    // Execute /command, but turn //command into /say /command.
    var m = /^\/(\/?)(\S+)/.exec(text);
    if (m) {
      if (!m[1]) {
        command = m[2];
        text = text.substring(m[0].length);
      }
      else text = text.substring(1);
    }

    if (this.commands[command]) {
      if (this.cmdAvailableStatus(command)) this.commands[command](text);
    }
    else if (config.settings.macros[command])
      this.executeMacro(config.settings.macros[command], text);
    else
      ui.messageAddInfo(strings.error.cmdUnknown, {command}, 'error');
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
    var html = bbcode.render(visual.escapeHTML(text));
    if (config.settings.textColor) {
      html = '<span class="color" data-color="' + config.settings.textColor + '">' + html + '</span>';
    }
    return {html, text: bbcodeMD.render(text)};
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
    nick = nick.replace(/[\\\s"']/g, '\\$&');
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
    var value = /(?:"((?:\\.|[^\\"])+)"|'((?:\\.|[^\\'])+)'|(?!["'\s])((?:\\.|[^\\\s])*))/;
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
        arguments[0].push((match[6] || match[7] || match[8]).replace(/\\(.)/g, '$1'));
        arguments[1][0].push(re.lastIndex);
      }
    }
    return arguments;
  },

  /**
   * Convert arguments to room configuration form.
   */
  roomConf: function(args) {
    const conf = {};

    const title = args.title || args.name;
    if (title)
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
    if (!$.isEmptyObject(conf)) return conf;
  },

  /**
   * Attempt to authenticate using an existing web session.
   */
  sessionAuth: function(url, callback) {
    var salt = (new Date().getTime()) + Math.random();
    $.post(url, {salt}, ({user, secret}) => {
      if (user && secret) {
        ui.messageAddInfo(strings.info.sessionAuth, {username: user});
        chat.commands.connect({user, pass: secret});
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
