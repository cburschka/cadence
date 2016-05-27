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
  jid: null,
  user: null,
  resource: null,
  show: null,
  roster: {},
  historyEnd: {},

  /**
   * Create the connection object.
   */
  init: function() {
    // Generate a unique resource name for this session.
    this.resource = this.createResourceName();
    this.connection = new Strophe.Connection(config.xmpp.url);
    this.connection.disco.addIdentity('client', 'web', config.clientName);
    config.features.forEach(x => this.connection.disco.addFeature(x));

    // DEBUG: print connection stream to console:
    this.connection.rawInput = data => {
      if (config.settings.debug) console.log('%cRECV ' + data, 'color:blue');
    };
    this.connection.rawOutput = data => {
      if (config.settings.debug) console.log('%cSEND ' + data, 'color:red');
    };
  },

  /**
   * Attach all the event handlers to the connection object.
   */
  setupHandlers: function() {
    this.connection.addHandler(stanza => this.eventPresenceCallback(stanza), null, 'presence');
    this.connection.addHandler(stanza => this.eventMessageCallback(stanza), null, 'message');
    this.connection.addHandler(stanza => this.eventIQCallback(stanza), null, 'iq');
    this.connection.attention.addAttentionHandler(stanza => {
      const from = this.JID.parse(stanza.getAttribute('from'));
      const user = this.userFromJid(from);
      ui.messageError(strings.info.attention, {user});
      return true;
    });
    this.connection.ping.addPingHandler(ping => {
      this.connection.ping.pong(ping);
      return true;
    });
    this.connection.time.addTimeHandler(request => {
      this.connection.time.sendTime(request);
      return true;
    });
    this.connection.version.addVersionHandler(request => {
      this.connection.version.sendVersion(request,
        config.clientName,
        config.version,
        navigator.userAgent
      );
      return true;
    });

    this.connection.addTimedHandler(30, () => this.discoverRooms());
  },

  /**
   * Connect and authenticate.
   *
   * @param {String} user A user on the configured domain.
   * @param {String} pass The password.
   * @param {function} disconnect A callback to run after disconnecting.
   *
   * @return {Promise} A promise that resolves when the connection is
   *         established or has failed.
   */
  connect: function(user, pass, disconnect) {
    return new Promise(resolve => {
      // Make sure the connection isn't already open.
      if (this.connection.connected) throw {status: Strophe.Status.CONNECTED};

      // Attach all the event handlers (they're removed when disconnecting).
      this.setupHandlers();

      // Set the target nickname and JID.
      this.nick.target = user;
      this.jid = new this.JID({
        node: user,
        domain: config.xmpp.domain,
        resource: this.resource
      });

      let first = true;
      this.connection.connect(String(this.jid), pass, (status, error) => {
        // This block resolves the promise; it can only run once.
        if (first) switch (status) {
          case Strophe.Status.ERROR:
          case Strophe.Status.CONNFAIL:
          case Strophe.Status.AUTHFAIL:
            first = false; throw {status, error};
          case Strophe.Status.CONNECTED:
            // Broadcast presence.
            this.connection.send(this.pres());
            first = false; resolve();
        }
        else if (status === Strophe.Status.DISCONNECTED) {
          this.nick.current = null;
          this.room.current = null;
          this.show = null;
          this.roster = {};
          disconnect();
        }
      });
    });
  },

  /**
   * Wrapper for $iq() that fills in the sender JID.
   *
   * @param {Object} attrs: Attributes of <iq>.
   *                  - to: {JID}
   *                  - type: (get, set, result, error)
   *
   * @return {Stanza}
   */
  iq: function(attrs) {
    return $iq({from: this.jid}).attrs(attrs);
  },

  /**
   * Wrapper for $msg() that fills in the sender JID.
   *
   * @param {Object} attrs: Attributes of <message>.
   *                  - to: {JID}
   *                  - type: (chat, error, groupchat, headline, normal)
   *
   * @return {Stanza}
   */
  msg: function(attrs) {
    return $msg({from: this.jid}).attrs(attrs);
  },

  /**
   * Wrapper for $pres() that fills in the sender JID.
   *
   * @param {Object} attrs: Attributes of <presence>.
   *                  - to: {JID}
   *                  - type: (error, unavailable)
   *
   * @return {Stanza}
   */
  pres: function(attrs={}) {
    // Only annotate untyped presence with a cap-hash.
    const pres = attrs.type ? $pres() : this.connection.caps.pres();
    return pres.attrs({from: this.jid}).attrs(attrs);
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
   * Generate a JID from a roomnick.
   *
   * @param {string} room (defaults to current room)
   * @param {string} nick (leave empty for groupchat)
   *
   */
  jidFromRoomNick: function({room, nick}={}) {
    return new this.JID({
      domain: config.xmpp.mucService,
      node: room || this.room.current,
      resource: nick
    });
  },

  JID: class {
    constructor({node, domain, resource}={}) {
      let bareJid = domain || '';
      if (node) bareJid = Strophe.escapeNode(node) + '@' + bareJid;
      const jid = resource ? (bareJid + '/' + resource) : bareJid;

      this.node = node;
      this.domain = domain;
      this.resource = resource;
      this.jid = jid;
      this.bareJid = bareJid;
    }

    bare() {
      return this.bareJid;
    }

    equals(x) {
      return String(this) === String(x);
    }

    matchBare(x) {
      if (!x || !x.bare) x = xmpp.JID.parse(x);
      return this.bare().toLowerCase() == x.bare().toLowerCase();
    }

    toString() {
      return this.jid;
    }

    static parse(jid) {
      if (!jid) return jid;
      jid = String(jid);
      return new xmpp.JID({
        node: Strophe.unescapeNode(Strophe.getNodeFromJid(jid)),
        domain: Strophe.getDomainFromJid(jid),
        resource: Strophe.getResourceFromJid(jid)
      });
    }
  },

  /**
   * Find a user by roomnick or JID.
   *
   * A non-MUC address will be looked up in the roster of the given room.
   *
   * @param {JID} jid
   * @param {String} room
   *
   * @return {User}
   */
  userFromJid: function(jid, room) {
    if (jid.domain == config.xmpp.mucService) {
      const roster = this.roster[jid.node];
      if (roster && roster[jid.resource])
        return roster[jid.resource];
      return {room: jid.node, nick: jid.resource};
    };
    const roster = room && this.roster[room];
    const user = roster && $.map(roster, x => x).find(x => jid.matchBare(x.jid));
    if (user) return user;
    return {jid};
  },

  /**
   * Prompt the user to enter a different nickname.
   */
  nickConflictResolve: function() {
    const nick = prompt(strings.info.promptNickConflict, this.nick.target);
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
      if (!this.connection.connected) return resolve();

      const jid = this.jidFromRoomNick({nick});
      const pres = this.pres({to: jid});
      this.connection.send(pres);

      this.connection.addHandler((stanza) => {
        // The new presence must come from our nickname, or contain a 110 status.
        const from = this.JID.parse(stanza.getAttribute('from'));
        const newNick = from.resource;
        const type = stanza.getAttribute('type');
        if (nick == newNick || $('x status[code="110"]', stanza).length) {
          if (type != 'error') resolve(newNick);
          else reject(stanza);
        }
        else return true;
      }, null, 'presence', null, null, String(jid), {matchBare: true});
    });
  },

  /**
   * Remove room roster and depart from the room.
   *
   * This will set room.current and send a presence if appropriate.
   *
   * @param {String} room The room to leave.
   */
  leaveRoom: function(room) {
    delete this.roster[room];
    if (room) {
      const jid = this.jidFromRoomNick({room, nick: this.nick.current});
      const pres = this.pres({to: jid, type: 'unavailable'});
      this.connection.send(pres);
      if (room == this.room.current) {
        this.room.current = null;
        this.show = null;
      }
    }
  },

  /**
   * Query the server for a reserved nickname in a room, and execute callbacks.
   *
   * @param {string} room The room to get a nickname from.
   *
   * @return {Promise} A promise that resolves to the nickname, or throws the stanza.
   */
  getReservedNick: function(room) {
    return new Promise((resolve, reject) => {
      const iq = this.iq({type: 'get', to: this.jidFromRoomNick({room})});
      iq.c('query', {xmlns: Strophe.NS.DISCO_INFO, node: 'x-roomuser-item'});
      this.connection.sendIQ(iq, (stanza) => {
        const query = $('query', stanza);
        const nick = $('identity', query).attr('name');
        if (query.attr('node') == 'x-roomuser-item' && nick) resolve(nick);
        else reject(stanza);
      }, reject, config.xmpp.timeout);
    });
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
   * In the case of an error, the promise will reject with the stanza.
   */
  getRoomInfo: function(room) {
    return new Promise((resolve, reject) => {
      const iq = this.iq({type: 'get', to: this.jidFromRoomNick({room})});
      iq.c('query', {xmlns: Strophe.NS.DISCO_INFO});
      this.connection.sendIQ(iq,
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
        reject, config.xmpp.timeout
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

      const jid = this.jidFromRoomNick({room, nick: this.nick.target});
      const pres = this.pres({to: jid});
      pres.c('x', {xmlns:Strophe.NS.MUC})
      pres.c('history', {since: this.historyEnd[room] || '1970-01-01T00:00:00Z'});

      if (password) pres.up().c('password', password);
      this.connection.send(pres);

      // The server may alter the nickname, requiring a bare match:
      this.connection.addHandler((stanza) => {
        if ($(stanza).attr('type') == 'error') reject(stanza);
        else if ($('status[code=110]', stanza).length) {
          resolve(stanza);
        }
        else return true;
      }, null, 'presence', null, null, String(jid), {matchBare: true});
    });
  },

  /**
   * Send a mediated invitation.
   * @param jid this may be an occupant in a different room
   * @param text an optional text message
   */
  invite: function(jid, text) {
    this.connection.send($msg({
      from: this.jid,
      to: this.jidFromRoomNick()
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
    const iq = this.iq({type: 'get', to: this.jidFromRoomNick({room})});
    iq.c('query', {xmlns: Strophe.NS.MUC + '#owner'});

    return new Promise((resolve, reject) =>
      this.connection.sendIQ(iq, resolve, reject, config.xmpp.timeout)
    );
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
    const form = xmpp.iq({type: 'set', to: this.jidFromRoomNick({room})});
    form.c('query', {xmlns: Strophe.NS.MUC + '#owner'});
    form.c('x', {xmlns: 'jabber:x:data', type: 'submit'});

    $.each(data, (name, values) => {
      if (values !== undefined) {
        form.c('field', {'var': name});
        if (!values || values.constructor != Array) values = [values];
        values.forEach(value => form.c('value', {}, String(value)));
        form.up();
      }
    });

    return new Promise((resolve, reject) =>
      this.connection.sendIQ(form, resolve, reject, config.xmpp.timeout)
    );
  },

  /**
   * Cancel a room configuration.
   * This is important when creating a room, because the server
   * must destroy the room if the initial configuration is canceled.
   * (Subsequent configuration requests are usually stateless.)
   *
   * @param {string} room The room.
   *
   * @return {Promise}
   */
   roomConfigCancel: function(room) {
     const iq = this.iq({type: 'set', to: this.jidFromRoomNick({room})});
     iq.c('query', {xmlns: Strophe.NS.MUC + '#owner'});
     iq.c('x', {xmlns: 'jabber:x:data', type: 'cancel'});

     return new Promise((resolve, reject) =>
       this.connection.sendIQ(iq, resolve, reject, config.xmpp.timeout)
     );
   },

  /**
   * Order the server to destroy a room.
   *
   * @param {string} room The room ID.
   * @param {string} alternate An alternate room ID (optional).
   * @param {string} reason The reason (optional).
   *
   * @return {Promise} A promise that resolves to the response.
   */
  destroyRoom: function(room, alternate, reason) {
    const iq = this.iq({type: 'set', to: this.jidFromRoomNick({room})});
    iq.c('query', {xmlns: Strophe.NS.MUC + '#owner'});
    iq.c('destroy');

    if (alternate) iq.attrs({jid: this.jidFromRoomNick({room: alternate})});
    if (message) iq.c('reason', reason);

    return new Promise((resolve, reject) =>
      this.connection.sendIQ(iq, resolve, reject, config.xmpp.timeout)
    );
  },

  /**
   * Request a service administration command form.
   *
   * @param {string} node The command node name.
   *
   * @return {Promise} A promise that will resolve to the response stanza.
   */
  command: function(node) {
    const iq = this.iq({type: 'set', to: config.xmpp.domain});
    iq.c('command', {
      xmlns: 'http://jabber.org/protocol/commands',
      action: 'execute',
      node: 'http://jabber.org/protocol/admin#' + node
    });

    return new Promise((resolve, reject) =>
      this.connection.sendIQ(iq, resolve, reject, config.xmpp.timeout)
    );
  },

  /**
   * Submit a service administration command form.
   *
   * @param {string} node The command node name.
   * @param {string} sessionid The session ID of the form.
   * @param {Object} data The form data to send.
   *
   * @return {Promise} A promise that resolves to the response.
   */
  commandSubmit: function(node, sessionid, data) {
    const form = this.iq({type: 'set', to: config.xmpp.domain});
    form.c('command', {
      xmlns: 'http://jabber.org/protocol/commands',
      node: 'http://jabber.org/protocol/admin#' + node,
      sessionid
    });
    form.c('x', {xmlns: 'jabber:x:data', type: 'submit'});

    $.each(data, (name, values) => {
      if (values !== undefined) {
        form.c('field', {'var': name});
        if (!values || values.constructor != Array) values = [values];
        values.each(value => form.c('value', {}, String(value)));
        form.up();
      }
    });

    return new Promise((resolve, reject) =>
      xmpp.connection.sendIQ(form, resolve, reject, config.xmpp.timeout)
    );
  },

  /**
   * Create and send a presence stanza to the current room, with optional
   * <show/> and <status/> elements.
   * Note: To return from away-mode, a presence without <show/> is sent.
   *
   * @param {String} show This must be one of "away", "chat", "dnd", "xa" or null.
   * @param {String} status This is an arbitrary status message.
   */
  sendStatus: function({show, status}) {
    const pres = this.pres({to: this.jidFromRoomNick({nick: this.nick.current})});
    if (show) pres.c('show', {}, show);
    if (status) pres.c('status', {}, status);
    this.show = show;
    this.connection.send(pres);
  },

  /**
   * Send a message to the room.
   *
   * @param {Object} message:
   *                   - {JID} to
   *                   - {Object} body
   *                     - {String} text
   *                     - {DOM} html (optional)
   *                   - {String} type (optional: normal, chat, error, groupchat, headline)
   */
  sendMessage: function({to, body, type}) {
    const msg = this.msg({to, type});
    msg.c('body', {}, body.text);
    msg.c('html', {xmlns: Strophe.NS.XHTML_IM})
    msg.c('body', {xmlns: Strophe.NS.XHTML});
    if (body.html) msg.cnode($('<p>').append(body.html)[0]);

    this.connection.send(msg);
    ui.playSound('send');
  },

  /**
   * Set a user's role (by roomnick) or affiliation (by jid).
   *
   * @param {Object} item Either nick/role or jid/affiliation.
   *
   * @return {Promise} A promise that resolves to the server response.
   */
  setUser: function(item) {
    const iq = this.iq({type: 'set', to: this.jidFromRoomNick()});
    iq.c('query', {xmlns: Strophe.NS.MUC + '#admin'});
    iq.c('item', item);

    return new Promise((resolve, reject) =>
      this.connection.sendIQ(iq, resolve, reject, config.xmpp.timeout)
    );
  },

  setRoom: function(room) {
    if (room == this.room.current) return;
    const oldRoom = this.room.current;
    if (oldRoom) xmpp.leaveRoom(oldRoom);

    this.room.current = room;
  },

  /**
   * Get user list (by affiliation or role).
   *
   * @param {Object} query Either {affiliation} or {role}.
   *
   * @return {Promise} A promise that resolves to the response.
   */
  getUsers: function(query) {
    const iq = this.iq({type: 'get', to: this.jidFromRoomNick()});
    iq.c('query', {xmlns: Strophe.NS.MUC + '#admin'});
    iq.c('item', query);

    return new Promise((resolve, reject) =>
      this.connection.sendIQ(iq, resolve, reject, config.xmpp.timeout)
    );
  },

  /**
   * Query a room for its occupant list.
   *
   * @param {string} room
   *
   * @return {Promise} A promise that resolves to a user list.
   */
  getOccupants: function(room) {
    const iq = this.iq({type: 'get', to: this.jidFromRoomNick({room})});
    iq.c('query', {xmlns: Strophe.NS.DISCO_ITEMS});

    return new Promise((resolve, reject) => {
      const success = stanza => resolve($.makeArray(
        $('item', stanza).map((_, e) => e.getAttribute('name'))
      ));
      this.connection.sendIQ(iq, success, reject, config.xmpp.timeout);
    });
  },


  /**
   * Query the server for rooms.
   *
   * @return {Promise} A promise that resolves to the list of rooms.
   */
  discoverRooms: function() {
    const iq = this.iq({type: 'get', to: config.xmpp.mucService});
    iq.c('query', {xmlns: Strophe.NS.DISCO_ITEMS});

    return new Promise((resolve, reject) => {
      const success = stanza => {
        const rooms = {};
        $('item', stanza).each((_, item) => {
          const jid = this.JID.parse(item.getAttribute('jid'));
          const id = jid.node;

          // Strip off the parenthesized number of participants in the name:
          const name = item.getAttribute('name');
          const title = name ? name.replace(/\((\d+)\)$/, '').trim() : id;

          rooms[id] = {id, title, members: null, jid};
        });

        // Preserve the current room in the list of available rooms.
        // (This is because it might not be publicly listed.)
        const current = this.room.current;
        if (current && !rooms[current]) rooms[current] = this.room.available[current];
        this.room.available = rooms;

        ui.refreshRooms(rooms);
        resolve(rooms);
      };

      this.connection.sendIQ(iq, success, reject, config.xmpp.timeout);
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
    const from = this.JID.parse(stanza.getAttribute('from'));
    // Discard any <presence/> that is not from the MUC domain.
    // (This client does not support direct non-MUC communication.)
    if (from.domain != config.xmpp.mucService) return true;

    // Find the room and nickname that the presence came from, and the type.
    const room = from.node;
    const nick = from.resource;
    const type = stanza.getAttribute('type');

    // Initialize the room roster if it doesn't exist yet.
    if (!this.roster[room]) this.roster[room] = {};

    if (type == 'error')
      return this.eventPresenceError(room, nick, stanza) || true;

    // Find the status codes.
    const item = $(stanza).find('item');
    const codes = $.makeArray($('status', stanza).map(function() {
      return parseInt(this.getAttribute('code'));
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
        ui.messageError(strings.error.nickConflict, {nick});
        return this.nick.target = this.nick.current;
      }
      else {
        ui.messageError(strings.error.joinConflict, {nick});
        if (this.nickConflictResolve()) {
          ui.messageInfo(strings.info.rejoinNick, {nick: this.nick.target});
          return this.joinRoom(this.room.target, this.nick.target);
        }
      }
    }
    else if ($('not-authorized', stanza).length) {
      const password = prompt(strings.info.promptRoomPassword);
      if (password) return this.joinExistingRoom(room, password);
      else ui.messageError(strings.error.joinPassword, {room: this.room.available[room]});
    }
    else if ($('forbidden', stanza).length)
      ui.messageError(strings.error.joinBanned, {room: this.room.available[room]});
    else if ($('not-allowed', stanza).length)
      ui.messageError(strings.error.noCreate);
    else if ($('jid-malformed', stanza).length) {
      ui.messageError(strings.error.badNick, {nick});
      this.nick.target = this.nick.current;
    }
  },

  /**
   * Handle presence stanzas of type `unavailable`.
   */
  eventPresenceUnavailable: function(roomId, nick, codes, item, stanza) {
    const roster = this.roster[roomId];
    const user = roster[nick];
    const room = this.room.available[roomId];

    // Delete the old roster entry.
    delete roster[nick];

    // Ignore things that happen outside the current room or to missing users.
    if (roomId != this.room.current || !user) return;

    // An `unavailable` 303 is a nick change to <item nick="{new}"/>
    if (codes.includes(303)) {
      const newNick = item.attr('nick');
      const newUser = $.extend({}, user, {nick: newNick});
      ui.messageInfo(strings.info.userNick, {from: user, to: newUser});

      // Update the roster entry.
      roster[newNick] = newUser;
      ui.rosterInsert(newUser, {nick: user.nick});

      // ejabberd bug: presence does not use 110 code; check nick.
      if (nick == xmpp.nick.current) xmpp.nick.current = newNick;
      ui.playSound('info');
    }
    else {
      // An `unavailable` 301 is a ban; a 307 is a kick.
      if (codes.includes(301) || codes.includes(307)) {
        const type = codes.includes(301) ? 'ban' : 'kick';
        const actorNick = $('actor', item).attr('nick');
        // For a self-kick, the actor is already out of the roster.
        const actor = actorNick == nick ? user : roster[nick];
        const reason = $('reason', item).text();
        const index = (+!!actor) * 2 + (+!!reason);

        // ejabberd bug: presence does not use 110 code; check nick.
        if (nick == xmpp.nick.current)
          ui.messageError(strings.info.evicted[type].me[index], {actor, reason, room});
        else
          ui.messageInfo(strings.info.evicted[type].other[index], {actor, reason, room, user});
        ui.playSound('leave');
      }

      // A <destroy> element indicates that the room has been destroyed.
      else if ($('x destroy', stanza).length) {
        const destroy = $('x destroy', stanza);
        const reason = $('reason', destroy).text();
        const jid = this.JID.parse(destroy.attr('jid'));
        const alternate = jid.domain == config.xmpp.mucService
                    && (this.room.available[jid.node] || {id: jid.node});

        ui.messageError(strings.info.destroyed[+!!alternate][+!!reason], {room, alternate, reason});
      }
      // Any other `unavailable` presence indicates a logout.
      else {
        ui.messageInfo(strings.info.userOut, {user});
        ui.playSound('leave');
      }

      // If this is our nickname, we're out of the room.
      if (nick == xmpp.nick.current) {
        this.leaveRoom(roomId);
        ui.updateRoom();
      }
      ui.rosterRemove(user.nick);
    }
  },

  /**
   * Handle presence stanzas without a type.
   */
  eventPresenceDefault: function(room, nick, codes, item, stanza) {
    const roster = this.roster[room];
    const oldUser = roster[nick];

    // Create the user object.
    const user = {
      nick,
      jid: this.JID.parse(item.attr('jid')), // if not anonymous.
      role: item.attr('role'),
      affiliation: item.attr('affiliation'),
      // away, dnd, xa, chat, [default].
      show: $('show', stanza).text() || 'available',
      status: $('status', stanza).text() || ''
    };

    // A 110-code presence reflects a presence that we sent.
    if (codes.includes(110)) this.nick.current = nick;

    // We have fully joined this room - track the presence changes.
    if (this.room.current == room) {
      // Workaround for ejabberd bug @processone/ejabberd/issues/136:
      // Detect nick change when neither 110 nor 303 code are sent.
      // This only happens when the old nick remains logged in - copy the item.
      if (this.nick.current != this.nick.target && nick == this.nick.target) {
        ui.messageInfo(strings.info.userNick, {
          from: roster[this.nick.current],
          to: user
        });
        this.nick.current = nick;
      }

      if (oldUser) {
        let sound = false;
        if (oldUser.show != user.show || oldUser.status != user.status) {
          const msg = strings.show[user.show] || strings.showOther;
          sound = true;
          ui.messageInfo(msg[+!!user.status], {user, show: user.show, status: user.status});
        }
        if (oldUser.affiliation != user.affiliation) {
          sound = true;
          ui.messageInfo(strings.info.userAffiliation, {user, affiliation: user.affiliation});
        }
        if (oldUser.role != user.role) {
          sound = true;
          ui.messageInfo(strings.info.userRole, {user, role: user.role});
        }
        if (sound) ui.playSound('info');
      }
      else if (this.nick.current != nick) {
        ui.messageInfo(strings.info.userIn, {user});
        // Play the alert sound if a watched user enters.
        const watched = config.settings.notifications.triggers.some(
          trigger => nick.includes(trigger)
        );
        watched ? ui.playSound('mention') : ui.playSound('enter');
      }
      ui.rosterInsert(user);
    }

    roster[nick] = user;
  },

  /**
   * This function handles any <message> stanzas received.
   */
  eventMessageCallback: function(stanza) {
    if (stanza) {
      const from = this.JID.parse(stanza.getAttribute('from'));
      let type = stanza.getAttribute('type');

      if (type == 'error')
        return this.eventMessageError(stanza, from) || true;

      let user = this.userFromJid(from);
      const muc = !!user.room || !!user.nick;

      let body = $('html body p', stanza).contents();
      if (!body.length) body = $(stanza).children('body').contents();

      const delay = $('delay', stanza);
      const time = delay.attr('stamp') || (new Date()).toISOString();

      // Message of the Day.
      if (!from.node && !from.resource)
        return ui.messageError(strings.info.motd, {domain: from.domain, text: body});

      if (muc) {
        const codes = $.makeArray($('x status', stanza).map(function() {
          return parseInt($(this).attr('code'));
        }));

        // React to configuration updates.
        if (codes.includes(104)) {
          this.getRoomInfo(from.node).then((room) => {
            this.room.available[from.node] = room;
            ui.refreshRooms(this.room.available);
            ui.messageInfo(strings.code[104], {room});
          });
        }

        // Accept invitations.
        const invite = $('x invite', stanza);
        if (invite.length) {
          const room = xmpp.room.available[from.node];
          if (!room) xmpp.getRoomInfo(from.node).then((data) => {
            room = data;
            xmpp.room.available[node] = data;
          });
          const reason = $('reason', invite).text();
          const password = $('x password', stanza).text();
          return ui.messageInfo(strings.info.inviteReceived[+!!password][+!!reason], {
            jid: this.JID.parse(invite.attr('from')),
            room, password, reason
          });
        }

        if (!from.resource) return true;

        // Do not look up the nick for delayed messages, because it's unreliable.
        if (delay.length) {
          // In non-anonymous rooms, try to identify the author by JID.
          const jid = this.JID.parse(delay.attr('from'));
          if (!jid.matchBare(from)) {
            // Copy the entry and fill in the old nickname.
            user = $.extend({}, this.userFromJid(jid, from.node));
            user.nick = from.resource;
          }
          // Otherwise, do not use the roster entry.
          else user = {nick: from.resource};
        }

        this.historyEnd[from.node] = time;
      }

      // Accept direct messages from other domains.
      else type = 'direct';

      // Accept direct invitations:
      const invite = $('x[xmlns="' + Strophe.NS.CONFERENCE + '"]', stanza);
      if (invite.length) {
        const room = xmpp.userFromJid(this.JID.parse(invite.attr('jid'))).room;
        const password = invite.attr('password');
        const reason = invite.attr('reason');
        if (room) return ui.messageInfo(
          strings.info.inviteReceived[+!!password][+!!reason],
          {jid: from, room, password, reason}
        );
      }

      // If there is no <body> element, drop the message. (@TODO #201 XEP-0085)
      if (!$(stanza).children('body').length) return true;

      if (delay.length) {
        ui.messageDelayed({
          user, body, type, time,
          room: muc && this.room.available[from.node]
        });
      }
      else {
        const message = {user, body, type};
        ui.messageAppend(visual.formatMessage(message));
        if (from.resource != this.nick.current) ui.notify(message);
      }
    }
    return true;
  },

  /**
   * Handle <message> stanzas of type "error".
   *
   * @param {Object} stanza
   * @param {JID} from
   */
  eventMessageError: function(stanza, from) {
    const error = $('error', stanza);
    const {node, domain, resource} = from;
    if ($('remote-server-not-found', error).length)
      return ui.messageError(strings.error.dmsg.domain, {domain});
    if ($('service-unavailable', error).length)
      return ui.messageError(strings.error.dmsg.node, {domain, node});
    if ($('item-not-found', error).length)
      return ui.messageError(strings.error.unknownUser, {nick: resource});
    if ($('forbidden', error).length)
      return ui.messageError(strings.error.messageDenied, {text: $('text', error).text()});
  },

  /**
   * This function handles any unsupported <iq> namespaces.
   */
  eventIQCallback: function(stanza) {
    if (!stanza) return true;

    // Only respond to get/set, as per RFC-6120 8.2.3
    const type = stanza.getAttribute('type');
    if (type != 'get' && type != 'set') return true;

    const xmlns = $(stanza).children().attr('xmlns');

    // Send <feature-not-implemented /> for anything not recognized.
    if (!config.features.includes(xmlns)) {
      const response = this.iq({
        type: 'error',
        to: stanza.getAttribute('from'),
        id: stanza.getAttribute('id')
      });
      response.c('error', {type: 'cancel', code: 501});
      response.c('feature-not-implemented', {xmlns: Strophe.NS.STANZAS}, '');

      this.connection.sendIQ(response);
    }

    return true;
  },

  ping: function(jid) {
    return this.connection.ping.ping(jid, config.xmpp.timeout);
  },

  getTime: function(jid) {
    return this.connection.time.getTime(jid, config.xmpp.timeout);
  },

  getVersion: function(jid) {
    return this.connection.version.getVersion(jid, config.xmpp.timeout);
  },

  attention: function(jid) {
    const msg = this.connection.attention.attention(jid);
    return this.connection.send(msg);
  },

  /**
   * Load settings from XML storage.
   *
   * This will load settings stored under <cadence xmlns="cadence:settings">.
   */
  loadSettings: function() {
    const name = config.clientName;
    const query = this.connection.storage.get(name, name + ':settings', config.xmpp.timeout);
    const decodeValue = node => {
      node = $(node);
      switch (node.attr('type')) {
        case 'object': return decodeObject(node);
        case 'array': return decodeArray(node);
        case 'number': return parseFloat(node.text());
        case 'boolean': return node.text() === 'true';
        case 'undefined': return undefined;
        case 'null': return null;
        default: return node.text();
      }
    };
    const decodeArray = node => $.map(node.children(), decodeValue);
    const decodeObject = node => {
      const obj = {};
      node.children().each(function() {
        obj[$(this).attr('name')] = decodeValue(this);
      });
      return obj;
    };
    return query.then((stanza) => {
      return decodeValue($('query > ' + name + ' > data', stanza));
    });
  },

  /**
   * Store settings in XML storage.
   *
   * This will store settings in <cadence xmlns="cadence:settings">.
   */
  storeSettings: function(data, modified) {
    const name = config.clientName;
    const query = this.connection.storage.set(name, name + ':settings');
    query.attrs({modified});
    const encodeValue = (val, name) => {
      query.c('data', {name});
      if (typeof val !== 'object') {
        query.attrs({type: typeof val});
        if (val !== undefined) query.t(String(val));
      }
      else if (val.constructor === Array) {
        query.attrs({type: 'array'});
        encodeArray(val);
      }
      else if (val === null) query.attrs({type: 'null'});
      else {
        query.attrs({type: 'object'});
        encodeObject(val);
      }
      query.up();
    }
    const encodeArray = arr => { for (let val of arr) encodeValue(val) };
    const encodeObject = obj => { for (let key in obj) encodeValue(obj[key], key) };

    encodeValue(data);
    return query.send(config.xmpp.timeout);
  }
};
