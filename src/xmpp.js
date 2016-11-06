/**
 * xmpp.js contains all the functions that communicate with the XMPP server.
 */
const xmpp = {
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
  resource: null,
  show: null,
  roster: {},
  historyEnd: {},
  subject: {},
  statusConstants: [],

  /**
   * Defined error conditions in stanzas.
   */
  stanzaErrors: [
    'bad-request',
    'conflict',
    'feature-not-implemented',
    'forbidden',
    'gone',
    'internal-server-error',
    'item-not-found',
    'jid-malformed',
    'not-acceptable',
    'not-allowed',
    'not-authorized',
    'policy-violation',
    'recipient-unavailable',
    'redirect',
    'registration-required',
    'remote-server-not-found',
    'remote-server-timeout',
    'resource-constraint',
    'service-unavailable',
    'subscription-required',
    'undefined-condition',
    'unexpected-request',
  ],

  features: [
    Strophe.NS.ATTENTION,
    Strophe.NS.CONFERENCE,
    Strophe.NS.DISCO_INFO,
    Strophe.NS.MUC,
    Strophe.NS.MUC + '#user',
    Strophe.NS.PING,
    Strophe.NS.TIME,
    Strophe.NS.XHTML_IM,
    Strophe.NS.VERSION,
  ],

  ConnectionError: class {
    constructor(status, error) {
      this.status = status;
      this.error = error;
    }

    toString() {
      return `Connection error: ${xmpp.statusConstants[this.status]}: ${this.error}`;
    }
  },

  StanzaError: class {
    constructor(stanza) {
      if (!stanza) return this.condition = 'timeout';
      this.stanza = stanza;
      const error = stanza.querySelector('error');
      this.type = error.getAttribute('type');
      this.condition = xmpp.stanzaErrors.find(x => error.querySelector(x));
      const text = error.querySelector('text');
      this.text = text && text.textContent;
    }

    toString() {
      return `Stanza error: ${this.condition} (${this.text})`;
    }
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
      if (!(x instanceof xmpp.JID)) x = xmpp.JID.parse(x);
      return x && this.bare().toLowerCase() == x.bare().toLowerCase();
    }

    toString() {
      return this.jid;
    }

    userString() {
      if (!this.node) return this.domain;
      return `${this.node}@${this.domain}`;
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
   * Create the connection object.
   */
  init() {
    // Generate a unique resource name for this session.
    this.resource = this.createResourceName();

    // Invert Strophe's status constant table.
    Object.forEach(Strophe.Status, (name, value) => {
      this.statusConstants[value] = name;
    });

    this.connection = new Strophe.Connection(config.xmpp.url);
    this.connection.disco.addIdentity('client', 'web', config.clientName);
    this.features.forEach(x => this.connection.disco.addFeature(x));

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
  setupHandlers() {
    this.connection.addHandler(stanza => this.eventPresenceCallback(stanza), null, 'presence');
    this.connection.addHandler(stanza => this.eventMessageCallback(stanza), null, 'message');
    this.connection.addHandler(stanza => this.eventIQCallback(stanza), null, 'iq');
    this.connection.attention.addHandler(stanza => {
      const from = this.JID.parse(stanza.getAttribute('from'));
      const user = this.userFromJid(from);
      ui.messageError(strings.info.attention, {user});
      return true;
    });
    this.connection.ping.addHandler();
    this.connection.time.addHandler();
    this.connection.version.addHandler(this.connection.version.responder(
      config.clientName,
      config.version,
      // Sending the user agent (in <os>) is optional.
      (config.settings.xmpp.sendUserAgent !== false) && navigator.userAgent
    ));

    this.connection.addTimedHandler(30, () => this.discoverRooms());
  },

  /**
   * Connect and authenticate.
   *
   * @param {String} user A user on the configured domain.
   * @param {String} pass The password.
   * @param {function} handler A callback to run on connection events.
   *
   * @return {Promise} A promise that resolves when the connection is
   *         established or has failed.
   */
  connect(user, pass, handler) {
    // Make sure the connection isn't already open.
    if (this.connection.authenticated) {
      throw new this.ConnectionError(Strophe.Status.CONNECTED);
    }

    // Attach all the event handlers (they're removed when disconnecting).
    this.setupHandlers();

    // Apply custom nickname, but only if it was set on the same account.
    const nick = (user == config.settings.xmpp.user) && config.settings.xmpp.nick || user;
    this.nick.target = nick;

    this.jid = new this.JID({
      node: user,
      domain: config.xmpp.domain,
      resource: user && this.resource
    });

    let first = true;
    return new Promise((resolve, reject) => {
      return this.connection.connect(String(this.jid), pass, (status, error) => {
        // This block resolves the promise; it can only run once.
        if (first) switch (status) {
          case Strophe.Status.ERROR:
          case Strophe.Status.CONNFAIL:
          case Strophe.Status.AUTHFAIL:
            first = false; return reject(new this.ConnectionError(status, error));
          case Strophe.Status.CONNECTED:
            // Broadcast presence.
            this.pres().send();
            first = false; return resolve();
        }
        else if (status === Strophe.Status.DISCONNECTED) {
          this.nick.current = null;
          this.room.current = null;
          this.show = null;
          this.roster = {};
        }
        handler(status, error);
      })
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
  iq(attrs) {
    const iq = $iq({from: this.jid}).attrs(attrs);
    iq.send = () => new Promise((resolve, reject) => {
      this.connection.sendIQ(iq, resolve, reject, config.xmpp.timeout);
    }).catch(stanza => {
      throw new this.StanzaError(stanza);
    });
    return iq;
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
  msg(attrs) {
    const msg = $msg({from: this.jid}).attrs(attrs);
    msg.send = () => this.connection.send(msg);
    return msg;
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
  pres(attrs) {
    const pres = $pres({from: this.jid}).attrs(attrs);
    // Only annotate untyped presence with a cap-hash.
    if (!attrs || !attrs.type) this.connection.caps.caps(pres);
    pres.send = () => this.connection.send(pres);
    return pres;
  },

  /**
   * Create a unique client identifier from the current millisecond timestamp.
   */
  createResourceName() {
    const {clientName} = config;
    const time = (new Date()).getTime().toString(36);
    return `${clientName}/${time}`;
  },

  /**
   * Return a room info object, if it exists.
   *
   * @param {string} id (optional)
   *
   * @return The requested or the current room, or undefined.
   */
  getRoom(room) {
    return this.room.available[room || this.room.current];
  },

  /**
   * Return a roster, if it exists.
   *
   * @param {string} room (optional)
   *
   * @return The requested or the current roster, or undefined.
   */
  getRoster(room) {
    return this.roster[room || this.room.current];
  },

  /**
   * Return a roster entry, if it exists.
   *
   * @param {string} nick
   * @param {string} room (optional)
   */
  getOccupant(nick, room) {
    const roster = this.getRoster(room);
    return roster && roster[nick || this.nick.current];
  },

  /**
   * Generate a JID from a roomnick.
   *
   * @param {string} room (defaults to current room)
   * @param {string} nick (leave empty for groupchat)
   *
   */
  jidFromRoomNick({room, nick}={}) {
    return new this.JID({
      domain: config.xmpp.muc,
      node: room || this.room.current,
      resource: nick
    });
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
  userFromJid(jid, room) {
    if (jid.domain == config.xmpp.muc) {
      const roster = this.roster[jid.node];
      if (roster && roster[jid.resource])
        return roster[jid.resource];
      return {room: jid.node, nick: jid.resource};
    };
    const roster = room && this.roster[room];
    const user = roster && Object.values(roster).find(x => jid.matchBare(x.jid));
    if (user) return user;
    return {jid};
  },

  /**
   * Prompt the user to enter a different nickname.
   */
  nickConflictResolve() {
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
  changeNick(nick) {
    return new Promise(resolve => {
      this.nick.target = nick;

      const jid = this.jidFromRoomNick({nick});
      this.pres({to: jid}).send();

      this.connection.addHandler(stanza => {
        // The new presence must come from our nickname, or contain a 110 status.
        const from = this.JID.parse(stanza.getAttribute('from'));
        const newNick = from.resource;
        const type = stanza.getAttribute('type');
        if (nick == newNick || stanza.querySelector('x status[code="110"]')) {
          if (type != 'error') resolve(newNick);
          else throw new this.StanzaError(stanza);
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
  leaveRoom(room) {
    delete this.roster[room];
    if (room) {
      const jid = this.jidFromRoomNick({room, nick: this.nick.current});
      this.pres({to: jid, type: 'unavailable'}).send();
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
  getReservedNick(room) {
    const iq = this.iq({type: 'get', to: this.jidFromRoomNick({room})})
      .c('query', {xmlns: Strophe.NS.DISCO_INFO, node: 'x-roomuser-item'});

    return iq.send().then(stanza => {
      const query = stanza.querySelector('query');
      const nick = query.querySelector('identity').getAttribute('name');
      if (query.getAttribute('node') == 'x-roomuser-item' && nick) return nick;
      // This is *not* an error stanza, the server is just being dumb.
      else throw stanza;
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
  queryRoom(room) {
    const iq = this.iq({type: 'get', to: this.jidFromRoomNick({room})})
      .c('query', {xmlns: Strophe.NS.DISCO_INFO});

    return iq.send().then(stanza => {
      const query = stanza.querySelector('query');
      const features = Array.from(query.querySelectorAll('query > feature')).map(
        e => e.getAttribute('var')
      );
      const data = Object.fromEntries(Array.from(query.querySelectorAll('x > field')).map(
        e => [e.getAttribute('var'), e.querySelector('value').textContent]
      ));
      return this.room.available[room] = {
        id: room,
        title: query.querySelector('identity').getAttribute('name'),
        members: +data['muc#roominfo_occupants'],
        features, data
      };
    });
  },

  /**
   * Join a room, regardless of whether it exists.
   *
   * Returns a promise that will resolve or reject on the returned room presence.
   *
   * @param {string} The room name.
   */
  joinRoom({room, nick, password}) {
    this.room.target = room;
    if (nick) this.nick.target = nick;

    const jid = this.jidFromRoomNick({room, nick: this.nick.target});
    const pres = this.pres({to: jid})
      .c('x', {xmlns: Strophe.NS.MUC})
      .c('history', {since: (this.historyEnd[room] || new Date(0)).toISOString()});
    if (password) pres.up().c('password', password);
    pres.send();

    return new Promise(resolve => {
      // The server may alter the nickname, requiring a bare match:
      this.connection.addHandler(stanza => {
        if (stanza.getAttribute('type') == 'error') {
          throw new this.StanzaError(stanza);
        }
        else if (stanza.querySelector('status[code="110"]')) {
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
  invite(jid, text) {
    return this.msg({to: this.jidFromRoomNick()})
      .c('x', {xmlns: Strophe.NS.MUC + '#user'})
      .c('invite', {to: jid})
      .c('reason', text)
      .send();
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
  roomConfig(room) {
    return this.iq({type: 'get', to: this.jidFromRoomNick({room})})
      .c('query', {xmlns: Strophe.NS.MUC + '#owner'})
      .send();
  },

  /**
   * Send a room configuration form to the server.
   *
   * @param {string} room The room name.
   * @param {Object} data A dictionary of form fields to send.
   *
   * @return {Promise} A promise that resolves when the form is acknowledged.
   */
  roomConfigSubmit(room, data) {
    const form = xmpp.iq({type: 'set', to: this.jidFromRoomNick({room})});
    form.c('query', {xmlns: Strophe.NS.MUC + '#owner'});
    form.c('x', {xmlns: 'jabber:x:data', type: 'submit'});

    Object.forEach(data, (name, values) => {
      if (values !== undefined) {
        form.c('field', {'var': name});
        if (!(values instanceof Array)) values = [values];
        values.forEach(value => form.c('value', {}, String(value)));
        form.up();
      }
    });

    return form.send();
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
   roomConfigCancel(room) {
     return this.iq({type: 'set', to: this.jidFromRoomNick({room})})
       .c('query', {xmlns: Strophe.NS.MUC + '#owner'})
       .c('x', {xmlns: 'jabber:x:data', type: 'cancel'})
       .send();
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
  destroyRoom(room, alternate, reason) {
    const iq = this.iq({type: 'set', to: this.jidFromRoomNick({room})})
      .c('query', {xmlns: Strophe.NS.MUC + '#owner'})
      .c('destroy');

    if (alternate) iq.attrs({jid: this.jidFromRoomNick({room: alternate})});
    if (reason) iq.c('reason', reason);

    return iq.send();
  },

  /**
   * Request a service administration command form.
   *
   * @param {string} node The command node name.
   *
   * @return {Promise} A promise that will resolve to the response stanza.
   */
  command(to, node) {
    return this.iq({to, type: 'set'}).c('command', {
      node,
      xmlns: 'http://jabber.org/protocol/commands',
      action: 'execute',
    }).send();
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
  commandSubmit(to, node, sessionid, data) {
    const form = this.iq({to, type: 'set'});
    form.c('command', {
      node,
      sessionid,
      xmlns: 'http://jabber.org/protocol/commands',
    });
    form.c('x', {xmlns: 'jabber:x:data', type: 'submit'});

    Object.forEach(data, (name, values) => {
      if (values !== undefined) {
        form.c('field', {'var': name});
        if (!values || !(values instanceof Array)) values = [values];
        values.forEach(value => form.c('value', {}, String(value)));
        form.up();
      }
    });

    return form.send();
  },

  listCommands(to) {
    const iq = this.iq({to, type: 'get'});
    iq.c('query', {
      xmlns: Strophe.NS.DISCO_ITEMS,
      node: 'http://jabber.org/protocol/commands'
    });
    return iq.send().then(stanza =>
      Array.from(stanza.querySelectorAll('item'))
      .map(
        item => ({
          jid: item.getAttribute('jid'),
          name: item.getAttribute('name'),
          node: item.getAttribute('node'),
        })
      )
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
  sendStatus({show, status}) {
    const pres = this.pres({to: this.jidFromRoomNick({nick: this.nick.current})});
    if (show !== 'available') pres.c('show', {}, show);
    if (status) pres.c('status', {}, status);
    this.show = show || 'available';
    return pres.send();
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
  sendMessage({to, body, type, meta}) {
    const msg = this.msg({to, type});
    const {text, html} = body;
    msg.c('body', {}, text);
    if (html) {
      msg.c('html', {xmlns: Strophe.NS.XHTML_IM})
      msg.c('body', {xmlns: Strophe.NS.XHTML});
      const array = Array.from(html);
      const nodes = array.length ? array : [html];
      nodes.forEach(node => msg.cnode(node).up());
      msg.up().up();
    }
    if (meta) {
      msg.c('cadence', {xmlns: `cadence:meta`});
      Object.forEach(meta, (key, value) => {
        msg.c(key, {}, value);
      });
      msg.up();
    }
    msg.send();
    ui.playSound('send');
  },

  /**
   * Set the room subject.
   *
   * @param {String} text The new room subject.
   */
  setSubject(text) {
    this.msg({
       to: this.jidFromRoomNick(),
       type: 'groupchat',
     })
     .c('subject', {}, text)
     .send();
  },

  /**
   * Set a user's role (by roomnick) or affiliation (by jid).
   *
   * @param {Object} item Either nick/role or jid/affiliation.
   * @param {String} reason (optional)
   *
   * @return {Promise} A promise that resolves to the server response.
   */
  setUser(item, reason) {
    const iq = this.iq({type: 'set', to: this.jidFromRoomNick()});
    iq.c('query', {xmlns: Strophe.NS.MUC + '#admin'})
    iq.c('item', item)
    if (reason) iq.c('reason', {}, reason);
    return iq.send();
  },

  setRoom(room) {
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
  getUsers(query) {
    return this.iq({type: 'get', to: this.jidFromRoomNick()})
      .c('query', {xmlns: Strophe.NS.MUC + '#admin'})
      .c('item', query)
      .send();
  },

  /**
   * Query a room for its occupant list.
   *
   * @param {string} room
   *
   * @return {Promise} A promise that resolves to a user list.
   */
  queryOccupants(room) {
    return this.iq({type: 'get', to: this.jidFromRoomNick({room})})
      .c('query', {xmlns: Strophe.NS.DISCO_ITEMS})
      .send()
      .then(stanza => Array.from(stanza.querySelectorAll('item')).map(
        e => e.getAttribute('name')
      ));
  },


  /**
   * Query the server for rooms.
   *
   * @return {Promise} A promise that resolves to the list of rooms.
   */
  discoverRooms() {
    const iq = this.iq({type: 'get', to: config.xmpp.muc})
      .c('query', {xmlns: Strophe.NS.DISCO_ITEMS});

    return iq.send().then(stanza => {
      const rooms = {};
      Array.from(stanza.querySelectorAll('item')).forEach(item => {
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
      return rooms;
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
  eventPresenceCallback(stanza) {
    try {
      const from = this.JID.parse(stanza.getAttribute('from'));
      // Discard any <presence/> that is not from the MUC domain.
      // (This client does not support direct non-MUC communication.)
      if (from.domain != config.xmpp.muc) return true;

      // Find the room and nickname that the presence came from, and the type.
      const room = from.node;
      const nick = from.resource;
      const type = stanza.getAttribute('type');

      // Initialize the room roster if it doesn't exist yet.
      if (!this.roster[room]) this.roster[room] = {};

      if (type == 'error') {
        this.eventPresenceError(room, nick, stanza);
        return true;
      }

      // Find the status codes.
      const item = stanza.querySelector('item');
      const codes = Array.from(stanza.querySelectorAll('status')).map(
        e => parseInt(e.getAttribute('code'))
      );

      if (type == 'unavailable')
        this.eventPresenceUnavailable(room, nick, codes, item, stanza);
      else
        this.eventPresenceDefault(room, nick, codes, item, stanza);
    }
    catch (e) {
      Cadence.handleError(e);
    }
    return true;
  },

  eventPresenceError(room, nick, stanza) {
    // We're not throwing this one, the error handling happens in here.
    const error = new this.StanzaError(stanza);
    switch (error.condition) {
      case 'conflict':
        if (room == this.room.current) {
          this.nick.target = this.nick.current;
          throw new Cadence.Error(strings.error.nickConflict, {nick});
        }
        if (this.nickConflictResolve()) {
          ui.messageInfo(strings.info.rejoinNick, {nick: this.nick.target});
          this.joinRoom(this.room.target, this.nick.target);
        }
        else throw new Cadence.Error(strings.error.joinConflict, {nick});
        break;
      case 'not-authorized':
        const password = prompt(strings.info.promptRoomPassword);
        if (password) this.joinExistingRoom(room, password);
        else throw new Cadence.Error(strings.error.joinPassword, {room: this.room.available[room]});
        break;
      case 'forbidden':
        throw new Cadence.Error(strings.error.joinBanned, {room: this.room.available[room]});
      case 'not-allowed':
        throw new Cadence.Error(strings.error.noCreate);
      case 'jid-malformed':
        this.nick.target = this.nick.current;
        throw new Cadence.Error(strings.error.badNick, {nick});
    }
  },

  /**
   * Handle presence stanzas of type `unavailable`.
   */
  eventPresenceUnavailable(roomId, nick, codes, item, stanza) {
    const roster = this.getRoster(roomId);
    const user = roster[nick];
    const room = this.getRoom(roomId);

    // Delete the old roster entry.
    delete roster[nick];

    // Ignore things that happen outside the current room or to missing users.
    if (roomId != this.room.current || !user) return;

    // An `unavailable` 303 is a nick change to <item nick="{new}"/>
    if (codes.includes(303)) {
      const newNick = item.getAttribute('nick');
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
        const _actor = item.querySelector('actor');
        const actorNick = _actor && _actor.getAttribute('nick');
        // For a self-kick, the actor is already out of the roster.
        const actor = actorNick == nick ? user : roster[actorNick];
        const _reason = item.querySelector('reason');
        const reason = _reason && _reason.textContent;
        const index = (+!!actor) * 2 + (+!!reason);

        // ejabberd bug: presence does not use 110 code; check nick.
        if (nick == xmpp.nick.current)
          ui.messageError(strings.info.evicted[type].me[index], {actor, reason, room});
        else
          ui.messageInfo(strings.info.evicted[type].other[index], {actor, reason, room, user});
        ui.playSound('leave');
      }

      // A <destroy> element indicates that the room has been destroyed.
      else if (stanza.querySelector('x destroy')) {
        const destroy = stanza.querySelector('x destroy');
        const _reason = destroy.querySelector('reason');
        const reason = _reason && _reason.textContent;
        const jid = this.JID.parse(destroy.getAttribute('jid'));
        const alternate = jid.domain == config.xmpp.muc
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
  eventPresenceDefault(room, nick, codes, item, stanza) {
    const roster = this.roster[room];
    const oldUser = roster[nick];

    const _show = stanza.querySelector('show');
    const _status = stanza.querySelector('status');
    const show = _show && _show.textContent || 'available';
    const status = _status && _status.textContent || '';

    // Create the user object.
    const user = {
      nick, show, status, room,
      jid: this.JID.parse(item.getAttribute('jid')), // if not anonymous.
      role: item.getAttribute('role'),
      affiliation: item.getAttribute('affiliation'),
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
  eventMessageCallback(stanza) {
    try {
      const from = this.JID.parse(stanza.getAttribute('from'));
      const {domain, node, resource} = from;

      const type = stanza.getAttribute('type') || 'normal';

      if (type == 'error')
        return this.eventMessageError(stanza, from) || true;

      let user = this.userFromJid(from);
      const muc = !!user.room || !!user.nick;

      const _meta = stanza.querySelector('message > cadence');
      const meta = _meta && Object.fromEntries(Array.from(_meta.childNodes).map(
        e => [e.tagName, e.textContent]
      ));

      const text = stanza.querySelector('message > body');
      const html = stanza.querySelector('message > html > body') || text;
      const body = text && {html: Array.from(html.childNodes), text: text.textContent};

      const _subject = stanza.querySelector('message > subject');
      const subject = _subject && _subject.textContent;

      const delay = stanza.querySelector('delay');
      const time = delay ? new Date(delay.getAttribute('stamp')) : new Date();

      if (muc) {
        const codes = Array.from(stanza.querySelectorAll('x status')).map(
          e => parseInt(e.getAttribute('code'))
        );

        // React to configuration updates.
        if (codes.includes(104)) {
          this.queryRoom(from.node).then((room) => {
            this.room.available[from.node] = room;
            ui.refreshRooms(this.room.available);
            ui.messageInfo(strings.code[104], {room});
          });
        }

        // Accept invitations.
        const invite = stanza.querySelector('x invite');
        if (invite) {
          const room = this.room.available[from.node];
          const jid = this.JID.parse(invite.attr('from'));
          const _reason = invite.querySelector('reason');
          const reason = _reason && _reason.textContent;
          const _password = stanza.querySelector('x password');
          const password = _password && _password.textContent;
          const message = strings.info.inviteReceived[+!!password][+!!reason];

          const process = room => ui.messageInfo(message, {jid, room, password, reason});
          // If we don't have the room info, load it first.
          if (room) return process(room);
          else return this.queryRoom(node).then(data => {
            this.room.available[node] = data;
            process(data);
          });
        }

        if (!resource) return true;

        // Do not look up the nick for delayed messages, because it's unreliable.
        if (delay) {
          // Look for an XEP-0033 <address type="ofrom"> element.
          const address = stanza.querySelector('addresses > address[type=ofrom]');
          // In non-anonymous rooms, try to identify the author by JID.
          const jid = this.JID.parse(address && address.getAttribute('jid'));
          if (jid) {
            // Copy the entry and fill in the new information.
            user = $.extend({}, this.userFromJid(jid, node), user, {jid});
          }
          else user = {nick: resource, room: node};
        }
        // A body-less subject message indicates a room subject change.
        else if (subject !== null && text === null) {
          if (subject) {
            // The first live <subject/> is always sent at the start.
            if (node in this.subject) ui.messageInfo(strings.info.subject.change, {subject, user});
            else ui.messageInfo(strings.info.subject.initial, {subject, user});
          }
          else if (this.subject[node]) ui.messageInfo(strings.info.subject.remove, {user});
          this.subject[node] = subject;
        }

        this.historyEnd[node] = time;
      }

      // Accept direct invitations:
      const invite = stanza.querySelector(`x[xmlns="${Strophe.NS.CONFERENCE}"]`);
      if (invite) {
        const {room} = this.userFromJid(this.JID.parse(invite.getAttribute('jid')));
        const password = invite.getAttribute('password');
        const reason = invite.getAttribute('reason');
        if (room) return ui.messageInfo(
          strings.info.inviteReceived[+!!password][+!!reason],
          {jid: from, room, password, reason}
        );
      }

      // If there is no <body> element, drop the message. (@TODO #201 XEP-0085)
      if (!text) return true;

      if (delay) {
        ui.messageDelayed({
          user, body, type, time, meta, subject,
          room: muc && this.room.available[node]
        });
      }
      else {
        const message = {user, body, type, time, meta, subject};
        ui.messageAppend(visual.formatMessage(message));
        if (resource != this.nick.current) ui.notify(message);
      }
    }
    catch (e) {
      Cadence.handleError(e);
    }
    return true;
  },

  /**
   * Handle <message> stanzas of type "error".
   *
   * @param {Object} stanza
   * @param {JID} from
   */
  eventMessageError(stanza, from) {
    const error = new xmpp.StanzaError(stanza);
    switch (error.condition) {
      case 'remote-server-not-found':
        throw new Cadence.Error(strings.error.notFound.domain, from);
      case 'service-unavailable':
        throw new Cadence.Error(strings.error.notFound.node, from);
      case 'item-not-found':
        throw new Cadence.Error(strings.error.notFound.nick, {nick: from.resource});
      case 'forbidden':
        throw new Cadence.Error(strings.error.messageDenied, error);
    }
  },

  /**
   * This function handles any unsupported <iq> namespaces.
   */
  eventIQCallback(stanza) {
    if (!stanza) return true;

    // Only respond to get/set, as per RFC-6120 8.2.3
    const type = stanza.getAttribute('type');
    if (type != 'get' && type != 'set') return true;

    const xmlns = stanza.querySelector('iq > *').getAttribute('xmlns');

    // Send <feature-not-implemented /> for anything not recognized.
    if (!this.features.includes(xmlns)) {
      const response = this.iq({
        type: 'error',
        to: stanza.getAttribute('from'),
        id: stanza.getAttribute('id')
      });
      response.c('error', {type: 'cancel', code: 501});
      response.c('feature-not-implemented', {xmlns: Strophe.NS.STANZAS}, '');
      response.send();
    }

    return true;
  },

  ping(jid) {
    return this.connection.ping.query(jid, config.xmpp.timeout)
      .catch(stanza => {
        throw new this.StanzaError(stanza);
      });
  },

  getTime(jid) {
    return this.connection.time.query(jid || this.jid.domain, config.xmpp.timeout)
      .catch(stanza => {
        throw new this.StanzaError(stanza);
      });
  },

  getVersion(jid) {
    return this.connection.version.query(jid || this.jid.domain, config.xmpp.timeout)
      .catch(stanza => {
        throw new this.StanzaError(stanza);
      });
  },

  attention(jid) {
    const msg = this.msg({to: jid, type: 'headline'});
    this.connection.attention.attention(msg);
    return msg.send();
  },

  /**
   * Load settings from XML storage.
   *
   * This will load settings stored under <cadence xmlns="cadence:settings">.
   */
  loadSettings() {
    const name = config.clientName;
    const query = this.connection.storage.get(name, `${name}:settings`, config.xmpp.timeout);
    return query.then(stanza => {
      const data = stanza.querySelector(`query > ${name} > data`);
      return this.connection.storage.read(data);
    });
  },

  /**
   * Store settings in XML storage.
   *
   * This will store settings in <cadence xmlns="cadence:settings">.
   */
  storeSettings(data, modified) {
    const name = config.clientName;
    return this.connection.storage.set(name, `${name}:settings`)
      .attrs({modified})
      .write(data)
      .send(config.xmpp.timeout).catch(stanza => {
        throw new this.StanzaError(stanza);
      });
  },
};
