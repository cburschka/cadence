/**
 * xmpp.js contains all the functions that communicate with the XMPP server.
 *
 * @author Christoph Burschka <christoph@burschka.de>
 * @year 2014
 * @license GPL3+
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
  roster: {},
  historyEnd: {},

  /**
   * Bind the object methods and create the connection object.
   */
  initialize: function() {
    this.discoverRooms = this.discoverRooms.bind(this);
    this.eventConnectCallback = this.eventConnectCallback.bind(this);
    this.eventPresenceCallback = this.eventPresenceCallback.bind(this);
    this.eventMessageCallback = this.eventMessageCallback.bind(this);
    this.eventIQCallback = this.eventIQCallback.bind(this);
    this.disconnect = this.disconnect.bind(this);
  },

  /**
   * Build a new connection object. This is used whenever the client reconnects.
   */
  buildConnection: function() {
    this.connection = new Strophe.Connection(config.xmpp.boshURL);
    this.connection.addHandler(this.eventPresenceCallback, null, 'presence');
    this.connection.addHandler(this.eventMessageCallback, null, 'message');
    this.connection.addHandler(this.eventIQCallback, null, 'iq');
    this.connection.addTimedHandler(30, this.discoverRooms);
    // DEBUG: print connection stream to console:
    this.connection.rawInput = function(data) {
      if (config.settings.debug) console.log('%cRECV ' + data, 'color:blue');
    };
    this.connection.rawOutput = function(data) {
      if (config.settings.debug) console.log('%cSEND ' + data, 'color:red');
    };
  },

  /**
   * Open the connection and authenticate.
   */
  newConnection: function(user, pass) {
    this.disconnect();
    this.session = {};
    this.user = user;
    this.nick.target = user;
    this.currentJid = Strophe.escapeNode(user) + '@' + config.xmpp.domain + '/' + this.createResourceName();
    this.buildConnection();
    this.connection.connect(this.currentJid, pass, this.eventConnectCallback);
  },

  /**
   * Wrapper for $iq() that fills in the sender, target and an optional <query>.
   *
   * @param {string} type: Required; one of get, set, result, error.
   * @param {object} target: A target object.
   * @param {object} item: jQuery or generic object.
   */
  iq: function(type, target, item) {
    var iq = $iq({from: this.connection.jid, to: this.jid(target), type: type});
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
    });
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
   */
  changeNick: function(nick) {
    this.nick.target = nick;
    if (this.status == 'online')
      this.connection.send(this.pres({nick: nick}));
    else ui.messageAddInfo(strings.info.nickPrejoin, {nick: nick});
  },

  /**
   * Send an unavailable presence to a specified room.
   *
   * @param {string} room The room to leave.
   */
  leaveRoom: function(room) {
    ui.messageAddInfo(strings.info.leave, {room: this.room.available[room]}, 'verbose');
    this.connection.send(this.pres(
      {room: room, nick: this.nick.current},
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
    var iqCallback = function(stanza) {
      var nick = (
        ($('query').attr('node') == 'x-roomuser-item') &&
        $('identity', stanza).attr('name') || null);
      callback(nick);
    }
    this.connection.sendIQ(
      this.iq('get', {room: room}, {xmlns: Strophe.NS.DISCO_INFO, node: 'x-roomuser-item'}),
      iqCallback, iqCallback
    );
  },

  /**
   * Query the server for extended room information.
   */
  getRoomInfo: function(room, callback) {
    this.connection.sendIQ(
      this.iq('get', {room: room}, {xmlns: Strophe.NS.DISCO_INFO}),
      function(stanza) {
        var query = $('query', stanza);
        callback({
          id: room,
          title: $('identity', query).attr('name'),
          members: $('x field[var=muc#roominfo_occupants] value').text(),
          info: query
        });
      },
      function(error) { callback(null) }
    );
  },

  /**
   * Attempt to join a room after checking it exists.
   *
   * @param {string} The room to join.
   */
  joinExistingRoom: function(room, password) {
    var joinWithReservedNick = function() {
      this.getReservedNick(room, function(nick) {
        if (nick && nick != this.nick.target) {
          this.nick.target = nick;
          ui.messageAddInfo(strings.info.nickRegistered, {nick: nick}, 'verbose');
        }
        this.joinRoom(room, password);
      });
    }.bind(this);

    this.getRoomInfo(room, function(roomInfo) {
      if (!roomInfo) {
        ui.setFragment(xmpp.room.current);
        return ui.messageAddInfo(strings.error.unknownRoom, {name: room}, 'error');
      }
      this.room.available[room] = roomInfo;
      ui.refreshRooms(this.room.available);
      ui.messageAddInfo(strings.info.joining, {
      room: this.room.available[room],
        user: {
          nick: this.nick.target,
          jid: this.connection.jid
        }
      }, 'verbose');
      if (config.settings.xmpp.registerNick) joinWithReservedNick();
      else this.joinRoom(room, password);
    }.bind(this));
  },

  /**
   * Attempt to create a new room.
   *
   * @param {string} The room name.
   * @param {object} Room configuration, passed on to xmpp.configureRoom().
   */
  joinNewRoom: function(name, config) {
    var room = name.toLowerCase();
    config = config || {'muc#roomconfig_roomname': name};
    ui.messageAddInfo(strings.info.creating, {
      room: {id: room, title: config['muc#roomconfig_roomname']},
      user: {
        nick: this.nick.target,
        jid: this.connection.jid
      }
    }, 'verbose');
    // After creating a room, we must configure it. cadence does not support
    // custom configuration, but it will set the natural-language title.
    this.connection.addHandler(function(stanza) {
      var codes = $.makeArray($('status', stanza).map(function() {
        return parseInt($(this).attr('code'));
      }));
      if (codes.indexOf(201) >= 0) {
        ui.messageAddInfo(strings.code[201], {name: config['muc#roomconfig_roomname'] || name}, 'verbose');
        this.configureRoom(room, config, null, function(rooms) {
          // Only update the menu after the room has been titled.
          ui.updateRoom(room, this.roster[room]);
          ui.messageAddInfo(strings.info.joined, {room: rooms[room]}, 'verbose');
        }.bind(this));
      }
    }.bind(this), null, 'presence', null, null, this.jid(
      {room: room, nick: this.nick.target}
    ));
    this.joinRoom(room);
  },


  /**
   * Join a room, regardless of whether it exists.
   *
   * @param {string} The room name.
   */
  joinRoom: function(room, password) {
    this.room.target = room;
    var presence = this.pres({room: room, nick: this.nick.target})
      .c('x', {xmlns:Strophe.NS.MUC})
      .c('history', {since: this.historyEnd[room] || '1970-01-01T00:00:00Z'});
    if (password) presence.up().c('password', password);
    this.connection.send(presence);
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
   * Send a ping.
   *
   * @param {string} to The ping target.
   * @param {function} success The success callback.
   * @param {function} error The error callback. This will receive an error stanza
   *                         if the server responded, or null if the ping timed out.
   */
  ping: function(to, success, error) {
    this.connection.sendIQ(this.iq('get', {jid: to})
        .c('ping', {xmlns: 'urn:xmpp:ping'}
      ), success, error, 15000);
  },

  /**
   * Request a room configuration form and fill it out with the values provided.
   *
   * See http://xmpp.org/registrar/formtypes.html#http:--jabber.org-protocol-mucroomconfig
   * for a reference on supported room configuration fields.
   *
   * @param {string} room The room name.
   * @param {Object|function} query Either the field values to set, or a function
   *        that will acquire the field values asynchronously. The function receives
   *        an <x> element of type form as a jQuery object and a callback function
   *        to transmit the field values to.
   * @param {function} success The callback to execute after submission.
   * @param {function} update The callback to execute after updating the room list.
   */
  configureRoom: function(room, query, success, update) {
    var error = success && function(stanza) {
      success(stanza ? $('error', stanza).attr('code') : true);
    }

    if (typeof query == 'object') {
      var values = query;
      query = xmpp.fillForm(values);
    }

    var submit = function(values) {
      var form = xmpp.iq('set', {room: room}, {xmlns: Strophe.NS.MUC + '#owner'})
        .c('x', {xmlns: 'jabber:x:data', type: 'submit'});

      for (var name in values) {
        if (values[name] === undefined) continue;
        if (typeof values[name] === 'string') values[name] = [values[name]];
        form.c('field', {'var': name});
        for (var i in values[name]) {
          form.c('value', values[name][i]).up();
        }
        form.up();
      }

      xmpp.connection.sendIQ(form, function() {
        success && success();
        // Need to refresh the room list now.
        xmpp.discoverRooms(update);
      }, error);
    }

    this.connection.sendIQ(
      this.iq('get', {room: room}, {xmlns: Strophe.NS.MUC + '#owner'}),
      function(stanza) {
        query($('query x', stanza), submit);
      }, error
    );
  },

  /**
   * Create a non-interactive form-filling function.
   *
   * @param {Object} values The values that sh
   * @return {function} A function that receives a DOM node and a submit function
   *         The submit callback receives the validated form values, including
   *         defaults for any omitted fields. Any values that do not match a
   *         form field trigger a warning message.
   */
  fillForm: function(values) {
    return function (x, submit) {
      var toSubmit = {};
      $('field', x).each(function() {
        var type = $(this).attr('type');
        var name = $(this).attr('var');
        var value = $(this).children('value').html();
        if (values[name] !== undefined) value = values[name];
        if (value && type == 'list-single') {
          var options = [];
          $('option value', this).each(function() { options.push(this.innerHTML)});
          if (options.indexOf(value) < 0)
            return ui.messageAddInfo(strings.error.roomConfOptions,
              {options: options.join(', '), field: name}, 'error'
            );
        }
        toSubmit[name] = value;
        delete values[name];
      });
      var fields = Object.keys(values);
      if (fields.length)
        ui.messageAddInfo(strings.error.formFields, {fields: fields.join(', ')}, 'error');
      submit(toSubmit);
    }
  },

  /**
   * Order the server to destroy a room.
   * @param {string} room The room ID.
   * @param {string} alternate An alternate room ID (optional).
   * @param {string} message The reason (optional).
   * @param {function} success The callback to execute on completion.
   */
  destroyRoom: function(room, alternate, message, success) {
    var iq = this.iq('set', {room: room}, {xmlns: Strophe.NS.MUC + '#owner'})
      .c('destroy');
    if (alternate) iq.attrs({jid: Strophe.escapeNode(alternate) + '@' + config.xmpp.mucService});
    if (message) iq.c('reason', message);
    this.connection.sendIQ(iq, function() {
      success && success();
      this.discoverRooms();
    }.bind(this), function(stanza) {
      success(stanza ? $('error', stanza).attr('code') : true);
    });
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

    var submit = function(sessionid) {
      return function(values) {
        var form = xmpp.iq('set', {}).c('command', {
          xmlns: 'http://jabber.org/protocol/commands',
          node: 'http://jabber.org/protocol/admin#' + node,
          sessionid: sessionid
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
          function (stanza) { callback && callback(stanza, 2); },
          function (stanza) { callback && callback(stanza, 1); }
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
      function(stanza) {
        var values = {};
        var sessionid = $('command', stanza).attr('sessionid');
        query($('command x', stanza), submit(sessionid));
      },
      callback
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
      success, function(response) {
        var code = $('error', response).attr('code');
        error(code, response);
      }
    );
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
      this.iq('get', {room: room}, {xmlns: Strophe.NS.DISCO_ITEMS}),
      function (stanza) {
        var users = {};
        $('item', stanza).each(function() {
          var nick = $(this).attr('name');
          users[nick] = nick;
        });
        callback(users);
      },
      function () { callback(); }
    );
  },


  /**
   * Query server version.
   */
  getVersion: function(callback) {
    this.connection.sendIQ(
      this.iq('get', {}, {xmlns:'jabber:iq:version'}),
      function (stanza) {
        callback({
          name: $('name', stanza).html() || '-',
          version: $('version', stanza).html() || '-',
          os: $('os', stanza).html() || '-'
        });
      },
      function () {
        callback(false);
      }
    );
  },

  /**
   * Query the server for rooms and execute a callback.
   *
   * @param {function} callback The function to execute after the server responds.
   */
  discoverRooms: function(callback) {
    this.connection.sendIQ(
      this.iq('get', {room: null}, {xmlns:Strophe.NS.DISCO_ITEMS}),
      function(stanza) {
        var rooms = {};
        $('item', stanza).each(function(s,t) {
          var room = Strophe.unescapeNode(Strophe.getNodeFromJid($(t).attr('jid')));
          // Strip off the parenthesized number of participants in the name:
          var name = $(t).attr('name');
          if (name)
            name = name.replace(/\((\d+)\)$/, '').trim();
          else
            name = room;
          rooms[room] = {id: room, title: name, members: null};
        });
        // Preserve the current room in the list of available rooms.
        if (this.room.current && !rooms[this.room.current])
          rooms[this.room.current] = this.room.available[this.room.current]
        this.room.available = rooms;
        ui.refreshRooms(this.room.available);
        if (callback) callback(rooms);
      }.bind(this),
      function() {}
    );
    return true;
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
        ui.messageAddInfo(strings.error.nickConflict, {nick: nick}, 'error');
        return this.nick.target = this.nick.current;
      }
      else {
        ui.messageAddInfo(strings.error.joinConflict, {nick: nick}, 'error');
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
      ui.messageAddInfo(strings.error.badNick, {nick: nick}, 'error');
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
        var reason = $('reason', item).text();
        var index = (actor != null) * 2 + (reason != "");
        // ejabberd bug: presence does not use 110 code; check nick.
        if (nick == xmpp.nick.current) {
          ui.messageAddInfo(strings.info.evicted[type].me[index], {
            actor: actor, reason: reason,
            room: this.room.available[room]
          }, 'error');
        }
        else ui.messageAddInfo(strings.info.evicted[type].other[index], {
          actor: actor,
          room: this.room.available[room],
          reason: reason,
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
          room: xmpp.room.available[room], alternate: alternate, reason: reason
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
      nick: nick,
      jid: item.attr('jid') || null, // if not anonymous.
      role: item.attr('role'),
      affiliation: item.attr('affiliation'),
      show: show,
      status: status
    };

    // A 110-code presence reflects a presence that we sent.
    if (codes.indexOf(110) >= 0) {
      // A 210 code indicates the server modified the nick we requested.
      // This may happen either on joining or changing nicks.
      if (codes.indexOf(210) >= 0) {
        ui.messageAddInfo(strings.code[210], 'verbose')
      }

      if (room != this.room.current) {
        var oldRoom = this.room.current;
        this.room.current = room;
        // We are in a different room now. Leave the old one.
        if (oldRoom) {
          this.leaveRoom(oldRoom);
        }
        this.status = 'online';

        // If this room already existed, then update the menu and roster now:
        if (this.room.available[room]) {
          ui.updateRoom(room, this.roster[room]);
          ui.messageAddInfo(strings.info.joined, {room: this.room.available[room]}, 'verbose');
        }
      }
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
        ui.messageAddInfo(strings.info.userIn, {user: user});

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
        ui.messageAddInfo(msg[+!!status], {
          user: user,
          show: show,
          status: status
        });
        ui.playSound('info');
      }
      else if (roster.affiliation != user.affiliation) {
        ui.messageAddInfo(strings.info.userAffiliation, {user: user, affiliation: user.affiliation});
        ui.playSound('info');
      }
      else if (roster.role != user.role) {
        ui.messageAddInfo(strings.info.userRole, {user: user, role: user.role});
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
      var body = $('html body p', stanza).html() || visual.format.plain($($('body', stanza)[0]).text());
      var delay = $('delay', stanza);
      var time = delay.attr('stamp') || (new Date()).toISOString();

      // Message of the Day.
      if ((domain == config.xmpp.domain || domain == config.xmpp.mucService) && !node && !resource)
        return ui.messageAddInfo(strings.info.motd, {domain: domain, text: body}, 'error');

      else if (domain == config.xmpp.mucService) {
        // Accept invitations.
        var invite = $('x invite', stanza);
        if (invite.length) {
          var room = xmpp.room.available[node];
          if (!room) xmpp.getRoomInfo(node, function(data) {
            room = data;
            xmpp.room.available[node] = data;
          });
          var reason = $('reason', invite).text();
          var password = $('x password', stanza).text();
          return ui.messageAddInfo(strings.info.inviteReceived[+!!password][+!!reason], {
            user: {jid: invite.attr('from')},
            room: room,
            password: password,
            reason: reason
          });
        }
        // Only accept MUC messages in the current room.
        if (node != this.room.current) return true;

        // Do not look up the nick for delayed messages, because it's unreliable.
        if (!delay.length) {
          // Fall back on just the nick if no roster entry exists (usually an error).
          var user = this.roster[node][resource] || {nick: resource};
        }
      }

      // Accept direct messages from other domains.
      else var user = {jid: from};
      if (type == 'error') {
        var error = $('error', stanza);
        if ($('item-not-found', error).length)
          ui.messageAddInfo(strings.error.unknownUser, {nick: user.nick}, 'error');
        else if ($('forbidden', error).length)
          ui.messageAddInfo(strings.error.messageDenied, {text: $('text', error).text()}, 'error');
        return true;
      }
      this.historyEnd[node] = time;

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
        ui.messageDelayed({
          user: user,
          body: body,
          time: delay.attr('stamp'),
          room: this.room.available[node],
          type: type
        });
      }
      else {
        var message = {user: user, body: body, type: type};
        ui.messageAppend(visual.formatMessage(message));
        if (resource != this.nick.current) ui.notify(message);
      }
    }
    return true;
  },

  /**
   * This function handles any <iq> stanzas.
   */
  eventIQCallback: function(stanza) {
    if (stanza) {
      // Respond to <ping> (XEP-0199).
      if ($('ping', stanza).attr('xmlns') == 'urn:xmpp:ping') {
        return this.connection.send(this.iq('result').attrs({
          to: $(stanza).attr('from'),
          id: $(stanza).attr('id')
        })) || true;
      }

      // Respond to <time> (XEP-0202).
      if ($('time', stanza).attr('xmlns') == 'urn:xmpp:time') {
        return this.connection.send(this.iq('result').attrs({
            to: $(stanza).attr('from'),
            id: $(stanza).attr('id')
          })
          .c('time', {xmlns: 'urn:xmpp:time'})
          .c('utc', moment().toISOString())
          .c('tzo', moment().format('Z'))
        ) || true;
      }
    }
    return true;
  },

  /**
   * This function handles any changes in the connection state.
   */
  eventConnectCallback: function(status, errorCondition) {
    var msg = strings.connection[status];
    var status = this.readConnectionStatus(status)
    if (errorCondition) msg += ' (' + errorCondition + ')';
    if (status != this.status)
      ui.messageAddInfo(msg, status == 'offline' ? 'error' : 'verbose');
    this.status = status;
    ui.setStatus(this.status);

    if (status == 'prejoin') {
      this.connection.send(this.pres());
      var room = this.room.target || ui.getFragment() || config.settings.xmpp.room;
      if (config.settings.xmpp.autoJoin || ui.urlFragment) {
        this.discoverRooms(function (rooms) {
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
      ui.userRefresh({});
      ui.refreshRooms({});
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

  /**
   * Close the connection, first sending an `unavailable` presence.
   */
  disconnect: function() {
    if (this.connection) {
      this.connection.send(this.pres({}, {type: 'unavailable'}));
      this.connection.disconnect();
    }
  }
}
