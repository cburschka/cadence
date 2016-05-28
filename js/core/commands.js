/**
 * @file commands.js
 *   This defines all the core commands available in cadence.
 */

/**
 * admin <cmd> <msg>:
 *   Execute a server admin command.
 */
Cadence.addCommand('admin',
arg => {
  const command = arg.cmd;
  if (!command)
    return ui.messageError(strings.error.noArgument);

  // Interactive configuration with --interactive, or with a command
  // that contains no named arguments other than --cmd.
  const interactive = arg.interactive || Object.keys(arg).every(
    (key) => { return key*0 === 0 || key == 'cmd' }
  );

  let sessionid;

  xmpp.command(command)
  .then((stanza) => {
    sessionid = $('command', stanza).attr('sessionid');
    return new Promise((resolve, reject) => {
      if (interactive) {
        const form = ui.dataForm(stanza, resolve);
        ui.formDialog(form, {cancel: reject, apply: false});
      }
      else {
        const args = {};
        $('x > field', stanza).each(function() {
          const name = $(this).attr('var');
          const values = $.makeArray($('value', this).map(function() {
            return $(this).text();
          }));
          args[name] = arg[name] !== undefined ? [arg[name]] : values;
        });
        resolve(args);
      }
    });
  })
  .then((data) => {
    return xmpp.commandSubmit(command, sessionid, data);
  })
  .then((stanza) => {
    const result = [];
    $('field[type!="hidden"]', stanza).each(function() {
      const label = $(this).attr('label');
      const value = $(this).text();
      result.push($('<strong>').text(value + ':'), ' ', value, $('<br>'));
    });

    ui.messageInfo(strings.info.admin[result.length ? 'result' : 'completed'], {command, result});
  })
  .catch((stanza) => {
    if ($('forbidden', stanza).length)
      ui.messageError(strings.error.admin.forbidden, {command});
    else if ($('service-unavailable', stanza).length)
      ui.messageError(strings.error.admin.badCommand, {command});
    else if ($('text', stanza).length)
      ui.messageError(strings.error.admin.generic, {command, text: $('text', stanza).text()});
    else ui.messageError(strings.error.admin.unknown, {command});
  });
},
string => {
  const m = Cadence.parseArgs(string);

  // Make single-argument commands more convenient:
  const defaultArgs = {
    'announce': 'body',
    'get-user-lastlogin': 'accountjid',
    'set-motd': 'body',
    'user-stats': 'accountjid',
  }

  // Use first positional argument as command.
  if (m[0].length) m.cmd = m[0][0];
  // If there is more, use the remaining text as an argument.
  if (m[0].length > 1 && m.cmd in defaultArgs)
    m[defaultArgs[m.cmd]] = arg.substring(m[1][0][0]).trim();
  return m;
});

/**
 * affiliate owner|admin|member|none [<nick>|<jid>]
 *   Set the affiliation of a particular user, or list all users with an affiliation.
 */
