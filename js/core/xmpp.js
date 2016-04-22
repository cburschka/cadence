/**
 * xmpp.js contains all the functions that communicate with the XMPP server.
 */
var xmpp = {
  connection: null,
  room: {
    available: {},
    target: null,
    current: null,
  },
  nick: {
    target: null,
    current: null,
  },
  currentJid: null,
  user: null,
  resource: null,
  status: 'offline',
  userStatus: null,
  statusConstants: {},
  roster: {},
  historyEnd: {},

  /**
   * Create the connection object.
   */
  initialize: function() {
    // Generate a reverse lookup table for the connection status constants.
    for (key in Strophe.Status) {
      this.statusConstants[Strophe.Status[key]] = key;
    }
  },

  /**
   * Open a new connection and authenticate.
   */
  newConnection: function(user, pass) {
    this.disconnect();
    this.session = {};
    this.user = user;
    this.nick.target = user;
    this.currentJid = Strophe.escapeNode(user) + '@' + config.xmpp.domain + '/' + this.createResourceName();
    this.connection = new Strophe.Connection(config.xmpp.url);
    this.connection.addHandler((stanza) => { return this.eventPresenceCallback(stanza) }, null, 'presence');
    this.connection.addHandler((stanza) => { return this.eventMessageCallback(stanza) }, null, 'message');
    this.connection.addHandler((stanza) => { return this.eventIQCallback(stanza) }, null, 'iq');

    this.connection.ping.addPingHandler((ping) => {
      this.connection.ping.pong(ping);
      return true;
    });
    this.connection.time.addTimeHandler((request) => {
      this.connection.time.sendTime(request);
      return true;
    });
    this.connection.version.addVersionHandler((request) => {
      this.connection.version.sendVersion(request, {
        name: config.clientName,
        version: config.version,
        os: navigator.userAgent
      });
      return true;
    });

    this.connection.addTimedHandler(30, () => { return this.discoverRooms() } );
    // DEBUG: print connection stream to console:
    this.connection.rawInput = (data) => {
      if (config.settings.debug) console.log('%cRECV ' + data, 'color:blue');
    };
    this.connection.rawOutput = (data) => {
      if (config.settings.debug) console.log('%cSEND ' + data, 'color:red');
    };

    this.connection.connect(this.currentJid, pass, (status, error) => { return this.eventConnectCallback(status, error) });
  },

  /**
   * Wrapper for $iq() that fills in the sender, target and an optional <query>.
   *
   * @param {string} type: Required; one of get, set, result, error.
   * @param {object} target: A target object.
   * @param {object} item: jQuery or generic object.
   */
  iq: function(type, target, item) {
    var iq = $iq({from: this.connection.jid, to: this.jid(target), type});
    if (item) {
      if (item.constructor === Object) iq.c('query', item);
      else if (item.constructor === $) iq.cnode(item[0]);
    }
    return iq;
  },

  /**
   * Wrapper for $msg() that fills in the sender JID and the target.
   *
   * @param {object} target: A target passed to xmpp.jid().
   */
  msg: function(target) {
    return $msg({
      from: this.connection.jid,
      to:   this.jid(target),
      type: (target ? 'chat' : 'groupchat')
    });
  },

  /**
   * Wrapper for $pres() that fills in the sender JID, an optional target,
   * and optional attributes.
   *
   * @param {Object} target The target of the directed presence.
   * @param {Object} attrs The attributes of the <presence/> element.
   */
  pres: function(target, attrs) {
    return $pres({
      from: this.currentJid,
      to: target && this.jid(target)
    }).attrs(attrs);
  },

  /**
   * Create a unique client identifier from the current millisecond timestamp.
   */
  createResourceName: function() {
    return visual.formatText(config.settings.xmpp.resource, {
      client: config.clientName,
      version: config.version,
      timestamp: (new Date()).getTime().toString()
    }).text();
  },

  /**
   * Generate a JID from an object of values.
   *
   * @param {object} data The values for the JID.
   */
  jid: function(data) {
    // A JID overrides everything else.
    if (data && data.jid) return data.jid;

    // If null/undefined, or a nick is given, default to the current room.
    data = data || {room: this.room.current};
    var room = data.room || data.nick && this.room.current;

    // Use either data.node or data.room, and data.resource or data.nick.
    var node = data.node || room || '';
    var resource = data.resource || data.nick || '';

    // domain defaults to the MUC service if a room or nick (even null) is given.
    var muc = data.nick || data.room !== undefined;
    var domain = data.domain || config.xmpp[muc ? 'mucService' : 'domain'];

    // Construct the JID.
    if (node) node = Strophe.escapeNode(node) + '@';
    if (resource) resource = '/' + resource;
    return node + domain + resource;
  },

  /**
   * Prompt the user to enter a different nickname.
   */
  nickConflictResolve: function() {
    var nick = prompt(strings.info.nickConflictResolve, this.nick.target);
    if (nick && nick != this.nick.target) return this.nick.target = nick;
  },

  /**
   * Attempt to change to a new nick in the current room.
   *
   * The current nick will only be changed once the server responds with a
   * 110 status to assign the new nick.
   *
   * @param {string} nick The new nick to acquire.
   *
   * @return {Promise} A promise that will resolve to the new nickname.
   */
  changeNick: function(nick) {
    return new Promise((resolve, reject) => {
      this.nick.target = nick;
      if (this.status != 'online') return resolve();

      this.connection.send(this.pres({nick}));
      this.connection.addHandler((stanza) => {
        // The new presence must come from our nickname, or contain a 110 status.
        const from = stanza.getAttribute('from');
        const newNick = Strophe.getResourceFromJid(from);
        const type = stanza.getAttribute('type');
        if (nick == newNick || $('x status[code="110"]', stanza).length) {
          if (type != 'error') resolve(newNick);
          else reject($('error', stanza));
        }
        else return true;
      }, null, 'presence', null, null, xmpp.jid({nick}), {matchBare: true});
    });
  },

  /**
   * Send an unavailable presence to a specified room.
   *
   * @param {string} room The room to leave.
   */
  leaveRoom: function(room) {
    this.connection.send(this.pres(
      {room, nick: this.nick.current},
      {type: 'unavailable'}
    ));
    delete this.roster[room];
    // The server does not acknowledge the /part command, so we need to change
    // the state right here: If the room we left is the current one, enter
    // prejoin status and list the rooms again.
    if (room == this.room.current) this.prejoin();
    else this.discoverRooms();
  },

  prejoin: function() {
    this.room.current = null;
    ui.setFragment(null);
    this.status = 'prejoin';
    ui.setStatus(this.status);
    chat.commands.list();
  },

  /**
   * Query the server for a reserved nickname in a room, and execute callbacks.
   *
   * The callback will be executed regardless of success or failure. As its
   * argument, it will receive either the nickname or {undefined}.
   *
   * @param {string} room The room to get a nickname from.
   * @param {function} callback The function to execute after the request is
   *                   complete.
   */
  getReservedNick: function(room, callback) {
    var iqCallback = (stanza) => {
      var nick = (
        ($('query').attr('node') == 'x-roomuser-item') &&
        $('identity', stanza).attr('name') || null);
      callback(nick);
    };
    this.connection.sendIQ(
      this.iq('get', {room}, {xmlns: Strophe.NS.DISCO_INFO, node: 'x-roomuser-item'}),
      iqCallback, iqCallback
    );
  },

  /**
   * Query the server for extended room information.
   *
   * Returns a promise that will resolve to a room object:
   *   id: The internal room name
   *   title: The user-facing name
   *   members: The number of occupants
   *   features: An array of supported features
   *   data: A dictionary of all extended information fields.
   *   (http://xmpp.org/extensions/xep-0045.html#disco-roominfo)
   *
   * In the case of an error, the promise will reject with the <error> element.
   */
  getRoomInfo: function(room) {
    return new Promise((resolve, reject) => {
      this.connection.sendIQ(
        this.iq('get', {room}, {xmlns: Strophe.NS.DISCO_INFO}),
        (stanza) => {
          const query = $('query', stanza);
          const features = $.makeArray(query.children('feature').map(function() {
            return $(this).attr('var')
          }));
          const data = {};
          query.find('x > field').each(function() {
            data[$(this).attr('var')] = $(this).find('value').text();
          });
          resolve({
            id: room,
            title: query.children('identity').attr('name'),
            members: +data['muc#roominfo_occupants'],
            features, data
          });
        },
        (stanza) => { reject($('error', stanza)); }
      );
    });
  },

  /**
   * Join a room, regardless of whether it exists.
   *
   * Returns a promise that will resolve or reject on the returned room presence.
   *
   * @param {string} The room name.
   */
  joinRoom: function({room, nick, password}) {
    return new Promise((resolve, reject) => {
      if (room) this.room.target = room;
      else return reject();
      if (nick) this.nick.target = nick;

      const jid = xmpp.jid({room, nick: this.nick.target});
      const presence = this.pres({room, nick: this.nick.target})
        .c('x', {xmlns:Strophe.NS.MUC})
        .c('history', {since: this.historyEnd[room] || '1970-01-01T00:00:00Z'});
      if (password) presence.up().c('password', password);
      this.connection.send(presence);

      // The server may alter the nickname, requiring a bare match:
      this.connection.addHandler((stanza) => {
        if ($(stanza).attr('type') == 'error') reject($('error', stanza));
        if ($('status[code=110]', stanza).length) resolve(stanza);
      }, null, 'presence', null, null, jid, {matchBare: true});
    });
  },

  /**
   * Send a mediated invitation.
   * @param jid this may be an occupant in a different room
   * @param text an optional text message
   */
  invite: function(jid, text) {
    this.connection.send($msg({
      from: this.connection.jid,
      to: this.jid()
    })
    .c('x', {xmlns: Strophe.NS.MUC + '#user'})
    .c('invite', {to: jid})
    .c('reason', text));
  },

  /**
   * Request a room configuration form.
   *
   * See http://xmpp.org/registrar/formtypes.html#http:--jabber.org-protocol-mucroomconfig
   * for a reference on supported room configuration fields.
   *
   * @param {string} room The room name.
   *
   * @return {Promise} A promise that resolves to the <x> element of the form,
   *                   or rejects with an <error> element.
   */
  roomConfig: function(room) {
    return new Promise((resolve, reject) => {
      this.connection.sendIQ(
        this.iq('get', {room}, {xmlns: Strophe.NS.MUC + '#owner'}),
        (stanza) => { resolve($('query x', stanza)); },
        (stanza) => { reject($('error', stanza)); }
      );
    });
  },

  /**
   * Send a room configuration form to the server.
   *
   * @param {string} room The room name.
   * @param {Object} data A dictionary of form fields to send.
   *
   * @return {Promise} A promise that resolves when the form is acknowledged.
   */
  roomConfigSubmit: function(room, data) {
    return new Promise((resolve, reject) => {
      const form = xmpp.iq('set', {room}, {xmlns: Strophe.NS.MUC + '#owner'})
        .c('x', {xmlns: 'jabber:x:data', type: 'submit'});

      for (let name in data) {
        if (data[name] !== undefined) {
          form.c('field', {'var': name});
          const values = data[name].constructor === Array ? data[name] : [data[name]];
          for (let value of values) form.c('value', {}, value.toString());
        }
        form.up();
      }

      xmpp.connection.sendIQ(form, resolve, (stanza) => { reject($('error', stanza)) });
    });
  },

  /**
   * Cancel a room configuration.
   * This is important when creating a room, because the server
   * must destroy the room if the initial configuration is canceled.
   * (Subsequent configuration requests are usually stateless.)
   *
   * @param {string} room The room.
   */
   roomConfigCancel: function(room) {
     const iq = this.iq('set', {room}, {xmlns: Strophe.NS.MUC + '#owner'})
       .c('x', {xmlns: 'jabber:x:data', type: 'cancel'});

     this.connection.sendIQ(iq);
   },

  /**
   * Order the server to destroy a room.
   * @param {string} room The room ID.
   * @param {string} alternate An alternate room ID (optional).
   * @param {string} message The reason (optional).
   * @param {function} success The callback to execute on completion.
   */
  destroyRoom: function(room, alternate, message, success) {
    var iq = this.iq('set', {room}, {xmlns: Strophe.NS.MUC + '#owner'})
      .c('destroy');
    if (alternate) iq.attrs({jid: Strophe.escapeNode(alternate) + '@' + config.xmpp.mucService});
    if (message) iq.c('reason', message);
    this.connection.sendIQ(iq, () => {
      success && success();
      this.discoverRooms();
    },
    (stanza) => { success(stanza ? $('error', stanza).attr('code') : true); });
  },

  /**
   * Request a service administration command form and fill it out with the values provided.
   *
   * @param {string} node The command node name.
   * @param {Object|function} query Either the field values to set, or a function
   *        that will acquire the field values asynchronously. The function receives
   *        an <x> element of type form as a jQuery object and a callback function
   *        to transmit the field values to.
   * @param {function} callback The callback to execute after submission.
   */
  submitCommand: function(node, query, callback) {
    if (typeof query == 'object') {
      var values = query;
      query = xmpp.fillForm(values);
    }

    var submit = (sessionid) => {
      return (values) => {
        var form = xmpp.iq('set', {}).c('command', {
          xmlns: 'http://jabber.org/protocol/commands',
          node: 'http://jabber.org/protocol/admin#' + node,
          sessionid
        }).c('x', {xmlns: 'jabber:x:data', type: 'submit'});
        for (var name in values) {
          if (values[name] === undefined) continue;
          if (typeof values[name] === 'string') values[name] = [values[name]];
          form.c('field', {'var': name});
          for (var i in values[name]) {
            form.c('value', values[name][i]).up();
          }
          form.up();
        }

        xmpp.connection.sendIQ(form,
          (stanza) => { callback && callback(stanza, 2); },
          (stanza) => { callback && callback(stanza, 1); }
        );
      }
    }

    this.connection.sendIQ(
      this.iq('set', {})
      .c('command', {
        xmlns: 'http://jabber.org/protocol/commands',
        action: 'execute',
        node: 'http://jabber.org/protocol/admin#' + node
      }),
      (stanza) => {
        var values = {};
        var sessionid = $('command', stanza).attr('sessionid');
        query($('command x', stanza), submit(sessionid));
      },
     (stanza) => { callback && callback(stanza, 0); }
    );
  },

  /**
   * Create and send a presence stanza to the current room, with optional
   * <show/> and <status/> elements.
   * Note: To return from away-mode, a presence without <show/> is sent.
   *
   * @param {string} show This must be one of "away", "chat", "dnd", "xa" or null.
   * @param {string} status This is an arbitrary status message.
   */
  sendStatus: function(show, status) {
    var p = this.pres({nick: this.nick.current});
    if (show) p.c('show', {}, show);
    if (status) p.c('status', {}, status);
    this.userStatus = show;
    this.connection.send(p);
  },

  /**
   * Send a message to the room.
   *
   * @param {Object} body: An object containing both html and text strings.
   */
  sendMessage: function(body, target) {
    html = $('<p>' + body.html + '</p>');
    this.connection.send(this.msg(target)
      .c('body', body.text).up()
      .c('html', {xmlns:Strophe.NS.XHTML_IM})
      .c('body', {xmlns:Strophe.NS.XHTML}).cnode(html[0])
    );
    ui.playSound('send');
  },

  /**
   * Set a user's role (by roomnick) or affiliation (by jid).
   */
  setUser: function(item, success, error) {
    this.connection.sendIQ(
      this.iq('set', null, {xmlns: Strophe.NS.MUC + '#admin'}).c('item', item),
      success, (response) => {
        var code = $('error', response).attr('code');
        error(code, response);
      }
    );
  },

  setRoom: function(room) {
    if (room == this.room.current) return;
    const oldRoom = this.room.current;
    if (oldRoom) xmpp.leaveRoom(oldRoom);

    this.room.current = room;
    this.status = 'online';
  },

  /**
   * Get user list (by affiliation or role).
   */
  getUsers: function(query, success, error) {
    this.connection.sendIQ(
      this.iq('get', null, {xmlns: Strophe.NS.MUC + '#admin'}).c('item', query),
      success, error
    );
  },

  /**
   * Query a room for its occupant list.
   */
  getOccupants: function(room, callback) {
    this.connection.sendIQ(
      this.iq('get', {room}, {xmlns: Strophe.NS.DISCO_ITEMS}),
      (stanza) => {
        var users = {};
        $('item', stanza).each(function() {
          var nick = $(this).attr('name');
          users[nick] = nick;
        });
        callback(users);
      },
      callback
    );
  },


  /**
   * Query an entity's version.
   *
   * @param {function} callback The function that handles the response.
   * @param {object} target The (optional) target to query.
   */
  getVersion: function(callback, target) {
    this.connection.sendIQ(
      this.iq('get', target || {}, {xmlns: Strophe.NS.VERSION}),
      (stanza) => {
        callback({
          name: $('name', stanza).text() || '-',
          version: $('version', stanza).text() || '-',
          os: $('os', stanza).text() || '-'
        }, stanza);
      },
      (stanza) => { callback(false, stanza); }
    );
  },

  /**
   * Query the server for rooms.
   *
   * @return {Promise} A promise that resolves to the list of rooms.
   */
  discoverRooms: function() {
    return new Promise((resolve, reject) => {
      const iq = this.iq('get', {room: null}, {xmlns: Strophe.NS.DISCO_ITEMS});
      this.connection.sendIQ(iq,
        (stanza) => {
          let rooms = {};
          $('item', stanza).each((s,t) => {
            const jid = t.getAttribute('jid');
            const id = Strophe.unescapeNode(Strophe.getNodeFromJid(jid));

            // Strip off the parenthesized number of participants in the name:
            const name = t.getAttribute('name');
            const title = name ? name.replace(/\((\d+)\)$/, '').trim() : id;

            rooms[id] = {id, title, members: null};
          });

          // Preserve the current room in the list of available rooms.
          // (This is because it might not be publicly listed.)
          const current = this.room.current;
          if (current && !rooms[current])
            rooms[current] = this.room.available[current];
          this.room.available = rooms;
          ui.refreshRooms(rooms);
          resolve(rooms);
        },
        (stanza) => { reject($('error', stanza)); }
      );
    });
  },

  /**
   * The heart of the XMPP module: This callback handles any presence stanza
   * the server sends, changing the client state (room, nick, rosters, etc.)
   * as appropriate.
   *
   * To wit, there are three main kinds of presences that hit this function:
   *
   * `error`-type presence stanzas, which indicate the server was unable
   * or unwilling to carry out a request made by a <presence/> stanza:
   * changing nicknames, joining rooms, etc.
   *
   * `unavailable`-type presences, which are caused by users leaving, being
   * kicked, or changing their names.
   *
   * Any other presence that alters the user roster or client state.
   */
  eventPresenceCallback: function(stanza) {
    if (!stanza) return true;
    var from = $(stanza).attr('from');
    // Discard any <presence/> that is not from the MUC domain.
    // (This client does not support direct non-MUC communication.)
    if (Strophe.getDomainFromJid(from) != config.xmpp.mucService) return true;

    // Find the room and nickname that the presence came from, and the type.
    var room = Strophe.unescapeNode(Strophe.getNodeFromJid(from));
    var nick = Strophe.getResourceFromJid(from);
    var type = $(stanza).attr('type');

    // Initialize the room roster if it doesn't exist yet.
    if (!this.roster[room]) this.roster[room] = {};

    if (type == 'error')
      return this.eventPresenceError(room, nick, stanza) || true;

    // Find the status codes.
    var item = $(stanza).find('item');
    var codes = $.makeArray($('status', stanza).map(function() {
        return parseInt($(this).attr('code'));
    }));

    if (type == 'unavailable')
      this.eventPresenceUnavailable(room, nick, codes, item, stanza);
    else
      this.eventPresenceDefault(room, nick, codes, item, stanza);
    return true;
  },

  /**
   * Handle presence stanzas of type `error`.
   */
  eventPresenceError: function(room, nick, stanza) {
    if ($('conflict', stanza).length) {
      if (room == this.room.current) {
        ui.messageAddInfo(strings.error.nickConflict, {nick}, 'error');
        return this.nick.target = this.nick.current;
      }
      else {
        ui.messageAddInfo(strings.error.joinConflict, {nick}, 'error');
        if (this.nickConflictResolve()) {
          ui.messageAddInfo(strings.info.rejoinNick, {nick: this.nick.target});
          return this.joinRoom(this.room.target, this.nick.target);
        }
      }
    }
    else if ($('not-authorized', stanza).length) {
      var password = prompt(strings.info.joinPassword);
      if (password) return this.joinExistingRoom(room, password);
      else ui.messageAddInfo(strings.error.joinPassword, {room: this.room.available[room]}, 'error');
    }
    else if ($('forbidden', stanza).length)
      ui.messageAddInfo(strings.error.joinBanned, {room: this.room.available[room]}, 'error');
    else if ($('not-allowed', stanza).length)
      ui.messageAddInfo(strings.error.noCreate, 'error');
    else if ($('jid-malformed', stanza).length) {
      ui.messageAddInfo(strings.error.badNick, {nick}, 'error');
      this.nick.target = this.nick.current;
    }

    // Cancel any join attempt:
    this.room.target = this.room.current;
    ui.updateRoom(this.room.current);
    ui.setFragment(this.room.current);
  },

  /**
   * Handle presence stanzas of type `unavailable`.
   */
  eventPresenceUnavailable: function(room, nick, codes, item, stanza) {
    if (room == this.room.current && this.roster[room][nick]) {
      // An `unavailable` 303 is a nick change to <item nick="{new}"/>
      if (codes.indexOf(303) >= 0) {
        var newNick = item.attr('nick');
        ui.messageAddInfo(strings.info.userNick, {
          from: this.roster[room][nick],
          to: {
            nick: newNick,
            jid: this.roster[room][nick].jid,
            role: this.roster[room][nick].role,
            affiliation: this.roster[room][nick].affiliation
          }
        });
        // Move the roster entry to the new nick, so the new presence
        // won't trigger a notification.
        this.roster[room][newNick] = this.roster[room][nick];
        // ejabberd bug: presence does not use 110 code; check nick.
        if (nick == xmpp.nick.current) xmpp.nick.current = newNick;
        ui.playSound('info');
      }
      // An `unavailable` 301 is a ban; a 307 is a kick.
      else if (codes.indexOf(301) >= 0 || codes.indexOf(307) >= 0) {
        var type = codes.indexOf(301) >= 0 ? 'ban' : 'kick'
        var actor = $('actor', item).attr('nick');
        actor = actor && this.roster[room][actor];
        var reason = $('reason', item).text();
        var index = (actor != null) * 2 + (reason != "");
        // ejabberd bug: presence does not use 110 code; check nick.
        if (nick == xmpp.nick.current) {
          ui.messageAddInfo(strings.info.evicted[type].me[index], {
            actor, reason,
            room: this.room.available[room]
          }, 'error');
        }
        else ui.messageAddInfo(strings.info.evicted[type].other[index], {
          actor, reason,
          room: this.room.available[room],
          user: this.roster[room][nick]
        });
        ui.playSound('leave');
      }
      // A <destroy> element indicates that the room has been destroyed.
      else if ($('x destroy', stanza).length) {
        var destroy = $('x destroy', stanza);
        var jid = destroy.attr('jid');
        var reason = $('reason', destroy).text();
        if (jid && Strophe.getDomainFromJid(jid) == config.xmpp.mucService){
          var alternate = Strophe.unescapeNode(Strophe.getNodeFromJid(jid));
          alternate = xmpp.room.available[alternate] || {id: alternate};
        }
        ui.messageAddInfo(strings.info.destroyed[+!!alternate][+!!reason], {
          room: xmpp.room.available[room], alternate, reason
        }, 'error');
      }
      // Any other `unavailable` presence indicates a logout.
      else {
        ui.messageAddInfo(strings.info.userOut, {user: this.roster[room][nick]});
        ui.playSound('leave');
      }

      if (nick == xmpp.nick.current) xmpp.prejoin();

      // In either case, the old nick must be removed and destroyed.
      ui.userRemove(this.roster[room][nick]);
      delete this.roster[room][nick];
    }
  },

  /**
   * Handle presence stanzas without a type.
   */
  eventPresenceDefault: function(room, nick, codes, item, stanza) {
    // away, dnd, xa, chat, [default].
    var show = $('show', stanza).text() || 'default';
    var status = $('status', stanza).text() || '';

    // Create the user object.
    var user = {
      nick,
      jid: item.attr('jid') || null, // if not anonymous.
      role: item.attr('role'),
      affiliation: item.attr('affiliation'),
      show, status
    };

    // A 110-code presence reflects a presence that we sent.
    if (codes.indexOf(110) >= 0) {
      this.roster[room][nick] = user;
      this.nick.current = nick;
    }

    // We have fully joined this room - track the presence changes.
    if (this.room.current == room) {
      // Workaround for ejabberd bug @processone/ejabberd/issues/136:
      // Detect nick change when neither 110 nor 303 code are sent.
      // This only happens when the old nick remains logged in - copy the item.
      if (this.nick.current != this.nick.target && nick == this.nick.target) {
        ui.messageAddInfo(strings.info.userNick, {
          from: this.roster[room][this.nick.current],
          to: user
        });
        // Fill in the roster so we don't get a login message.
        this.roster[room][nick] = user;
        this.nick.current = nick;
      }
      var roster = this.roster[room][nick];

      if (!roster) {
        ui.messageAddInfo(strings.info.userIn, {user});

        // Play the alert sound if a watched user enters.
        var watched = false;
        if (this.nick.current != nick) {
          for (var i in config.settings.notifications.triggers) {
            watched = watched || (0 <= nick.indexOf(config.settings.notifications.triggers[i]));
          }
        }
        watched ? ui.playSound('mention') : ui.playSound('enter');
      }
      else if (roster.show != show || roster.status != status) {
        var msg = (show in strings.show) ? strings.show[show] : strings.showOther;
        ui.messageAddInfo(msg[+!!status], {user, show, status});
        ui.playSound('info');
      }
      else if (roster.affiliation != user.affiliation) {
        ui.messageAddInfo(strings.info.userAffiliation, {user, affiliation: user.affiliation});
        ui.playSound('info');
      }
      else if (roster.role != user.role) {
        ui.messageAddInfo(strings.info.userRole, {user, role: user.role});
        ui.playSound('info');
      }
    }

    this.roster[room][nick] = user;
    ui.userAdd(this.roster[room][nick]);
  },

  /**
   * This function handles any <message> stanzas received.
   */
  eventMessageCallback: function(stanza) {
    if (stanza) {
      var from = $(stanza).attr('from');
      var type = $(stanza).attr('type');
      var domain = Strophe.getDomainFromJid(from);
      var node = Strophe.unescapeNode(Strophe.getNodeFromJid(from) || '') || null;
      var resource = Strophe.getResourceFromJid(from);

      if (type == 'error')
        return this.eventMessageError(stanza, node, domain, resource) || true;

      var muc = domain == config.xmpp.mucService;

      var body = $('html body p', stanza).contents();
      if (!body.length) body = $(stanza).children('body').contents();

      var delay = $('delay', stanza);
      var time = delay.attr('stamp') || (new Date()).toISOString();

      // Message of the Day.
      if (!node && !resource)
        return ui.messageAddInfo(strings.info.motd, {domain, text: body}, 'error');

      else if (muc) {
        const codes = $.makeArray($('x status', stanza).map(function() {
          return $(this).attr('code');
        }));

        // React to configuration updates.
        if (codes.indexOf('104') >= 0) {
          this.getRoomInfo(node).then((room) => {
            this.room.available[node] = room;
            ui.refreshRooms(this.room.available);
            ui.messageAddInfo(strings.code[104], {room});
          });
        }

        // Accept invitations.
        var invite = $('x invite', stanza);
        if (invite.length) {
          var room = xmpp.room.available[node];
          if (!room) xmpp.getRoomInfo(node).then((data) => {
            room = data;
            xmpp.room.available[node] = data;
          });
          var reason = $('reason', invite).text();
          var password = $('x password', stanza).text();
          return ui.messageAddInfo(strings.info.inviteReceived[+!!password][+!!reason], {
            jid: invite.attr('from'),
            room, password, reason
          });
        }
        // Only accept MUC messages in the current room.
        if (node != this.room.current) return true;

        // Do not look up the nick for delayed messages, because it's unreliable.
        if (delay.length) {
          user = {nick: resource}
          var jid = delay.attr('from');
          // In non-anonymous rooms, try to identify the author by JID.
          var bareJid = Strophe.getBareJidFromJid(jid)
          if (bareJid != Strophe.getBareJidFromJid(from)) {
            user.jid = jid;
            for (var nick in this.roster[node]) {
              if (bareJid == Strophe.getBareJidFromJid(this.roster[node][nick].jid)) {
                user = $.extend({}, this.roster[node][nick], user)
                break;
              }
            }
          }
        }

        // Fall back on just the nick if no roster entry exists (usually an error).
        else var user = this.roster[node][resource] || {nick: resource};
      }

      // Accept direct messages from other domains.
      else {
        var user = {jid: from};
        type = 'direct';
      }
      this.historyEnd[node] = time;

      // Process an XEP-0224 <attention> element.
      if ($(stanza).children('attention').attr('xmlns') == Strophe.NS.Cadence_ATTN) {
        ui.messageAddInfo(strings.info.attention, {user}, 'error');
      }

      // If there is no <body> element, drop the message. (@TODO #201 XEP-0085)
      if (!$(stanza).children('body').length) return true;

      if (delay.length) {
        ui.messageDelayed({
          user, body, type,
          time: delay.attr('stamp'),
          room: muc && this.room.available[node]
        });
      }
      else {
        var message = {user, body, type};
        ui.messageAppend(visual.formatMessage(message));
        if (resource != this.nick.current) ui.notify(message);
      }
    }
    return true;
  },

  /**
   * Handle <message> stanzas of type "error".
   *
   * @param {object} stanza
   * @param {string} node
   * @param {string} domain
   * @param {string} resource
   */
  eventMessageError: function(stanza, node, domain, resource) {
    var error = $('error', stanza);
    if ($('remote-server-not-found', error).length)
      return ui.messageAddInfo(strings.error.dmsg.domain, {domain}, 'error');
    if ($('service-unavailable', error).length)
      return ui.messageAddInfo(strings.error.dmsg.node, {domain, node}, 'error');
    if ($('item-not-found', error).length)
      return ui.messageAddInfo(strings.error.unknownUser, {nick: resource}, 'error');
    if ($('forbidden', error).length)
      return ui.messageAddInfo(strings.error.messageDenied, {text: $('text', error).text()}, 'error');
  },

  /**
   * This function handles any <iq> stanzas.
   */
  eventIQCallback: function(stanza) {
    if (!stanza) return true;
    stanza = $(stanza);
    const from = stanza.attr('from');
    const type = stanza.attr('type');
    const xmlns = stanza.children().attr('xmlns');
    const response = this.iq('result').attrs({
      to: from,
      id: stanza.attr('id')
    });

    if (type == 'get') {
      // List available features (XEP-0030).
      if (xmlns == Strophe.NS.DISCO_INFO) {
        response.c('query', {xmlns})
        response.c('identity', {category: 'client', type: 'web', name: config.clientName}).up();
        for (var i in config.features)
          response.c('feature', {'var': config.features[i]}).up();
        this.connection.send(response);
      }

      // Send <feature-not-implemented/> for anything not recognized.
      else if (config.features.indexOf(xmlns) < 0) {
        this.connection.send(response
          .attrs({type: 'error'})
          .c('error', {type: 'cancel', code: 501})
          .c('feature-not-implemented', {xmlns: Strophe.NS.STANZAS})
        );
      }
    }
    return true;
  },

  /**
   * This function handles any changes in the connection state.
   */
  eventConnectCallback: function(status, errorCondition) {
    var msg = strings.connection[this.statusConstants[status]];
    var status = this.readConnectionStatus(status)
    if (errorCondition) msg += ' (' + errorCondition + ')';
    if (status != this.status)
      ui.messageAddInfo(msg, status == 'offline' ? 'error' : 'verbose');
    this.status = status;
    ui.setStatus(this.status);

    if (status == 'prejoin') {
      this.broadcastPresence();
      var room = this.room.target || ui.getFragment() || config.settings.xmpp.room;
      if (ui.getFragment() || config.settings.xmpp.autoJoin && !ui.urlFragment) {
        this.discoverRooms().then((rooms) => {
          if (rooms[room]) chat.commands.join({name: room});
          else {
            ui.messageAddInfo(strings.error.unknownRoomAuto, {name: room});
            xmpp.prejoin();
          }
        });
      }
      else this.prejoin();
    }
    else if (status == 'offline') {
      // The connection is closed and cannot be reused.
      this.connection = null;
      this.nick.current = null;
      this.room.current = null;
      this.roster = {};
      ui.refreshRooms({});
      ui.updateRoom();
    }
    return true;
  },

  /**
   * Determine the status (online, waiting, offline) of the connection from
   * the code.
   *
   * @param {int} status A Strophe status constant.
   * @return {string} One of "offline", "waiting", or "prejoin".
   */
  readConnectionStatus: function(status) {
    switch (status) {
      case Strophe.Status.ERROR:
      case Strophe.Status.CONNFAIL:
      case Strophe.Status.AUTHFAIL:
      case Strophe.Status.DISCONNECTED:
        return 'offline';
      case Strophe.Status.CONNECTING:
      case Strophe.Status.AUTHENTICATING:
        return 'waiting';
      case Strophe.Status.DISCONNECTING:
        return this.status == 'offline' ? 'offline' : 'waiting';
      case Strophe.Status.CONNECTED:
      case Strophe.Status.ATTACHED:
        return 'prejoin';
    }
  },

  broadcastPresence: function() {
    this.connection.send(this.pres().c('c', {
        xmlns: 'http://jabber.org/protocol/caps',
        hash: 'sha-1',
        node: config.clientURL,
        ver: config.capHash
    }));
  },

  /**
   * Close the connection, first sending an `unavailable` presence.
   */
  disconnect: function() {
    if (this.connection) {
      this.connection.send(this.pres(undefined, {type: 'unavailable'}));
      this.connection.disconnect();
    }
  },

  ping: function(jid, timeout) {
    return new Promise((resolve, reject) => {
      this.connection.ping.ping(jid, resolve, reject, timeout);
    });
  },

  getTime: function(jid, timeout) {
    return this.connection.time.getTime(jid, timeout);
  },

  getVersion: function(jid, timeout) {
    return this.connection.version.getVersion(jid, timeout);
  }
}
