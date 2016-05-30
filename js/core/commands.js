/**
 * @file commands.js
 *   This defines all the core commands available in cadence.
 */

/**
 * admin <cmd> <msg>:
 *   Execute a server admin command.
 */
Cadence.addCommand('admin', arg => {
  const command = arg.cmd;
  if (!command) throw new Cadence.Error(strings.error.noArgument);

  // Interactive configuration with --interactive, or with a command
  // that contains no named arguments other than --cmd.
  const interactive = arg.interactive || Object.keys(arg).every(
    (key) => { return key*0 === 0 || key == 'cmd' }
  );

  let sessionid;

  const process = stanza => {
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
  };

  const submit = data => xmpp.commandSubmit(command, sessionid, data);

  const result = (stanza) => {
    const result = [];
    $('field[type!="hidden"]', stanza).each(function() {
      const label = $(this).attr('label');
      const value = $(this).text();
      result.push($('<strong>').text(value + ':'), ' ', value, $('<br>'));
    })
    ui.messageInfo(strings.info.admin[result.length ? 'result' : 'completed'], {command, result});
  };

  return xmpp.command(command).then(process).then(submit).then(result)
  .catch(error => {
    switch (error.condition) {
      case 'forbidden':
        throw new Cadence.Error(strings.error.admin.forbidden, {command});
      case 'service-unavailable':
        throw new Cadence.Error(strings.error.admin.badCommand, {command});
    }
    throw error;
  });
})
.parse(string => {
  const arg = Cadence.parseArgs(string);

  // Make single-argument commands more convenient:
  const defaultArgs = {
    'announce': 'body',
    'get-user-lastlogin': 'accountjid',
    'set-motd': 'body',
    'user-stats': 'accountjid',
  }

  // Use first positional argument as command.
  // If there is more, use the remaining text as an argument.
  if (arg[0].length) arg.cmd = arg[0][0];
  if (arg[0].length > 1 && arg.cmd in defaultArgs)
    arg[defaultArgs[arg.cmd]] = string.substring(arg[1][0][0]).trim();
  return arg;
})
.require(Cadence.requirements.online);

/**
 * affiliate owner|admin|member|none [<nick>|<jid>]
 *   Set the affiliation of a particular user, or list all users with an affiliation.
 */
Cadence.addCommand('affiliate', ({type, nick, jid}) => {
  const roster = xmpp.roster[xmpp.room.current];
  const target = jid ? {jid} : roster[nick];

  if (!['owner', 'admin', 'member', 'outcast', 'none'].includes(type))
    throw new Cadence.Error(strings.error.affiliate.type, {type});

  // List users with a specific affiliation.
  if (!target) {
    const list = stanza => {
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
    };

    return xmpp.getUsers({affiliation: type}).then(list).catch(error => {
      if (error.condition == 'forbidden')
        throw new Cadence.Error(strings.error.affiliations.forbidden, {type});
      throw error;
    });
  }

  // If a JID was given, fetch the user if they're present.
  const user = jid && $.map(roster, x => x).find(x => jid.matchBare(x.jid)) || target;

  // User is present but anonymous:
  if (!user.jid)
    throw new Cadence.Error(strings.error.affiliate.anon, {user});
  // User is not in the room (therefore their JID is actually just a nick).
  if (!user.jid.node)
    throw new Cadence.Error(strings.error.affiliate.notFound, {nick: user.jid});

  // Attempt to set user's affiliation.
  return xmpp.setUser({jid: user.jid, affiliation: type}).then(() => {
    const room = xmpp.room.available[xmpp.room.current];
    ui.messageInfo(strings.info.affiliate, {user, room, type});
  })
  .catch(error => {
    switch (error.condition) {
      case 'not-allowed':
        throw new Cadence.Error(strings.error.affiliate.notAllowed, {user, type});
      case 'conflict':
        throw new Cadence.Error(strings.error.affiliate.conflict, {user, type});
    }
    throw error;
  });
})
.parse(string => {
  const arg = Cadence.parseArgs(string);
  arg[0] = arg[0] || [];

  if (!arg.type) arg.type = arg[0][0];

  if (!arg.nick) arg.nick = arg[0][1];
  arg.jid = xmpp.JID.parse(arg.jid || arg[0][1]);
  return arg;
})
.require(Cadence.requirements.room);

