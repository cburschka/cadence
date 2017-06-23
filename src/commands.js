/**
 * @file commands.js
 *   This defines all the core commands available in cadence.
 */

/**
 * admin <cmd> <msg>:
 *   Execute a server admin command.
 */
Cadence.addCommand('admin', async arg => {
  const to = config.xmpp.domain;
  const {command, node, full, quiet, help} = arg;
  const adminPrefix = 'http://jabber.org/protocol/admin#'

  if (!node) {
    const commands = (await xmpp.listCommands(to)).map(({name, node}) => {
      const xep133 = node.startsWith(adminPrefix);
      const command = xep133 ? node.substring(adminPrefix.length) : `--node "${node.replace(/"/,'\\"')}"`;
      const code = $('<code>').text(`/admin ${command}`);
      if (xep133 || full) return [code, name];
    }).filter(x => !!x);
    return ui.messageInfo(strings.info.admin.commands, {commands});
  }

  try {
    const commandStanza = await xmpp.command(to, node);
    const _command = commandStanza.querySelector('command');
    const sessionid = _command.getAttribute('sessionid');

    if (_command.getAttribute('status') === 'completed') return;

    if (help) {
      const args = Array.from(_command.querySelectorAll('x > field'))
        .map(f => ({
          type: f.getAttribute('type'),
          name: f.getAttribute('var'),
          label: f.getAttribute('label'),
          value: (f.querySelector('value') || {}).textContent,
          options: Object.fromEntries(Array.from(f.querySelectorAll('option')).map(o => [
            (o.querySelector('value') || {}).textContent,
            o.getAttribute('label')
          ])),
          required: !!f.querySelector('required'),
        }))
        .filter(({type}) => !['hidden', 'fixed'].includes(type))
        .map(({type, name, label, value, options, required}) => {
          const option = Object.keys(options).join('|');
          const _default = value && `[${value}]` || '';
          const multi = ['list-multi', 'jid-multi'].includes(type);
          const _required = required && !_default ? strings.label.tip.required : '';
          const _multi = multi ? strings.label.tip.multiline : '';
          const extra = `${_required} ${_multi}`.trim();
          return [
            $('<code>').text(`--${name} ${option} ${_default}`),
            label + (extra && ` (${extra})`)
          ];
        });
      throw ui.messageInfo(strings.info.admin.args, {command, args});
    }

    const form = ui.dataForm(commandStanza);
    Object.forEach(arg, (key, value) => {
      const field = form.fields[key];
      if (field) field.val(value);
    });
    if (quiet) form.submit();
    else {
      const cancel = () => {
        throw new Cadence.Error(strings.error.admin.cancel, {command});
      }
      ui.formDialog(form, {cancel, single: true});
    }

    const resultStanza = await xmpp.commandSubmit(to, node, sessionid, await form.submittedData);
    const result = [];
    $('field[type!="hidden"]', resultStanza).each(function () {
      const label = $(this).attr('label');
      const value = Array.from(this.querySelectorAll('value')).map(e => e.textContent).join(', ');
      result.push($('<strong>').text(label + ':'), ' ', value, $('<br>'));
    });
    ui.messageInfo(strings.info.admin[result.length ? 'result' : 'completed'], {result, command: command || node});
  }
  catch (error) {
    if (!error) return;
    switch (error.condition) {
      case 'forbidden':
        throw new Cadence.Error(strings.error.admin.forbidden, {command: command || node});
      case 'service-unavailable':
        throw new Cadence.Error(strings.error.admin.badCommand, {command: command || node});
    }
    throw error;
  }
})
.parse(string => {
  const arg = Cadence.parseArgs(string);

  // Use first positional argument as command.
  const command = arg.command || arg[0][0] || arg.node;
  const node = arg.node || command && `http://jabber.org/protocol/admin#${command}`;
  return $.extend(arg, {command, node});
})
.require(Cadence.requirements.online);

/**
 * affiliate owner|admin|member|none [<nick>|<jid>]
 *   Set the affiliation of a particular user, or list all users with an affiliation.
 */