Cadence.addCommand('affiliate',
({type, nick, jid}) => {
  const roster = xmpp.roster[xmpp.room.current];
  const target = jid ? {jid} : roster[nick];

  if (!['owner', 'admin', 'member', 'outcast', 'none'].includes(type))
    return ui.messageError(strings.error.affiliate.type, {type})

  // List users with a specific affiliation.
  if (!target) {
    return xmpp.getUsers({affiliation: type}).then((stanza) => {
      // Create a dictionary of non-occupant users:
      const users = {};
      $('item', stanza).map(function() {
        return xmpp.JID.parse(this.getAttribute('jid'));
      }).each((i,jid) => {
        users[String(jid).toLowerCase()] = {jid};
      });

      if ($.isEmptyObject(users)) {
        return ui.messageInfo(strings.info.affiliationsEmpty, {type});
      }

      // Find users who are occupants:
      for (let nick in roster) {
        let jid = roster[nick].jid.bare().toLowerCase();
        if (jid in users) users[jid] = roster[nick];
      }

      for (let jid in users) users[jid] = visual.format.user(users[jid]);

      ui.messageInfo(strings.info.affiliations[type], {type, list: users});
    }, (stanza) => {
      const type = ($('forbidden', iq).length) ? 'forbidden' : 'default';
      ui.messageError(strings.error.affiliations[type], {type});
    });
  }

  // If a JID was given, fetch the user if they're present.
  const user = jid && $.map(roster, x => x).find(x => jid.matchBare(x.jid)) || target;

  // User is present but anonymous:
  if (!user.jid)
    return ui.messageError(strings.error.affiliate.anon, {user});
  // User is not in the room (therefore their JID is actually just a nick).
  if (!user.jid.node)
    return ui.messageError(strings.error.affiliate.unknown, {nick: user.jid});

  // Attempt to set user's affiliation.
  xmpp.setUser({jid: user.jid, affiliation: type}).then(() => {
    const room = xmpp.room.available[xmpp.room.current];
    ui.messageInfo(strings.info.affiliate, {user, room, type});
  }, (e) => {
    let error = 'default';
    if ($('not-allowed', e).length) error = 'notAllowed';
    else if ($('conflict', e).length) error = 'conflict';
    ui.messageError(strings.error.affiliate[error], {user, type});
  });
},
string => {
  const arg = Cadence.parseArgs(string);
  arg[0] = arg[0] || [];

  if (!arg.type) arg.type = arg[0][0];

  if (!arg.nick) arg.nick = arg[0][1];
  arg.jid = xmpp.JID.parse(arg.jid || arg[0][1]);
  return arg;
});

/**
 * alias <cmd> <commands>
 *   Create a macro.
 */