/**
 * alias <cmd> <commands>
 *   Create a macro.
 */
Cadence.addCommand('alias', ({command, macro}) => {
  if (!command) {
    const macros = $.map(
      config.settings.macros,
      (value, key) => ('    /' + key + ' - ' + value.join('; '))
    ).join('\n');

    if (macros) {
      return ui.messageInfo($('<div>').html(strings.info.macros), {macros});
    }
    else {
      throw new Cadence.Error(strings.error.noMacros);
    }
  }

  if (command in Cadence.commands) {
    throw new Cadence.Error(strings.error.aliasConflict, {command});
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
  if (recursion) throw new Cadence.Error(strings.error.aliasRecursion, {
    command, path: recursion.join(' -> ')
  });

  if (macros[command]) {
    ui.messageInfo(strings.info.aliasReplace, {command});
  }
  else ui.messageInfo(strings.info.aliasAdd, {command});
  macros[command] = macro;
  Cadence.saveSettings();
})
.parse(string => {
  string = string.trim();
  if (!string) return;

  const [prefix, command] = string.match(/^\/*(\S+)/) || [];
  if (!command) {
    throw new Cadence.Error($('<div>').html(strings.error.aliasFormat));
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
    }).parse(parser).require(Cadence.requirements.room);
  }
  Cadence.addCommand('back', ({status}) => {
    xmpp.sendStatus({show: 'available', status});
    ui.setUserStatus('available');
  }).parse(parser).require(Cadence.requirements.room);
})();

/**
 * ban <nick>|<jid>
 *   Shortcut for "/affiliate outcast <nick|jid>".
 */
Cadence.addCommand('ban', ({nick, jid}) => {
  return Cadence.execute('affiliate', {type: 'outcast', nick, jid});
})
.parse(string => {
  const arg = Cadence.parseArgs(string);
  const m = arg[0] && arg[0].length == 1 ? arg[0][0] : string.trim();
  arg.nick = arg.nick || m;
  arg.jid = arg.jid || xmpp.JID.parse(arg.jid || m);
  arg.jid = arg.jid.node && arg.jid;
  return arg;
})
.require(Cadence.requirements.room);

/**
 * bans:
 *   Shortcut for "/affiliate outcast".
 */
Cadence.addCommand('bans', () => {
  return Cadence.execute('affiliate', {type: 'outcast'});
})
.require(Cadence.requirements.room);

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
  const {name, help, interactive} = arg;

  if (help) return ui.messageInfo($('<div>').html(strings.help.configure));

  if (!name) throw new Cadence.Error(strings.error.noRoom);

  const room = xmpp.room.available[name] || {id: name, title: name};

  const noArgs = Object.keys(arg).every(
    key => !isNaN(key) || key == 'name'
  );

  // The form is either presented interactively, or filled with CLI arguments.
  const configure = form => {
    if (interactive || noArgs) {
      // Form submission uses a callback because it can be triggered multiple times.
      const htmlform = ui.dataForm(form, submit);
      return ui.formDialog(htmlform, {cancel: () => xmpp.roomConfigCancel(name)});
    }
    else return submit(Cadence.roomConfig(arg));
  };
  // Submit the form back to the server.
  const submit = data => xmpp.roomConfigSubmit(name, data).then(success, error);

  // Report success or error.
  const success = () => ui.messageInfo(strings.info.roomConf);
  const error = error => {
    switch (error.condition) {
      case 'item-not-found':
        throw new Cadence.Error(strings.error.unknownRoom, {name});
      case 'forbidden':
        throw new Cadence.Error(strings.error.roomConfDenied, {room});
    }
    throw error;
  };

  return xmpp.roomConfig(name).then(configure);
})
.parse(string => {
  const arg = Cadence.parseArgs(string);
  arg.name = arg.room || arg[0].join(' ') || xmpp.room.current;
  return arg;
})
.require(Cadence.requirements.online);

/**
 * connect <user> <pass>
 * connect {user:<user>, pass:<pass>}
 *   Open a connection and authenticate.
 */
Cadence.addCommand('connect', function({user, pass, anonymous, automatic}) {
  const auth = (
    // Connect anonymously:
    anonymous && {user: '', pass: ''} ||
    // Or with the arguments:
    (user && pass) && {user, pass} ||
    // Or reuse the credentials from the last connection:
    this.auth
  );

  const getAuth = (
    // Use the auth values we have:
    auth && Promise.resolve(auth) ||

    // Or attempt session authentication:
    (config.settings.xmpp.sessionAuth && config.xmpp.sessionAuthURL) &&
    Cadence.sessionAuth(config.xmpp.sessionAuthURL)
    .then(auth => {
      ui.messageInfo(strings.info.sessionAuth, {username: auth.user});
      return auth;
    })
  );

  const connect = ({user, pass}) => Cadence.connect(user, pass);
  const noCredentials = () => {
    // Only complain about missing credentials on a manual invocation.
    if (!automatic) throw new Cadence.Error(strings.error.connection.auth);
  };

  if (!getAuth) return noCredentials();
  return getAuth.then(connect, noCredentials);
})
.parse(string => {
  const arg = Cadence.parseArgs(string);
  if (arg && arg[0]) {
    arg.user = arg.user || arg[0][0];
    arg.pass = arg.pass || arg[0][1];
  }
  return arg;
})
.require(Cadence.requirements.offline);

/**
 * create <room> [<args>]
 *   Join a new room and set it up.
 */
Cadence.addCommand('create', arg => {
  const {help, name, title, interactive} = arg;

  if (help) return ui.messageInfo($('<div>').html(strings.help.configure));

  if (!name) throw new Cadence.Error(strings.error.roomCreateName);

  const room = {id: name, title};

  // Look for the room to make sure it doesn't exist.
  const checkExists = xmpp.getRoomInfo(name).then(
    room => {
      throw new Cadence.Error(strings.error.roomExists, {room});
    },
    error => {
      // Catch only an <item-not-found> error.
      if (error.condition != 'item-not-found') throw error;
    }
  );

  const join = () => {
    ui.messageInfo(strings.info.creating, {
      room,
      user: {nick: xmpp.nick.target, jid: xmpp.jid}
    });
    return xmpp.joinRoom({room: name});
  };

  const getForm = () => xmpp.roomConfig(name);
  const fillForm = form => {
    // Use command-line arguments or just set the room title.
    if (!interactive) {
      const conf = Cadence.roomConf(arg) || {'muc#roomconfig_roomname': title};
      return Promise.resolve(conf);
    }

    // Unlike /configure, this form is in the promise chain. It can only be submitted once.
    return new Promise((resolve, reject) => {
      const htmlForm = ui.dataForm(form, resolve);
      return ui.formDialog(htmlForm, {cancel: reject, apply: false});
    });
  };
  const submit = data => xmpp.roomConfigSubmit(name, data);
  const cancel = error => {
    xmpp.roomConfigCancel(name);
    throw error || new Cadence.Error(strings.error.roomCreateCancel);
  };

  const processForm = form => fillForm(form).then(submit).catch(cancel);
  const configure = () => getForm().then(processForm);

  const success = () => {
    xmpp.setRoom(name);
    Cadence.setSetting('xmpp.room', name);
    ui.messageInfo(strings.info.roomCreated, {room});
    return xmpp.discoverRooms().then(rooms => {
      const room = rooms[name];
      ui.updateRoom(name, xmpp.roster[name]);
      ui.messageInfo(strings.info.joined, {room});
    });
  };
  const error = error => {
    xmpp.leaveRoom(name);
    throw error;
  };

  const create = () => join().then(configure).then(success, error);

  return checkExists.then(create);
})
.parse(string => {
  const arg = Cadence.parseArgs(string);
  // Use --name or positional args or --title as name.
  const name = arg.name || arg[0].join(' ') || arg.title;
  // Use --title or --name as title.
  arg.title = arg.title || name;
  // The name must be lowercase.
  arg.name = name.toLowerCase();
  return arg;
})
.require(Cadence.requirements.online);

Cadence.addCommand('destroy', ({room, alternate, reason}) => {
  const name = room;
  if (!name) throw new Cadence.Error(strings.error.noRoom);

  room = xmpp.room.available[room];
  if (!room) throw new Cadence.Error(strings.error.unknownRoom, {name});

  const confirm = visual.formatText(strings.info.destroyConfirm, {room});
  if (!window.confirm(confirm.text())) return;

  xmpp.destroyRoom(name, alternate, reason)
  .then(() => ui.messageInfo(strings.info.destroySuccess, {room}))
  .catch(error => {
    if (error.condition == 'forbidden')
      throw new Cadence.Error(strings.error.destroyDenied, {room});
    throw error;
  });
})
.parse(string => {
  const arg = Cadence.parseArgs(string);
  return {name: arg.room || (arg[0] && arg[0][0]) || xmpp.room.current};
})
.require(Cadence.requirements.online);

/**
 * dmsg <jid>
 *   Send a direct message to a user outside the chatroom.
 */
Cadence.addCommand('dmsg', ({jid, msg}) => {
  if (!jid || !msg) throw new Cadence.Error(strings.error.noArgument);
  if (!jid.node) throw new Cadence.Error(strings.error.jidInvalid, {jid});

  const body = Cadence.formatOutgoing(msg);
  xmpp.sendMessage({body, to: jid});

  ui.messageAppend(visual.formatMessage({
    type: 'chat',
    to: {jid},
    user: {jid: xmpp.jid},
    body: body.html
  }));
})
.parse(string => {
  const arg = Cadence.parseArgs(string);
  if (arg[0].length) {
    arg.jid = arg[0][0];
    arg.msg = string.substring(arg[1][0][0]).trim();
  }
  arg.jid = xmpp.JID.parse(arg.jid);
  return arg;
})
.require(Cadence.requirements.online);

/**
 * invite [<jid> <msg> | --room <room> --nick <nick> --msg <msg>]
 */
Cadence.addCommand('invite', ({nick, jid, room, msg}) => {
  jid = jid || nick && xmpp.jidFromRoomNick({room, nick});
  if (!jid) throw new Cadence.Error(strings.error.noArgument);

  xmpp.invite({to: target, msg});
  ui.messageInfo(strings.info.inviteSent, {
    jid, room: xmpp.room.available[xmpp.room.current]
  });
})
.parse(string => {
  const arg = Cadence.parseArgs(string);
  if (arg[0] && arg[0].length >= 1) {
    arg.jid = arg[0][0];
    arg.msg = string.substring(arg[1][0][0]).trim();
  }
  return arg;
})
.require(Cadence.requirements.room);

/**
 * join <room>
 *   Ask XMPP to join <room>. If successful, XMPP
 *   will automatically leave the current room.
 */
Cadence.addCommand('join', ({room, password}) => {
  const name = room;
  if (!name) throw new Cadence.Error(strings.error.noArgument);

  // Refresh room list and try to find the room.
  const checkExists = xmpp.discoverRooms().then(() => {
    room = Cadence.getRoomFromTitle(name);
    if (!room) throw new Cadence.Error(strings.error.unknownRoom, {name});
    if (room.id == xmpp.room.current) {
      throw new Cadence.Error(strings.error.joinSame, {room});
    }
  });

  // Maybe find a registered nick, ignoring errors.
  const reservedNick = config.settings.xmpp.registerNick ?
      () => xmpp.getReservedNick(room.id).catch(() => {})
    : x => x;

  const join = (nick = xmpp.nick.target) => {
    ui.messageInfo(strings.info.joining, {room, user: {nick, jid: xmpp.jid}});
    return xmpp.joinRoom({room: room.id, nick, password});
  };

  const success = () => {
    ui.updateRoom(room.id, xmpp.roster[room.id]);
    Cadence.setSetting('xmpp.room', room.id);
    xmpp.setRoom(room.id);
    ui.messageInfo(strings.info.joined, {room});
    return Cadence.execute('who');
  };
  const error = error => {
    ui.setFragment(xmpp.room.current);
    if (error.condition === 'registration-required') {
      throw new Cadence.Error(strings.error.joinRegister, {room});
    }
    else throw error;
  };

  return checkExists.then(reservedNick).then(join).then(success, error);
})
.parse(string => ({room: string.trim()}))
.require(Cadence.requirements.online);

/**
 * kick <nick>
 *   Ask XMPP to kick a user.
 *   The client will not validate the command or its authority; that's the
 *   server's job.
 */
Cadence.addCommand('kick', ({nick}) => {
  return xmpp.setUser({nick, role: 'none'})
  .catch(error => {
    switch (error.condition) {
      case 'not-acceptable':
        throw new Cadence.Error(strings.error.unknownUser, {nick});
      case 'not-allowed':
        throw new Cadence.Error(strings.error.kick, {nick});
    }
    throw error;
  });
})
.parse(string => ({nick: string.trim()}))
.require(Cadence.requirements.room);

/**
 * list:
 *   List available rooms.
 */
Cadence.addCommand('list', () => {
  return xmpp.discoverRooms().then(
    rooms => {
      const links = $.map(rooms, visual.format.room);
      if (links.length) {
        ui.messageInfo(strings.info.roomsAvailable, {list: links});
      }
      else throw new Cadence.Error(strings.error.noRoomsAvailable);
    },
    error => {
      const domain = config.xmpp.mucService;
      if (error.condition == 'remote-server-not-found') {
        throw new Cadence.Error(strings.error.muc.notFound, {domain});
      }
      throw new Cadence.Error(strings.error.muc.unknown, {domain});
    }
  );
})
.require(Cadence.requirements.online);

/**
 * me <msg>
 *   Alias for /say "/me <msg>".
 */
Cadence.addCommand('me', ({text}) => {
  // XEP-0245 says to simply send this command as text.
  return Cadence.execute('say', {text: '/me' + text});
})
.parse(string => ({text: string}))
.require(Cadence.requirements.room);

/**
 * msg <nick> <msg>
 *   Send a private message to another occupant.
 */
Cadence.addCommand('msg',
({nick, msg}) => {
  if (!nick || !msg.trim()) throw new Cadence.Error(strings.error.noArgument);
  if (!(nick in xmpp.roster[xmpp.room.current])) {
    throw new Cadence.Error(strings.error.unknownUser, {nick});
  }

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
})
.parse(string => {
  const arg = Cadence.parseArgs(string);
  if (arg[0].length) {
    arg.nick = arg[0][0];
    arg.msg = string.substring(arg[1][0][0]).trim();
  }
  return arg;
})
.require(Cadence.requirements.room);

/**
 * nick <nick>
 *   Ask XMPP to change the nick in the current room.
 */
Cadence.addCommand('nick', ({nick}) => {
  if (!nick) throw new Cadence.Error(strings.error.noArgument);
  Cadence.setSetting('xmpp.user', xmpp.jid.node);
  Cadence.setSetting('xmpp.nick', nick);
  xmpp.changeNick(nick);
  if (!xmpp.room.current)
    ui.messageInfo(strings.info.nickPrejoin, {nick});
})
.parse(string => ({nick: string.trim()}))
.require(Cadence.requirements.room);

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
  return Cadence.execute('list');
})
.require(Cadence.requirements.room);