Cadence.addCommand('affiliate', async ({type, nick, jid, reason}) => {
  // Get a roster array.
  const roster = xmpp.getRoster();
  const rosterArray = $.map(roster, x => x);

  if (!['owner', 'admin', 'member', 'outcast', 'none'].includes(type)) {
    throw new Cadence.Error(strings.error.affiliate.type, {type});
  }

  // List users with a specific affiliation.
  if (!nick && !jid) {
    try {
      const stanza = await xmpp.getUsers({affiliation: type});
    }
    catch(error) {
      if (error.condition === 'forbidden') {
        throw new Cadence.Error(strings.error.affiliations.forbidden, {type});
      }
      throw error;
    }
    const users = Array.from($('item', stanza).map(function() {
      return this.getAttribute('jid');
    }))
    .sort()
    .map(xmpp.JID.parse)
    .map(jid => (rosterArray.find(u => jid.matchBare(u.jid)) || {jid}));
    users.type = 'user';

    if (users.length) return ui.messageInfo(strings.info.affiliations[type], {type, users});
    else return ui.messageInfo(strings.info.affiliationsEmpty, {type});
  }

  if (nick && !(nick in roster)) {
    throw new Cadence.Error(strings.error.notFound.nick, {nick});
  }

  // We know now that the target is either a valid JID or a participant.
  const target = jid || roster[nick].jid;

  // Fetch the roster entry in either case, or fall back to a {jid} object.
  const user = nick ? roster[nick] : (rosterArray.find(x => jid.matchBare(x.jid)) || {jid});

  // If the target is null, then they're an anonymous participant.
  if (!target) throw new Cadence.Error(strings.error.unknownJid, {user});

  try {
    // Attempt to set user's affiliation.
    await xmpp.setUser({jid: target, affiliation: type}, reason);
    const room = xmpp.getRoom();
    ui.messageInfo(strings.info.affiliate, {user, room, type});
  }
  catch (error) {
    switch (error.condition) {
      case 'not-allowed':
        throw new Cadence.Error(strings.error.affiliate.notAllowed, {user, type});
      case 'conflict':
        throw new Cadence.Error(strings.error.affiliate.conflict, {user, type});
    }
    throw error;
  }
})
.parse(string => {
  const arg = Cadence.parseArgs(string);

  // If any named arguments are given, only use named arguments.
  if (arg.type) {
    const {nick, jid, reason, type} = arg;
    const _jid = xmpp.JID.parse(jid);
    return {type, nick, reason, jid: _jid};
  }

  const [type, target] = arg[0];
  const reason = string.substring(arg[1][0][1]).trim();
  const jid = xmpp.JID.parse(target) || {};

  return {reason, type, jid: jid.node && jid, nick: !jid.node && target};
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
      return ui.messageInfo(strings.info.macros, {macros});
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
    Cadence.saveSettings(true);
    return ui.messageInfo(strings.info.aliasDelete, {command});
  }

  // Run a DFS to avoid recursive macros.
  const macros = config.settings.macros;
  const search = (macro, path) => {
    macro.forEach(statement => {
      const [,cmd] = statement.match(/^\/(\S+)/) || [];
      const newPath = path.concat([cmd]);
      if (cmd == command) throw new Cadence.Error(strings.error.aliasRecursion, {
        command, path: newPath.join(' -> ')
      });
      else return macros[cmd] && search(macros[cmd], newPath);
    });
  };
  search(macro, [command]);

  if (macros[command]) {
    ui.messageInfo(strings.info.aliasReplace, {command});
  }
  else ui.messageInfo(strings.info.aliasAdd, {command});
  macros[command] = macro;
  Cadence.saveSettings(true);
})
.parse(string => {
  string = string.trim();
  if (!string) return {};

  const [prefix, command] = string.match(/^\/*(\S+)/) || [];
  if (!command) {
    throw new Cadence.Error($('<div>').html(strings.error.aliasFormat));
  }
  const data = string.substring(prefix.length);
  if (!data) return {command};

  const macro = data.split(';').map(st => st.trim()).filter(x => x);
  return {command, macro};
});

(() => {
  const parser = string => ({status: string.trim()});
  ['away', 'dnd', 'xa'].forEach(show => {
    Cadence.addCommand(show, async ({status}) => {
      await xmpp.sendStatus({show, status});
      ui.setUserStatus(show);
    }).parse(parser).require(Cadence.requirements.room);
  });
  Cadence.addCommand('back', async ({status}) => {
    await xmpp.sendStatus({status});
    ui.setUserStatus('available');
  }).parse(parser).require(Cadence.requirements.room);
})();

/**
 * ban <nick>|<jid>
 *   Shortcut for "/affiliate outcast <nick|jid>".
 */
Cadence.addCommand('ban', ({nick, jid, reason}) => {
  if (!nick && !jid) throw new Cadence.Error(strings.error.noArgument);
  return Cadence.execute('affiliate', {type: 'outcast', nick, jid, reason});
})
.parse(string => {
  const arg = Cadence.parseArgs(string);
  const [target] = arg[0];

  const _jid = xmpp.JID.parse(arg.jid || target);
  const jid = _jid.node && _jid;
  const nick = arg.nick || !arg.jid && !_jid.node && target;
  const reason = arg.reason || string.substring(arg[1][0][0]).trim();

  return {jid, nick, reason};
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
  ui.history = [];
  ui.historyIndex = 0;
});

/**
 * configure [room] <args>
 *   Alter a room configuration.
 */
Cadence.addCommand('configure', async arg => {
  const {name, help, interactive} = arg;

  if (help) {
    const args = Object.entries(strings.help.configure.args).map(
      ([key, val]) => [$('<code>').text(`--${key}`), val]
    );
    return ui.messageInfo(strings.help.configure.text, {args});
  }
  if (!name) throw new Cadence.Error(strings.error.noArgument);

  const room = xmpp.getRoom(name);
  const noArgs = Object.keys(arg).every(
    key => !isNaN(key) || key === 'name'
  );

  // The form is either presented interactively, or filled with CLI arguments.
  const form = await xmpp.roomConfig(name);

  const submit = async data => {
    try {
      await xmpp.roomConfigSubmit(name, data);
      ui.messageInfo(strings.info.roomConf);
    }
    catch (error) {
      switch (error.condition) {
        case 'item-not-found':
          throw new Cadence.Error(strings.error.notFound.room, {name});
        case 'forbidden':
          throw new Cadence.Error(strings.error.roomConfDenied, {room});
      }
      throw error;
    }
  };

  if (interactive || noArgs) {
    // Form submission uses a callback because it can be triggered multiple times.
    const htmlform = ui.dataForm(form, submit);
    const cancel = () => xmpp.roomConfigCancel(name);
    return ui.formDialog(htmlform, {cancel});
  }
  else return submit(Cadence.roomConf(arg));
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
Cadence.addCommand('connect', async function({user, pass, anonymous, automatic}) {
  let auth;
  if (user && pass) {
    auth = {user, pass};
  }
  if (anonymous) {
    auth = {user: '', pass: ''};
  }
  else if (this.auth) {
    auth = this.auth;
  }
  else if (document.loginUser.value && document.loginPass.value) {
    auth = {user: document.loginUser.value, pass: document.loginPass.value};
  }
  else if (config.settings.xmpp.sessionAuth && config.xmpp.sessionAuth) {
    try {
      auth = await Cadence.sessionAuth(config.xmpp.sessionAuth);
      ui.messageInfo(strings.info.sessionAuth, {username: auth.user});
    }
    catch (error) {
      // Session authentication should fail silently.
    }
  }

  // Only complain about missing credentials on a manual invocation.
  if (!auth && !automatic) throw new Cadence.Error(strings.error.connection.auth);

  try {
    await Cadence.connect(auth.user, auth.pass);
  }
  catch (error) {
    // Reconnect if we're in some kind of broken state.
    if (error instanceof xmpp.ConnectionError && error.status == Strophe.Status.CONNECTED) {
      await Cadence.execute('quit');
      await Cadence.execute('connect', {user, pass});
    }
    else {
      throw error;
    }
  }
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
Cadence.addCommand('create', async arg => {
  const {help, name, title, interactive} = arg;

  if (help) return await Cadence.execute('configure', {help});

  if (!name) throw new Cadence.Error(strings.error.roomCreateName);

  const room = {id: name, title};

  // Look for the room to make sure it doesn't exist.
  if (xmpp.queryRoomExists(room)) {
    throw new Cadence.Error(strings.error.roomExists, {room});
  }

  ui.messageInfo(strings.info.creating, {room, user: {nick: xmpp.nick.target, jid: xmpp.jid}});
  await xmpp.joinRoom({room: name});

  const form = await xmpp.roomConfig(name);

  let data;
  try {
    if (interactive) {
      const form = ui.dataForm(form);
      ui.formDialog(htmlForm, {cancel: error => { throw error; }, single: true});
      data = await form.submittedData;
    }
    else {
      data = Cadence.roomConf(arg);
    }
  }
  catch (error) {
    xmpp.roomConfigCancel(name);
    throw error || new Cadence.Error(strings.error.roomCreateCancel);
  }

  try {
    await xmpp.roomConfigSubmit(name, data);
  }
  catch (error) {
    xmpp.leaveRoom({room: name});
    throw error;
  }

  xmpp.setRoom(name);
  Cadence.setSetting('xmpp.room', name);
  ui.messageInfo(strings.info.roomCreated, {room});
  const rooms = await xmpp.discoverRooms();

  ui.refreshRooms(rooms);
  ui.updateRoom(name, xmpp.roster[name]);
  ui.messageInfo(strings.info.joined, {room: rooms[name]});
})
.parse(string => {
  const arg = Cadence.parseArgs(string);
  // Use --name or positional args or --title as name.
  const name = arg.name || arg[0].join(' ') || arg.title;
  // Use --title or --name as title.
  arg.title = arg.title || name;
  // The name must be lowercase.
  arg.name = name && name.toLowerCase();
  return arg;
})
.require(Cadence.requirements.online);

Cadence.addCommand('destroy', async ({room, alternate, reason}) => {
  const name = room;
  if (!name) throw new Cadence.Error(strings.error.noArgument);

  room = xmpp.getRoom(name);
  if (!room) throw new Cadence.Error(strings.error.notFound.room, {name});

  const confirm = visual.formatText(strings.info.destroyConfirm, {room});
  if (!window.confirm(confirm.text())) return;

  try {
    await xmpp.destroyRoom(name, alternate, reason);
    ui.messageInfo(strings.info.destroySuccess, {room});
  }
  catch (error) {
    if (error.condition === 'forbidden')
      throw new Cadence.Error(strings.error.destroyDenied, {room});
    throw error;
  }
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
Cadence.addCommand('dmsg', ({jid, text}) => {
  if (!jid || !text) throw new Cadence.Error(strings.error.noArgument);
  if (!jid.node) throw new Cadence.Error(strings.error.jidInvalid, {jid});

  const message = Cadence.sendMessage({to: jid, text});
  ui.messageAppend(visual.formatMessage($.extend(message, {
    time: new Date(),
    to: {jid},
    user: {jid: xmpp.jid},
  })));
})
.parse(string => {
  const arg = Cadence.parseArgs(string);
  if (arg[0].length) {
    arg.jid = arg[0][0];
    arg.text = string.substring(arg[1][0][0]).trim();
  }
  arg.jid = xmpp.JID.parse(arg.jid);
  return arg;
})
.require(Cadence.requirements.online);

/**
 * invite [<jid> <msg> | --room <room> --nick <nick> --msg <msg>]
 */
Cadence.addCommand('invite', ({nick, jid, room, msg}) => {
  jid = jid || nick && xmpp.jidFromRoomNick({room: {room, nick}});
  if (!jid) throw new Cadence.Error(strings.error.noArgument);

  xmpp.invite({to: target, msg});
  ui.messageInfo(strings.info.inviteSent, {jid, room: xmpp.getRoom()});
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
Cadence.addCommand('join', async ({room, password}) => {
  const name = room;
  if (!name) throw new Cadence.Error(strings.error.noArgument);

  // Refresh room list and try to find the room.
  await xmpp.discoverRooms();
  ui.refreshRooms(rooms);
  room = Cadence.getRoomFromTitle(name);
  if (!room) throw new Cadence.Error(strings.error.notFound.room, {name});
  if (room.id === xmpp.room.current) {
    throw new Cadence.Error(strings.error.joinSame, {room});
  }

  let nick = xmpp.nick.target;

  // Maybe find a registered nick, ignoring errors.
  if (config.settings.xmpp.registerNick) {
    try {
      nick = await xmpp.getReservedNick(room.id);
    }
    catch (error) {}
  }

  ui.messageInfo(strings.info.joining, {room, user: {nick, jid: xmpp.jid}});

  try {
    await xmpp.joinRoom({room: room.id, nick, password});
    ui.updateRoom(room.id, xmpp.roster[room.id]);
    Cadence.setSetting('xmpp.room', room.id);
    xmpp.setRoom(room.id);
    ui.messageInfo(strings.info.joined, {room});
    Cadence.execute('who');
  }
  catch (error) {
    ui.setFragment(xmpp.room.current);
    if (error.condition === 'registration-required')
      throw new Cadence.Error(strings.error.joinRegister, {room});
    throw error;
  }
})
.parse(string => ({room: string.trim()}))
.require(Cadence.requirements.online);

/**
 * kick <nick>
 *   Ask XMPP to kick a user.
 *   The client will not validate the command or its authority; that's the
 *   server's job.
 */
Cadence.addCommand('kick', async ({nick, reason}) => {
  if (!nick) throw new Cadence.Error(strings.error.noArgument);
  try {
    await xmpp.setUser({nick, role: 'none'}, reason);
  }
  catch (error) {
    switch (error.condition) {
      case 'not-acceptable':
        throw new Cadence.Error(strings.error.notFound.nick, {nick});
      case 'not-allowed':
        throw new Cadence.Error(strings.error.kick, {nick});
    }
    throw error;
  }
})
.parse(string => {
  const arg = Cadence.parseArgs(string);
  const [nick] = arg[0];
  const reason = string.substring(arg[1][0][0]).trim();
  return {nick, reason};
})
.require(Cadence.requirements.room);

/**
 * list:
 *   List available rooms.
 */
Cadence.addCommand('list', async () => {
  let rooms;
  try {
    const data = await xmpp.discoverRooms();
    ui.refreshRooms(data);
    rooms = $.map(data, x => x).sort((a, b) => 1-2*(a.title < b.title));
    rooms.type = 'room';
  }
  catch (error) {
    const domain = config.xmpp.muc;
    if (error.condition === 'remote-server-not-found')
      throw new Cadence.Error(strings.error.muc.notFound, {domain});
    throw new Cadence.Error(strings.error.muc.unknown, {domain});
  }
  if (rooms.length) ui.messageInfo(strings.info.roomsAvailable, {rooms});
  else throw new Cadence.Error(strings.error.noRoomsAvailable);
})
.require(Cadence.requirements.online);

/**
 * me <msg>
 *   Alias for /say "/me <msg>".
 */
Cadence.addCommand('me', async ({text}) => {
  // XEP-0245 says to simply send this command as text.
  await Cadence.execute('say', {text: '/me' + text});
})
.parse(string => ({text: string}))
.require(Cadence.requirements.room);

/**
 * msg <nick> <msg>
 *   Send a private message to another occupant.
 */
Cadence.addCommand('msg', ({nick, text}) => {
  if (!nick || !text.trim()) throw new Cadence.Error(strings.error.noArgument);
  const recipient = xmpp.getOccupant(nick);
  if (!recipient) {
    throw new Cadence.Error(strings.error.notFound.nick, {nick});
  }

  const message = Cadence.sendMessage({
    to: xmpp.jidFromRoomNick({room: {nick}}),
    type: 'chat',
    text,
  });

  ui.messageAppend(visual.formatMessage($.extend(message, {
    user: xmpp.getOccupant(),
    to: recipient,
    time: new Date(),
  })));
})
.parse(string => {
  const arg = Cadence.parseArgs(string);
  if (arg[0].length) {
    arg.nick = arg[0][0];
    arg.text = string.substring(arg[1][0][0]).trim();
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
  if (!xmpp.getRoom()) ui.messageInfo(strings.info.nickPrejoin, {nick});
})
.parse(string => ({nick: string.trim()}))
.require(Cadence.requirements.room);

/**
 * part
 *   Leave the current room without joining a different one.
 */
Cadence.addCommand('part', async () => {
  const room = xmpp.getRoom();
  if (!room) return;

  ui.messageInfo(strings.info.leave, {room});
  ui.updateRoom();
  xmpp.leaveRoom({room: room.id});
  await Cadence.execute('list');
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
    const target = nick && xmpp.jidFromRoomNick({room: {nick}}) || jid;
    const user = xmpp.userFromJid(target);

    ui.messageInfo(strings.info.buzz, {user});
    return xmpp.attention(target);
  }).parse(parser).require(Cadence.requirements.online);

  /**
   * ping <nick>|<jid>
   *   Send a ping and display the response time.
   */
  Cadence.addCommand('ping', async ({nick, jid}) => {
    const target = nick && xmpp.jidFromRoomNick({room: {nick}}) || jid;
    const user = target && xmpp.userFromJid(target);
    const time = (new Date()).getTime();

    try {
      await xmpp.ping(target);
    }
    catch (error) {
      switch (error.condition) {
        case 'item-not-found':
          throw new Cadence.Error(strings.error.notFound.nick, {nick});
        case 'remote-server-not-found':
          throw new Cadence.Error(strings.error.notFound.domain, target);
        case 'service-unavailable':
          throw new Cadence.Error(strings.error.notFound.node, target);
        case 'timeout':
          const delay = ((new Date()).getTime() - time).toString();
          throw new Cadence.Error(strings.error.pingTimeout[+!!user], {user, delay});
      }
      throw error;
    }

    const delay = ((new Date()).getTime() - time).toString();
    ui.messageInfo(strings.info.pong[+!!user], {user, delay});

  }).parse(parser).require(Cadence.requirements.online);

  /**
   * time [<nick>|<jid>]
   *   Send a time request and display the response.
   */
  Cadence.addCommand('time', async ({nick, jid}) => {
    const target = nick && xmpp.jidFromRoomNick({room: {nick}}) || jid;
    const user = target && xmpp.userFromJid(target);

    const start = new Date();

    try {
      const stanza = await xmpp.getTime(target);
      const now = new Date();
      const tzo = $('tzo', stanza).text();
      const utc = new Date($('utc', stanza).text());
      const time = moment(utc).utcOffset(tzo);
      let offset = (utc - now) + (now - start) / 2
      if (offset > 0) offset = '+' + offset;
      ui.messageInfo(strings.info.time[+!!user], {user, tzo, time, offset});
    }
    catch(error) {
      switch (error.condition) {
        case 'item-not-found':
          throw new Cadence.Error(strings.error.notFound.nick, {nick});
        case 'remote-server-not-found':
          throw new Cadence.Error(strings.error.notFound.domain, target);
        case 'service-unavailable':
          throw new Cadence.Error(strings.error.notFound.node, target);
        case 'feature-not-implemented':
          throw new Cadence.Error(strings.error.feature);
        case 'timeout':
          throw new Cadence.Error(strings.error.timeout);
      }
      throw error;
    }
  }).parse(parser).require(Cadence.requirements.online);

  /**
   * version
   *   Either print the client and server version, or query another user.
   */
  Cadence.addCommand('version', async ({nick, jid}) => {
    if (!nick && !jid) {
      const version = $('<a>').attr('href', config.clientURL).text(config.version);
      ui.messageInfo(strings.info.versionClient, {version});
    }

    // Don't ask for server version when offline.
    if (!xmpp.connection.authenticated) {
      if (nick || jid) {
        throw new Cadence.Error(strings.error.cmdStatus.offline, {command: 'version'});
      }
      else return;
    }

    const target = nick && xmpp.jidFromRoomNick({room: {nick}}) || jid;
    const user = target && xmpp.userFromJid(target);

    try {
      const stanza = await xmpp.getVersion(target);
      const name = $('name', stanza).text();
      const version = $('version', stanza).text();
      const os = $('os', stanza).text() || '-';
      if (user)
        ui.messageInfo(strings.info.versionUser, {name, version, os, user});
      else
        ui.messageInfo(strings.info.versionServer, {name, version, os});
    }
    catch (error) {
      switch (error.condition) {
        case 'item-not-found':
          throw new Cadence.Error(strings.error.notFound.nick, {nick});
        case 'remote-server-not-found':
          throw new Cadence.Error(strings.error.notFound.domain, target);
        case 'service-unavailable':
          throw new Cadence.Error(strings.error.notFound.node, target);
        case 'feature-not-implemented':
          throw new Cadence.Error(strings.error.feature);
        case 'timeout':
          throw new Cadence.Error(strings.error.timeout);
      }
      throw error;
    }
  }).parse(parser);
})();

/**
 * quit
 *   Ask XMPP to disconnect.
 */
Cadence.addCommand('quit', async () => {
  const {sync} = config.settings;
  ui.messageInfo(strings.info.connection.disconnecting);
  if ((sync.account === xmpp.jid.node) && sync.auto) {
    await Cadence.tryCommand('sync');
  }
  await xmpp.connection.disconnect();
})
.require(Cadence.requirements.online);

/**
 * save
 *   Create a text file (by data: URI) from the chat history.
 */
Cadence.addCommand('save', ({type}) => {
  const html = type == 'html';
  if (!html) type = 'plain';
  if (!ui.messages.length) throw new Cadence.Error(strings.error.saveEmpty);

  const date = moment(new Date(ui.messages[0].timestamp)).format('YYYY-MM-DD');
  const room = xmpp.getRoom();
  const prefix = room ? room.id : config.xmpp.muc;

  let data = visual['messagesTo' + (html ? 'HTML' : 'Text')](ui.messages);
  if (html) {
    const title = (room ? room.title : prefix) + ' (' + date + ')';
    const head = $('<head>').append($('<title>').text(title));
    const body = $('<body>').append(data);
    data = '<!DOCTYPE html>' + $('<html>').append(head, body).html();
  }
  const blob = new Blob([data], {type: 'text/' + type + ';charset=utf-8'});
  const suffix = html ? 'html' : 'log';
  saveAs(blob, `${prefix}-${date}.${suffix}`);
})
.parse(string => ({type: string.trim()}));

/**
 * say <msg>
 *   The default command that simply sends a message verbatim.
 */
Cadence.addCommand('say', ({text}) => {
  Cadence.sendMessage({
    text,
    to: xmpp.jidFromRoomNick(),
    type: 'groupchat',
  });
})
.parse(string => ({text: string}))
.require(Cadence.requirements.room);

Cadence.addCommand('subject', ({text}) => xmpp.setSubject(text))
.parse(string => ({text: string.trim()}))
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
Cadence.addCommand('unban', async ({jid}) => {
  if (!jid) throw new Cadence.Error(strings.error.noArgument);

  // Need to get the ban list first, because blindly setting affiliation to "none"
  // would also strip the affiliation of a non-banned user.
  try {
    const stanza = xmpp.getUsers({affiliation: 'outcast'});
    const isBanned = $('item', stanza).is(function () {
      return jid.matchBare(this.getAttribute('jid'));
    });
    if (isBanned) await Cadence.execute('affiliate', {type: 'none', jid});
    else throw new Cadence.Error(strings.error.unbanNone);
  }
  catch (error) {
    if (error.condition === 'forbidden')
      throw new Cadence.Error(strings.error.affiliations.forbidden);
    throw error;
  }
})
.parse(string => ({jid: xmpp.JID.parse(string.trim())}))
.require(Cadence.requirements.room);

/**
 * who [room]
 *   Query the user list of a room.
 */
Cadence.addCommand('who', async ({room}) => {
  const name = room;
  room = name ? Cadence.getRoomFromTitle(room) : xmpp.getRoom();
  if (!room) {
    if (name) throw new Cadence.Error(strings.error.notFound.room, {name});
    else throw new Cadence.Error(strings.error.noArgument);
  }

  if (room.id !== xmpp.room.current) {
    const users = await xmpp.queryOccupants(room.id);
    users.type = 'nick';
    if (users.length) ui.messageInfo(strings.info.usersInRoom, {room, users});
    else ui.messageInfo(strings.info.noUsers, {room});
  }
  else {
    const users = $.map(xmpp.getRoster(), x => x)
    .sort((a, b) => 1-2*(a.nick.toLowerCase() < b.nick.toLowerCase()));
    users.type = 'user';
    ui.messageInfo(strings.info.usersInThisRoom, {users});
  }
})
.parse(string => ({room: string.trim()}))
.require(Cadence.requirements.online);

/**
 * whois <nick>
 *   Print out information on a participant in the current room.
 */
Cadence.addCommand('whois', ({nick}) => {
  if (!nick) throw new Cadence.Error(strings.error.noArgument);
  const user = xmpp.getOccupant(nick);
  if (!user) throw new Cadence.Error(strings.error.notFound.nick, {nick});
  const {jid, role, affiliation, show, status} = user;
  ui.messageInfo(strings.info.whois, {
    user,
    jid: jid || '---',
    privilege: `${role}/${affiliation}`,
    status: show + (status ? ` (${status})` : '')
  });
})
.parse(string => ({nick: string.trim()}))
.require(Cadence.requirements.room);