Cadence.addCommand('alias',
({command, macro}) => {
  if (!command) {
    const macros = $.map(
      config.settings.macros,
      (value, key) => ('    /' + key + ' - ' + value.join('; '))
    ).join('\n');

    if (macros) {
      return ui.messageInfo($('<div>').html(strings.info.macros), {macros});
    }
    else {
      return ui.messageError(strings.error.noMacros);
    }
  }

  if (command in Cadence.commands) {
    return ui.messageError(strings.error.aliasConflict, {command});
  }
  if (!macro) {
    delete config.settings.macros[command];
    Cadence.saveSettings();
    return ui.messageInfo(strings.info.aliasDelete, {command});
  }

  // Run a DFS to avoid recursive macros.
  const macros = config.settings.macros;
  const search = (macro, path) => {
    if (macro) for (let statement of macro) {
      let [,cmd] = statement.match(/^\/(\S+)/) || [];
      path = path.concat([cmd]);
      if (cmd == command) return path;
      else return search(macros[cmd], path);
    }
    return false;
  };
  const recursion = search(macro, [command]);
  if (recursion) return ui.messageError(strings.error.aliasRecursion, {
    command, path: recursion.join(' -> ')
  });

  if (macros[command]) {
    ui.messageInfo(strings.info.aliasReplace, {command});
  }
  else ui.messageInfo(strings.info.aliasAdd, {command});
  macros[command] = macro;
  Cadence.saveSettings();
},
string => {
  string = string.trim();
  if (!string) return;

  const [prefix, command] = string.match(/^\/*(\S+)/) || [];
  if (!command) {
    return ui.messageError($('<div>').html(strings.error.aliasFormat));
  }
  const data = string.substring(prefix.length);
  if (!data) return {command};

  const macro = split(';').map(st => st.trim());
  if (macro.length == 1 && !macro[0].match(/\$/)) macro[0] += ' $';
  return {command, macro};
});

(() => {
  const parser = string => ({status: string.trim()});
  for (let show of ['away', 'dnd', 'xa']) {
    Cadence.addCommand(show, ({status}) => {
      xmpp.sendStatus({show, status});
      ui.setUserStatus(show);
    }, parser);
  }
  Cadence.addCommand('back', ({status}) => {
    xmpp.sendStatus({show: 'available', status});
    ui.setUserStatus('available');
  }, parser);
})();

/**
 * ban <nick>|<jid>
 *   Shortcut for "/affiliate outcast <nick|jid>".
 */
Cadence.addCommand('ban',
({nick, jid}) => {
  Cadence.execute('affiliate', {type: 'outcast', nick, jid});
},
string => {
  const arg = Cadence.parseArgs(string);
  const m = arg[0] && arg[0].length == 1 ? arg[0][0] : string.trim();
  arg.nick = arg.nick || m;
  arg.jid = arg.jid || xmpp.JID.parse(arg.jid || m);
  arg.jid = arg.jid.node && arg.jid;
  return arg;
});

/**
 * bans:
 *   Shortcut for "/affiliate outcast".
 */
Cadence.addCommand('bans', () => {
  Cadence.execute('affiliate', {type: 'outcast'});
});

/**
 * buzz <nick|jid>
 */
Cadence.addCommand('buzz', arg => {
  if (!arg)
    return ui.messageError(strings.error.noArgument);

  let jid = xmpp.JID.parse(arg);
  const direct = !!jid.node;

  const roster = xmpp.roster[xmpp.room.current];
  if (!direct && !(arg in roster))
    return ui.messageError(strings.error.unknownUser, {nick: arg});

  const user = direct ? {jid} : roster[arg];

  ui.messageInfo(strings.info.buzz, {user});

  xmpp.attention(direct ? jid : xmpp.jidFromRoomNick({nick: arg}));
}, string => string);

/**
 * clear:
 *   Clear the entire chat list screen.
 */
Cadence.addCommand('clear', () => {
  ui.clearMessages();
  Cadence.history = [];
  Cadence.historyIndex = 0;
});

/**
 * configure [room] <args>
 *   Alter a room configuration.
 */
Cadence.addCommand('configure', arg => {
  if (arg.help)
    return ui.messageInfo($('<div>').html(strings.help.configure));

  const name = arg.name || arg[0].join(' ') || xmpp.room.current;
  if (!name)
    return ui.messageError(strings.error.noRoom);

  const room = xmpp.room.available[name] || {id: name, title: name};

  // Define error handler separately, since it's used both on getting
  // and submitting the form, which use distinct promise chains.
  const error = stanza => {
    if ($('item-not-found', stanza).length)
      ui.messageError(strings.error.unknownRoom, {name});
    else if ($('forbidden', stanza).length)
      ui.messageError(strings.error.roomConfDenied, {room});
    else
      ui.messageError(strings.error.roomConf, {room});
  };

  xmpp.roomConfig(name).then(config => {
    // Interactive configuration with --interactive, or with a command
    // that contains no named arguments other than --name.
    const interactive = arg.interactive || Object.keys(arg).every(
      key => key*0 === 0 || key == 'name'
    );

    // Form submission uses a callback because it can be triggered multiple times.
    const form = ui.dataForm(config, data =>
      xmpp.roomConfigSubmit(name, data).then(() =>
        ui.messageInfo(strings.info.roomConf), error
      )
    );
    ui.formDialog(form, {cancel: () => xmpp.roomConfigCancel(name)});
  }, error);
});

/**
 * connect <user> <pass>
 * connect {user:<user>, pass:<pass>}
 *   Open a connection and authenticate.
 */
Cadence.addCommand('connect', arg => {
  if (arg && arg[0]) {
    arg.user = arg.user || arg[0][0];
    arg.pass = arg.pass || arg[0][1];
  }

  // This is a callback, because it happens after the promise is resolved.
  const disconnect = () => {
    ui.setConnectionStatus(false);
    ui.messageError(strings.info.connection.disconnected);
  }

  // First acquire the credentials.
  return new Promise((resolve, reject) => {
    if (arg.anonymous) return resolve({user: '', pass: ''});

    // Reuse authentication for the rest of the session:
    if (arg && arg.user && arg.pass) Cadence.auth = {user: arg.user, pass: arg.pass};
    if (Cadence.auth) return resolve(Cadence.auth);

    // Next, attempt session authentication.
    if (config.settings.xmpp.sessionAuth) {
      const url = config.xmpp.sessionAuthURL;
      if (url) return Cadence.sessionAuth(url).then(auth => {
        ui.messageInfo(strings.info.sessionAuth, {username: auth.user});
        resolve(auth);
      });
    }
    // Only complain about missing credentials on a manual invocation.
    reject(arg && ui.messageError(strings.error.connection.auth));
  })
  // Then use them to connect.
  .then(({user, pass}) => {
    ui.messageInfo(strings.info.connection.connecting);
    return xmpp.connect(user, pass, disconnect);
  })
  // Then either join a room or list the available rooms.
  .then(() => {
    ui.setConnectionStatus(true);
    ui.messageInfo(strings.info.connection.connected);
    // A room in the URL fragment (even an empty one) overrides autojoin.
    if (ui.getFragment() || config.settings.xmpp.autoJoin && !ui.urlFragment) {
      const name = ui.getFragment() || config.settings.xmpp.room;
      Cadence.execute('join', {name});
    }
    else Cadence.execute('list');
  },
  // Notify user of connection failures.
  ({status, error}) => {
    ui.setConnectionStatus(false);
    switch (status) {
      case Strophe.Status.AUTHFAIL:
        return ui.messageError(strings.error.connection.authfail);
      case Strophe.Status.CONNFAIL:
        if (error == 'x-strophe-bad-non-anon-jid') {
          return ui.messageError(strings.error.connection.anonymous)
        }
        return ui.messageError(strings.error.connection.connfail);
      case Strophe.Status.ERROR:
        return ui.messageError(strings.error.connection.other);
    }
  });
});

/**
 * create <room> [<args>]
 *   Join a new room and set it up.
 */
Cadence.addCommand('create', arg => {
  if (arg.help)
    return ui.messageInfo($('<div>').html(strings.help.configure));

  const name = arg.name || arg[0].join(' ') || arg.title;
  if (!name)
    return ui.messageError(strings.error.roomCreateName);

  const id = name.toLowerCase();
  const room = {id, title: arg.title || name};

  // Look for the room to make sure it doesn't exist.
  xmpp.getRoomInfo(id).then(
    room => {
      ui.messageError(strings.error.roomExists, {room});
      throw 'exists' ;
    },
    error => {
      // Catch only an <item-not-found> error.
      if (!$('item-not-found', error).length) throw error;
    }
  )
  .then(() => {
    ui.messageInfo(strings.info.creating, {
      room,
      user: {
        nick: xmpp.nick.target,
        jid: xmpp.jid
      }
    });

    // Start a new Promise chain here, in order to abort on an "exists" error.
    return xmpp.joinRoom({room: id})
    // Request the configuration form.
    .then(() => xmpp.roomConfig(id))
    .then(conf => {
      // Unlike /configure, this form is in the promise chain.
      // It can only be submitted once.
      return new Promise((resolve, reject) => {
        if (arg.interactive) {
          const form = ui.dataForm(conf, resolve);
          ui.formDialog(form, {cancel: () => { reject('cancel'); }, apply: false});
        }
        // Use command-line arguments or just set the room title.
        else resolve(Cadence.roomConf(arg) || {'muc#roomconfig_roomname': room.title});
      });
    })
    .then(
      data => xmpp.roomConfigSubmit(id, data),
      reason => {
        if (reason == 'cancel') xmpp.roomConfigCancel(id);
        throw reason;
      }
    )
    .then(
      () => {
        xmpp.setRoom(id);
        Cadence.setSetting('xmpp.room', id);
        ui.messageInfo(strings.info.roomCreated, {room});
        return xmpp.discoverRooms();
      },
      reason => {
        // The server may not destroy the room on its own:
        xmpp.leaveRoom(id);
        if (reason == 'cancel') {
          ui.messageError(strings.error.roomCreateCancel);
          throw reason;
        }
        else throw ui.messageError(strings.error.roomConf, {room});
      }
    )
    .then(rooms => {
      const room = rooms[id];
      ui.updateRoom(id, xmpp.roster[id]);
      ui.messageInfo(strings.info.joined, {room});
    });
  })
  .catch(() => {});
});

Cadence.addCommand('destroy', arg => {
  const name = arg.room || (arg[0] && arg[0][0]) || xmpp.room.current;
  if (!name)
    return ui.messageError(strings.error.noRoom);

  const room = xmpp.room.available[name];
  if (!room)
    return ui.messageError(strings.error.unknownRoom, {name});

  const confirm = visual.formatText(strings.info.destroyConfirm, {room});
  if (!window.confirm(confirm.text())) return;

  xmpp.destroyRoom(name, arg.alternate, arg.reason).then(
    () => {
      ui.messageInfo(strings.info.destroySuccess, {room});
    },
    (stanza) => {
      if ($('forbidden', stanza).length)
        ui.messageError(strings.error.destroyDenied, {room});
      else
        ui.messageError(strings.error.destroy, {room});
    }
  );
});

/**
 * dmsg <jid>
 *   Send a direct message to a user outside the chatroom.
 */
Cadence.addCommand('dmsg',
({jid, msg}) => {
  if (!jid || !msg) return ui.messageError(strings.error.noArgument);
  if (!jid.node) return ui.messageError(strings.error.jidInvalid, {jid});

  const body = Cadence.formatOutgoing(msg);
  xmpp.sendMessage({body, to: jid});

  ui.messageAppend(visual.formatMessage({
    type: 'chat',
    to: {jid},
    user: {jid: xmpp.jid},
    body: body.html
  }));
},
string => {
  const arg = Cadence.parseArgs(string);
  if (arg[0].length) {
    arg.jid = arg[0][0];
    arg.msg = string.substring(arg[1][0][0]).trim();
  }
  arg.jid = xmpp.JID.parse(arg.jid);
  return arg;
});

/**
 * invite [<jid> <msg> | --room <room> --nick <nick> --msg <msg>]
 */
Cadence.addCommand('invite', arg => {
  let {room, nick, jid, msg} = arg;

  if (room && nick)
    jid = xmpp.jidFromRoomNick({room, nick});

  if (!jid)
    return ui.messageError(strings.error.noArgument);

  xmpp.invite({to: jid, msg});

  ui.messageInfo(strings.info.inviteSent, {
    jid, room: xmpp.room.available[xmpp.room.current]
  });
},
string => {
  const arg = Cadence.parseArgs(string);
  if (arg[0] && arg[0].length >= 1) {
    arg.jid = arg[0][0];
    arg.msg = string.substring(arg[1][0][0]).trim();
  }
  return arg;
});

/**
 * join <room>
 *   Ask XMPP to join <room>. If successful, XMPP
 *   will automatically leave the current room.
 */
Cadence.addCommand('join', arg => {
  const name = arg.name || arg[0].join(" ").trim();
  if (!name) return ui.messageError(strings.error.noArgument);

  // Keep room in function scope to avoid passing it through the promises.
  let room = false;

  // Refresh room list and try to find the room.
  return xmpp.discoverRooms()
  .then(() => {
    room = Cadence.getRoomFromTitle(name);
    if (!room)
      throw ui.messageError(strings.error.unknownRoom, {name});
    else if (room.id == xmpp.room.current)
      throw ui.messageError(strings.error.joinSame, {room});
  })
  // Maybe find a registered nick, ignoring errors.
  .then(() => {
    if (config.settings.xmpp.registerNick)
      return xmpp.getReservedNick(room.id).catch(() => {});
  })
  .then((nick) => {
    ui.messageInfo(strings.info.joining, {
      room,
      user: {
        nick: xmpp.nick.target,
        jid: xmpp.jid
      }
    });
    return xmpp.joinRoom({room: room.id, nick, password: arg.password});
  })
  .then(() => {
    ui.updateRoom(room.id, xmpp.roster[room.id]);
    Cadence.setSetting('xmpp.room', room.id);
    xmpp.setRoom(room.id);
    ui.messageInfo(strings.info.joined, {room});
  })
  .catch((stanza) => {
    ui.setFragment(xmpp.room.current);
    if ($('registration-required', stanza).length)
      ui.messageError(strings.error.joinRegister, {room});
  });
});

/**
 * kick <nick>
 *   Ask XMPP to kick a user.
 *   The client will not validate the command or its authority; that's the
 *   server's job.
 */
Cadence.addCommand('kick',
({nick}) => {
  xmpp.setUser({nick, role: 'none'}).catch(stanza => {
    if ($('not-acceptable', stanza).length)
      return ui.messageError(strings.error.kick['not-acceptable'], {nick});
    if ($('not-allowed', stanza).length)
      return ui.messageError(strings.error.kick['not-allowed'], {nick});
  });
}, string => ({nick: string.trim()}));

/**
 * list:
 *   List available rooms.
 */
Cadence.addCommand('list', () => {
  xmpp.discoverRooms().then(
    (rooms) => {
      const links = $.map(rooms, visual.format.room);
      if (Object.keys(links).length)
        ui.messageInfo(strings.info.roomsAvailable, {list: links});
      else
        ui.messageError(strings.error.noRoomsAvailable);
    },
    (error) => {
      const type = ($('remote-server-not-found', error).length) ? 404 : 'default';
      let text = $('text', error).text();
      text = text ? ' (' + text + ')' : '';
      ui.messageError(strings.error.muc[type] + text, {domain: config.xmpp.mucService});
    }
  );
});

/**
 * me <msg>
 *   Alias for /say "/me <msg>".
 */
Cadence.addCommand('me', ({text}) => {
  // XEP-0245 says to simply send this command as text.
  Cadence.execute('say', {text: '/me' + text});
}, string => ({text: string}));

/**
 * msg <nick> <msg>
 *   Send a private message to another occupant.
 */
Cadence.addCommand('msg',
({nick, msg}) => {
  if (!nick || !msg)
    return ui.messageError(strings.error.noArgument);
  if (!(nick in xmpp.roster[xmpp.room.current]))
    return ui.messageError(strings.error.unknownUser, {nick});

  const body = Cadence.formatOutgoing(msg);
  xmpp.sendMessage({
    body, to: xmpp.jidFromRoomNick({nick})
  });
  ui.messageAppend(visual.formatMessage({
    type: 'chat',
    to: xmpp.roster[xmpp.room.current][nick],
    user: xmpp.roster[xmpp.room.current][xmpp.nick.current],
    body: body.html
  }));
}, string => {
  const arg = Cadence.parseArgs(string);
  if (arg[0].length) {
    arg.nick = arg[0][0];
    arg.msg = string.substring(arg[1][0][0]).trim();
  }
  return arg;
});

/**
 * nick <nick>
 *   Ask XMPP to change the nick in the current room.
 */
Cadence.addCommand('nick', ({nick}) => {
  if (!nick) return ui.messageError(strings.error.noArgument);
  Cadence.setSetting('xmpp.user', xmpp.jid.node);
  Cadence.setSetting('xmpp.nick', nick);
  xmpp.changeNick(nick);
  if (!xmpp.room.current)
    ui.messageInfo(strings.info.nickPrejoin, {nick});
}, string => ({nick: string.trim()}));

/**
 * part
 *   Leave the current room without joining a different one.
 */
Cadence.addCommand('part', () => {
  const room = xmpp.room.current;
  if (!room) return;

  ui.messageInfo(strings.info.leave, {room: xmpp.room.available[room]});
  ui.updateRoom();
  xmpp.leaveRoom(room);
  Cadence.execute('list');
});

(() => {
  const parser = string => {
    string = string.trim();
    const jid = xmpp.JID.parse(string);
    const direct = !!jid.resource; // Only accept full JIDs.
    return direct ? {jid} : {nick: arg};
  };

  /**
   * ping <nick>|<jid>
   *   Send a ping and display the response time.
   */
  Cadence.addCommand('ping',
  ({nick, jid}) => {
    const target = jid || xmpp.jidFromRoomNick({nick});
    const user = nick ? xmpp.roster[xmpp.room.current][nick] : {jid};
    const time = (new Date()).getTime();

    xmpp.ping(target).then((stanza) => {
      const delay = ((new Date()).getTime() - time).toString();
      ui.messageInfo(strings.info.pong[+!!user], {user, delay});
    }, (stanza) => {
      if ($('item-not-found', stanza).length)
        ui.messageError(strings.error.unknownUser, {nick});
      else if (stanza)
        ui.messageError(strings.error.pingError);
      else {
        const delay = ((new Date()).getTime() - time).toString();
        ui.messageError(strings.error.pingTimeout[+!!user], {user, delay});
      }
    });
  }, parser);

  /**
   * time [<nick>|<jid>]
   *   Send a time request and display the response.
   */
  Cadence.addCommand('time',
  ({nick, jid}) => {
    const target = jid || xmpp.jidFromRoomNick({nick});
    const user = nick ? xmpp.roster[xmpp.room.current][nick] : {jid};

    const start = new Date();

    xmpp.getTime(target).then((stanza) => {
      const now = new Date();
      const tzo = $('tzo', stanza).text();
      const utc = new Date($('utc', stanza).text());
      const time = moment(utc).utcOffset(tzo);
      let offset = (utc - now) + (now - start) / 2
      if (offset > 0) offset = '+' + offset;
      ui.messageInfo(strings.info.time, {user, tzo, time, offset});
    }, (stanza) => {
      if ($('item-not-found', stanza).length)
        ui.messageError(strings.error.unknownUser, {nick});
      else if ($('feature-not-implemented', stanza).length)
        ui.messageError(strings.error.feature);
      else if (!stanza)
        ui.messageError(strings.error.timeout);
    });
  }, parser);

  /**
   * version
   *   Either print the client and server version, or query another user.
   */
  Cadence.addCommand('version',
  ({nick, jid}) => {
    if (!nick && !jid) {
      ui.messageInfo(strings.info.versionClient, {
        version: $('<a>')
          .attr('href', 'https://github.com/cburschka/cadence/tree/' + config.version)
          .text(config.version)
      });
    }

    // Only show client version when offline.
    if (!xmpp.connection.connected) {
      return arg && ui.messageError(strings.error.cmdStatus.offline, {command: 'version'});
    }

    const target = jid || xmpp.jidFromRoomNick({nick});
    const user = nick ? xmpp.roster[xmpp.room.current][nick] : {jid};

    return xmpp.getVersion(target).then((stanza) => {
      const name = $('name', stanza).text();
      const version = $('version', stanza).text();
      const os = $('os', stanza).text() || '-';
      if (user)
        ui.messageInfo(strings.info.versionUser, {name, version, os, user});
      else
        ui.messageInfo(strings.info.versionServer, {name, version, os});
    }, (stanza) => {
      if ($('item-not-found', stanza).length != 0)
        ui.messageError(strings.error.unknownUser, {nick});
      else if ($('feature-not-implemented', stanza).length)
        ui.messageError(strings.error.feature);
      else if (!stanza)
        ui.messageError(strings.error.timeout);
    });
  }, parser);
})();

/**
 * quit
 *   Ask XMPP to disconnect.
 */
Cadence.addCommand('quit', () => {
  ui.messageInfo(strings.info.connection.disconnecting);
  xmpp.connection.disconnect();
});

/**
 * save
 *   Create a text file (by data: URI) from the chat history.
 */
Cadence.addCommand('save', ({type}) => {
  if (ui.messages.length == 0)
    return ui.messageError(strings.error.saveEmpty);
  const timestamp = moment(new Date(ui.messages[0].timestamp)).format('YYYY-MM-DD');

  let data = (type == 'html' ? visual.messagesToHTML : visual.messagesToText)(ui.messages);
  if (type == 'html') {
    data = '<!DOCTYPE html>' + $('<html>')
         .append($('<head>').append($('<title>').text(
           xmpp.room.available[xmpp.room.current].title + ' (' + timestamp + ')'
         )))
         .append($('<body>').append(data))
         .html();
  }
  const blob = new Blob([data], {type: 'text/' + type + ';charset=utf-8'});
  const suffix = type == 'html' ? 'html' : 'log';
  saveAs(blob, xmpp.room.current + '-' + timestamp + '.' + suffix);
}, string => ({type: string.trim()}));

/**
 * say <msg>
 *   The default command that simply sends a message verbatim.
 */
Cadence.addCommand('say', ({text}) => {
  const body = Cadence.formatOutgoing(text);
  xmpp.sendMessage({body, to: xmpp.jidFromRoomNick(), type: 'groupchat'});
}, string => ({text: string}));

/**
 * Synchronize settings with the server.
 */
Cadence.addCommand('sync', ({type}) => {
  const account = config.settings.sync.account;

  // We're already synchronized with another account.
  if (account && account != xmpp.jid.node)
    if (!prompt(strings.info.sync.change, {old: account, new: xmpp.jid.node}))
      return ui.messageError(strings.error.sync.canceled, {account: xmpp.jid.node});

  Cadence.synchronizeSettings(type);
}, string => ({type: string.trim()}));

/**
 * unban
 *   Unban a user from the current room.
 */
Cadence.addCommand('unban', ({jid}) => {
  if (!jid) return ui.messageError(strings.error.noArgument);

  return xmpp.getUsers({affiliation: 'outcast'}).then((stanza) => {
    const isBanned = $('item', stanza).is(function() {
      return jid.matchBare(this.getAttribute('jid'));
    });
    if (isBanned) return Cadence.execute('affiliate', {type: 'none', jid});
    else return ui.messageError(strings.error.unbanNone);
  }, (stanza) => {
    if ($('forbidden', iq).length)
      ui.messageError(strings.error.banList.forbidden);
    else ui.messageError(strings.error.banList.default);
  });
}, string => ({jid: xmpp.JID.parse(string.trim())}));

/**
 * who [room]
 *   Query the user list of a room.
 */
Cadence.addCommand('who', ({room}) => {
  room = room || xmpp.room.available[xmpp.room.current];

  if (!room)
    return ui.messageError(strings.error[arg ? 'unknownRoom' : 'noRoom'], {name: arg});
  if (room.id != xmpp.room.current) {
    xmpp.getOccupants(room.id, (users) => {
      const list = $.map(users, (user, nick) => { return visual.format.nick(nick); });
      if (links.length) ui.messageInfo(strings.info.usersInRoom, {room, list});
      else ui.messageInfo(strings.info.noUsers, {room});
    })
  }
  else {
    const roster = xmpp.roster[xmpp.room.current];
    const list = $.map(roster, visual.format.user);
    ui.messageInfo(strings.info.usersInThisRoom, {list});
  }
}, string => ({room: Cadence.getRoomFromTitle(string)}));

/**
 * whois <nick>
 *   Print out information on a participant in the current room.
 */
Cadence.addCommand('whois', ({nick}) => {
  if (!nick) return ui.messageError(strings.error.noArgument);
  const user = xmpp.roster[xmpp.room.current][nick];
  if (user) {
    ui.messageInfo(strings.info.whois, {
      user,
      jid: user.jid || '---',
      privilege: user.role + '/' + user.affiliation,
      status: user.show + (user.status ? ' (' + user.status + ')' : '')
    });
  }
  else ui.messageError(strings.error.unknownUser, {nick});
}, string => ({nick: arg.trim()}));