(() => {
  const parser = string => {
    string = string.trim();
    const jid = xmpp.JID.parse(string);
    const direct = !!jid.resource; // Only accept full JIDs.
    return direct ? {jid} : {nick: string};
  };

  /**
   * buzz <nick|jid>
   */
  Cadence.addCommand('buzz', ({nick, jid}) => {
    const target = jid || xmpp.jidFromRoomNick({nick});
    const user = xmpp.userFromJid(target);

    ui.messageInfo(strings.info.buzz, {user});
    return xmpp.attention(target);
  }).parse(parser).require(Cadence.requirements.online);

  /**
   * ping <nick>|<jid>
   *   Send a ping and display the response time.
   */
  Cadence.addCommand('ping', ({nick, jid}) => {
    const target = jid || nick && xmpp.jidFromRoomNick({nick});
    const user = target && xmpp.userFromJid(target);
    const time = (new Date()).getTime();

    return xmpp.ping(target).then((stanza) => {
      const delay = ((new Date()).getTime() - time).toString();
      ui.messageInfo(strings.info.pong[+!!user], {user, delay});
    })
    .catch(error => {
      switch (error.condition) {
        case 'item-not-found':
          throw new Cadence.Error(strings.error.unknownUser, {nick});
        case 'timeout':
          const delay = ((new Date()).getTime() - time).toString();
          throw new Cadence.Error(strings.error.pingTimeout[+!!user], {user, delay});
      }
      throw error;
    });
  }).parse(parser).require(Cadence.requirements.online);

  const error = error => {
    switch (error.condition) {
      case 'item-not-found':
        throw new Cadence.Error(strings.error.unknownUser, {nick});
      case 'feature-not-implemented':
        throw new Cadence.Error(strings.error.feature);
      case 'timeout':
        throw new Cadence.Error(strings.error.timeout);
    }
    throw error;
  };

  /**
   * time [<nick>|<jid>]
   *   Send a time request and display the response.
   */
  Cadence.addCommand('time', ({nick, jid}) => {
    const target = jid || nick && xmpp.jidFromRoomNick({nick});
    const user = target && xmpp.userFromJid(target);

    const start = new Date();

    return xmpp.getTime(target).then((stanza) => {
      const now = new Date();
      const tzo = $('tzo', stanza).text();
      const utc = new Date($('utc', stanza).text());
      const time = moment(utc).utcOffset(tzo);
      let offset = (utc - now) + (now - start) / 2
      if (offset > 0) offset = '+' + offset;
      ui.messageInfo(strings.info.time[+!!user], {user, tzo, time, offset});
    }).catch(error);
  }).parse(parser).require(Cadence.requirements.online);

  /**
   * version
   *   Either print the client and server version, or query another user.
   */
  Cadence.addCommand('version', ({nick, jid}) => {
    if (!nick && !jid) {
      ui.messageInfo(strings.info.versionClient, {
        version: $('<a>')
          .attr('href', 'https://github.com/cburschka/cadence/tree/' + config.version)
          .text(config.version)
      });
    }

    // Only show client version when offline.
    if (!xmpp.connection.connected) {
      if (nick || jid) {
        throw new Cadence.Error(strings.error.cmdStatus.offline, {command: 'version'});
      }
      else return;
    }

    const target = jid || nick && xmpp.jidFromRoomNick({nick});
    const user = target && xmpp.userFromJid(target);

    return xmpp.getVersion(target).then((stanza) => {
      const name = $('name', stanza).text();
      const version = $('version', stanza).text();
      const os = $('os', stanza).text() || '-';
      if (user)
        ui.messageInfo(strings.info.versionUser, {name, version, os, user});
      else
        ui.messageInfo(strings.info.versionServer, {name, version, os});
    }).catch(error);
  }).parse(parser);
})();

/**
 * quit
 *   Ask XMPP to disconnect.
 */
Cadence.addCommand('quit', () => {
  ui.messageInfo(strings.info.connection.disconnecting);
  xmpp.connection.disconnect();
})
.require(Cadence.requirements.online);

/**
 * save
 *   Create a text file (by data: URI) from the chat history.
 */
Cadence.addCommand('save', ({type}) => {
  type = type || 'plain';
  if (!ui.messages.length) throw new Cadence.Error(strings.error.saveEmpty);
  const date = moment(new Date(ui.messages[0].timestamp)).format('YYYY-MM-DD');

  let data = (type == 'html' ? visual.messagesToHTML : visual.messagesToText)(ui.messages);
  if (type == 'html') {
    const title = xmpp.room.available[xmpp.room.current].title + ' (' + date + ')';
    const head = $('<head>').append($('<title>').text(title));
    const body = $('<body>').append(data);
    data = '<!DOCTYPE html>' + $('<html>').append(head, body).html();
  }
  const blob = new Blob([data], {type: 'text/' + type + ';charset=utf-8'});
  const suffix = type == 'html' ? 'html' : 'log';
  saveAs(blob, xmpp.room.current + '-' + date + '.' + suffix);
})
.parse(string => ({type: string.trim()}));

/**
 * say <msg>
 *   The default command that simply sends a message verbatim.
 */
Cadence.addCommand('say', ({text}) => {
  const body = Cadence.formatOutgoing(text);
  xmpp.sendMessage({body, to: xmpp.jidFromRoomNick(), type: 'groupchat'});
})
.parse(string => ({text: string}))
.require(Cadence.requirements.room);

/**
 * Synchronize settings with the server.
 */
Cadence.addCommand('sync', ({type}) => {
  return Cadence.synchronizeSettings(type);
})
.parse(string => ({type: string.trim()}))
.require(Cadence.requirements.online);

/**
 * unban
 *   Unban a user from the current room.
 */
Cadence.addCommand('unban', ({jid}) => {
  if (!jid) throw new Cadence.Error(strings.error.noArgument);

  return xmpp.getUsers({affiliation: 'outcast'}).then(stanza => {
    const isBanned = $('item', stanza).is(function() {
      return jid.matchBare(this.getAttribute('jid'));
    });
    if (isBanned) return Cadence.execute('affiliate', {type: 'none', jid});
    else throw new Cadence.Error(strings.error.unbanNone);
  }).catch(error => {
    if (error.condition == 'forbidden')
      throw new Cadence.Error(strings.error.banList.forbidden);
    throw error;
  });
})
.parse(string => ({jid: xmpp.JID.parse(string.trim())}))
.require(Cadence.requirements.room);

/**
 * who [room]
 *   Query the user list of a room.
 */
Cadence.addCommand('who', ({room}) => {
  room = room || xmpp.room.available[xmpp.room.current];

  if (!room)
    throw new Cadence.Error(strings.error[arg ? 'unknownRoom' : 'noRoom'], {name: arg});
  if (room.id != xmpp.room.current) {
    return xmpp.getOccupants(room.id).then(users => {
      const list = $.map(users, (user, nick) => { return visual.format.nick(nick); });
      if (links.length) ui.messageInfo(strings.info.usersInRoom, {room, list});
      else ui.messageInfo(strings.info.noUsers, {room});
    });
  }
  else {
    const roster = xmpp.roster[xmpp.room.current];
    const list = $.map(roster, visual.format.user);
    ui.messageInfo(strings.info.usersInThisRoom, {list});
  }
})
.parse(string => ({room: Cadence.getRoomFromTitle(string)}))
.require(Cadence.requirements.online);

/**
 * whois <nick>
 *   Print out information on a participant in the current room.
 */
Cadence.addCommand('whois', ({nick}) => {
  if (!nick) throw new Cadence.Error(strings.error.noArgument);
  const user = xmpp.roster[xmpp.room.current][nick];
  if (user) {
    ui.messageInfo(strings.info.whois, {
      user,
      jid: user.jid || '---',
      privilege: user.role + '/' + user.affiliation,
      status: user.show + (user.status ? ' (' + user.status + ')' : '')
    });
  }
  else throw new Cadence.Error(strings.error.unknownUser, {nick});
})
.parse(string => ({nick: arg.trim()}))
.require(Cadence.requirements.room);
