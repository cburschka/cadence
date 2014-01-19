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
  resource: null,
  status: 'offline',
  roster: {},

  /**
   * Bind the object methods and create the connection object.
   */
  initialize: function() {
    this.discoverRooms = this.discoverRooms.bind(this);
    this.eventConnectCallback = this.eventConnectCallback.bind(this);
    this.eventPresenceCallback = this.eventPresenceCallback.bind(this);
    this.eventMessageCallback = this.eventMessageCallback.bind(this);
    this.disconnect = this.disconnect.bind(this);
    this.buildConnection();
    // Try to attach to an old session. If it fails, wait for user to log in.
    this.resumeConnection();
  },

  /**
   * Build a new connection object. This is used whenever the client reconnects.
   */
  buildConnection: function() {
    this.connection = new Strophe.Connection(config.xmpp.boshURL);
    this.connection.addHandler(this.eventPresenceCallback, null, 'presence');
    this.connection.addHandler(this.eventMessageCallback, null, 'message');
    this.connection.addTimedHandler(30, this.discoverRooms);
    // DEBUG: print connection stream to console:
    //this.connection.rawInput = function(data) { console.log("RECV " + data) }
    //this.connection.rawOutput = function(data) { console.log("SEND " + data) }
  },

  /**
   * Resume a stored connection. This is not currently implemented!
   */
  resumeConnection: function() {
    var session = localStorage.getItem('session');
    if (session) {
      this.session = JSON.parse(session);
      this.connection.attach(this.session.jid, this.session.sid, this.session.rid, this.eventConnectCallback);
      localStorage.removeItem('session');
      return true;
    }
    else return false;
  },

  /**
   * Open the connection and authenticate.
   */
  newConnection: function(user, pass) {
    this.session = {};
    this.nick.target = user;
    var jid = user + '@' + config.xmpp.domain + '/' + this.createResourceName();
    this.connection.connect(jid, pass, this.eventConnectCallback);
  },

  /**
   * Wrapper for $pres() that fills in the current JID.
   */
  pres: function() {
    return $pres({from:this.connection.jid});
  },

  /**
   * Wrapper for $msg() that fills in the sender JID and the room/nick JID.
   */
  msg: function(nick) {
    return $msg({
      from: this.connection.jid,
      to:   this.room.current + '@' + config.xmpp.muc_service + (nick ? '/' + nick : ''),
      type: (nick ? 'chat' : 'groupchat')
    });
  },

  /**
   * Announce general availability to the server by sending an empty presence
   * with no recipient.
   */
  announce: function() {
    this.connection.send(this.pres());
  },

  /**
   * Create a unique client identifier from the current millisecond timestamp.
   */
  createResourceName: function() {
    return 'strophe/' + (new Date()).getTime();
  },

  /**
   * Attempt to create a different nick by first appending, then incrementing
   * a numerical suffix.
   */
  nickConflictResolve: function() {
    var m = /^(.*?)([\d]*)$/.exec(this.nick.target);
    var i = 1;
    if (m[2]) {
      i = parseInt(m[2]) + 1;
    }
    this.nick.target = m[1] + i;
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
      this.connection.send(this.presence(this.room.current, nick));
    else ui.messageAddInfo(strings.info.nickPrejoin, {nick: nick});
  },

  /**
   * Send an unavailable presence to a specified room.
   *
   * @param {string} room The room to leave.
   */
  leaveRoom: function(room) {
    ui.messageAddInfo(strings.info.leave, {room: this.room.available[room]}, 'verbose');
    this.connection.send(this.presence(room, nick, {type: 'unavailable'}));
    // The server does not acknowledge the /part command, so we need to change
    // the state right here: If the room we left is the current one, enter
    // prejoin status and list the rooms again.
    if (room == this.room.current) this.prejoin();
  },

  prejoin: function() {
    this.room.current = null;
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
      $iq({
        from: this.connection.jid,
        to:room + '@' + config.xmpp.muc_service,
        type:'get',
      }).c('query', {
        xmlns:Strophe.NS.DISCO_INFO,
        node:'x-roomuser-item',
      }),
      iqCallback, iqCallback
    );
  },

  /**
   * Query the server for extended room information.
   */
  getRoomInfo: function(room, callback) {
    this.connection.sendIQ($iq({
      from: this.connection.jid,
      to: Strophe.escapeNode(room) + '@' + config.xmpp.muc_service,
      type: 'get',
    }).c('query', {xmlns: Strophe.NS.DISCO_INFO}),
    function(stanza) {
      var query = $('query', stanza);
      callback({
        id: room,
        title: $('identity', query).attr('name'),
        members: $('x field[var=muc#roominfo_occupants] value').text(),
        info: query
      });
    },
    function(error) { callback(null) });
  },

  /**
   * Attempt to join a room.
   *
   * @param {string} The room to join.
   */
  joinRoom: function(room) {
    this.room.target = room;

    var joinRoom = function() {
      ui.messageAddInfo(strings.info.joining, {
        room: this.room.available[room],
        user: {
          nick: this.nick.target,
          jid: this.connection.jid
        }
      }, 'verbose');
      this.connection.send(this.presence(room, this.nick.target));
    }.bind(this);

    var joinWithReservedNick = function() {
      this.getReservedNick(room, function(nick) {
        if (nick && nick != this.nick.target) {
          this.nick.target = nick;
          ui.messageAddInfo(strings.info.nickRegistered, {nick: nick}, 'verbose');
        }
        joinRoom();
      });
    }.bind(this);

    this.getRoomInfo(room, function(roomInfo) {
      if (!roomInfo) return ui.messageAddInfo(strings.error.unknownRoom, {room: room}, 'error');
      this.room.available[room] = roomInfo;
      if (config.settings.xmpp.registerNick) joinWithReservedNick();
      else joinRoom();
    }.bind(this));
  },

  /**
   * Create a directed presence to a specific room/nick, with specific attributes.
   * The stanza is not yet sent, but returned to the caller for additional data.
   *
   * @param {string} room The room name.
   * @param {string} nick The nickname.
   * @param {Object} attrs The attributes of the <presence/> element.
   */
  presence: function(room, nick, attrs) {
    return this.pres()
      .attrs({
        to:Strophe.escapeNode(room) + '@' + config.xmpp.muc_service + '/' + nick
      })
      .attrs(attrs)
      .c('x', {xmlns:Strophe.NS.MUC})
      .up();
  },

  /**
   * Create and send a presence stanza to the current room, with optional
   * <show/> and <status/> elements.
   * Note: To return from away-mode, a presence without <show/> is sent.
   * The <status/> element is only present in stanzas with <show/>.
   *
   * @param {string} show This must be one of "away", "xa", "chat".
   * @param {string} status This is an arbitrary away-message to send.
   */
  sendStatus: function(show, status) {
    var p = this.presence(this.room.current, this.nick.current);
    if (show) {
      p.c('show', {}, show);
      if (status) p.c('status', {}, status);
    }
    this.connection.send(p);
  },

  /**
   * Send a message to the room.
   *
   * @param {jQuery} html The HTML node to send.
   */
  sendMessage: function(html, nick) {
    html = $('<p>' + html + '</p>');
    this.connection.send(this.msg(nick)
      .c('body', html.text()).up()
      .c('html', {xmlns:Strophe.NS.XHTML_IM})
      .c('body', {xmlns:Strophe.NS.XHTML}).cnode(html[0])
    );
    ui.playSound('send');
  },

  /**
   * Query a room for its occupant list.
   */
  getOccupants: function(room, callback) {
    this.connection.sendIQ(
      $iq({
        from: this.connection.jid,
        to: Strophe.escapeNode(room) + '@' + config.xmpp.muc_service,
        type:'get'
      }).c('query', {xmlns:Strophe.NS.DISCO_ITEMS}),
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
   * Query the server for rooms and execute a callback.
   *
   * This function is actually a callback-wrapper (see xmpp.initialize() ),
   * which is replaced with its own return value on initialization.
   *
   * @param {function} callback The function to execute after the server responds.
   */
  discoverRooms: function(callback) {
    this.connection.sendIQ(
      $iq({
        from: this.connection.jid,
        to:config.xmpp.muc_service,
        type:'get'
      }).c('query', {xmlns:Strophe.NS.DISCO_ITEMS}),
      function(stanza) {
        var rooms = {};
        $('item', stanza).each(function(s,t) {
          var room = Strophe.unescapeNode(Strophe.getNodeFromJid($(t).attr('jid')));
          // Strip off the parenthesized number of participants in the name:
          var m = /^(.*?)(?: *\((\d+)\))?$/.exec($(t).attr('name'));
          if (m)
            rooms[room] = {id: room, title: Strophe.unescapeNode(m[1]), members: m[2] || null};
          else
            rooms[room] = {id: room, title: room, members: null};
        });
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
    if (Strophe.getDomainFromJid(from) != config.xmpp.muc_service) return true;

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
      this.eventPresenceUnavailable(room, nick, codes, item);
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
      }
      else {
        ui.messageAddInfo(strings.error.joinConflict, {nick: nick}, 'error');
        this.nickConflictResolve();
        ui.messageAddInfo(strings.info.rejoinNick, {nick: this.nick.target});
        this.joinRoom(this.room.target, this.nick.target);
      }
    }
  },

  /**
   * Handle presence stanzas of type `unavailable`.
   */
  eventPresenceUnavailable: function(room, nick, codes, item) {
    if (room == this.room.current) {
      // An `unavailable` 303 is a nick change to <item nick="{new}"/>
      if (codes.indexOf(303) >= 0) {
        var newNick = item.attr('nick');
        ui.messageAddInfo(strings.info.userNick, {
          'user.from': this.roster[room][nick],
          'user.to': {
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
      // An `unavailable` 307 is a kick.
      else if (codes.indexOf(307) >= 0) {
        var actor = $('actor', item).attr('nick');
        var reason = $('reason', item).text();
        var index = (actor != null) * 2 + (reason != "");
        // ejabberd bug: presence does not use 110 code; check nick.
        if (nick == xmpp.nick.current) {
          ui.messageAddInfo(strings.info.kickedMe[index], {
            'user.actor': actor,
            reason: reason
          }, 'error');
          xmpp.prejoin();
        }
        else ui.messageAddInfo(strings.info.kicked[index], {
          'user.actor': actor,
          reason: reason,
          user: this.roster[room][nick]
        });
        ui.playSound('leave');
      }
      // Any other `unavailable` presence indicates a logout.
      else {
        ui.messageAddInfo(strings.info.userOut, {user: this.roster[room][nick]});
        ui.playSound('leave');
      }
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
      // A 201 code indicates we created this room by joining it.
      if (codes.indexOf(201) >= 0) {
        ui.messageAddInfo(strings.code[201], {room: this.room.available[room]}, 'verbose');
      }

      if (room != this.room.current) {
        var oldRoom = this.room.current;
        this.room.current = room;
        // We are in a different room now. Leave the old one.
        if (oldRoom) {
          delete this.roster[oldRoom];
          this.leaveRoom(oldRoom);
        }
        this.status = 'online';
        ui.messageAddInfo(strings.info.joined, {room: this.room.available[room]}, 'verbose');
        // If this room is not on the room list, add it.
        if (!this.room.available[room]) {
          this.room.available[room] = {id: room, title: room, members: 1};
          ui.refreshRooms(this.room.available);
        }
        // The room roster has been received by now. Refresh it.
        ui.updateRoom(room, this.roster[room]);
        // Delete the old room's roster, if one exists.
      }
      this.nick.current = nick;
    }
    // We have fully joined this room - track the presence changes.
    if (this.room.current == room) {
      if (!this.roster[room][nick]) {
        ui.messageAddInfo(strings.info.userIn, {user: user});
        ui.playSound('enter');
      }
      else if (this.roster[room][nick].show != show || this.roster[room][nick].status != status) {
        ui.messageAddInfo(strings.show[show][status ? 1 : 0], {
          user: user,
          status: status
        });
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
      var nick = Strophe.getResourceFromJid(from);
      var room = Strophe.unescapeNode(Strophe.getNodeFromJid(from));
      // Only accept messages in the current room.
      if (Strophe.getDomainFromJid(from) != config.xmpp.muc_service || room != this.room.current)
        return true;
      if (type == 'error') {
        if ($('error', stanza).attr('code') == '404') {
          ui.messageAddInfo(strings.error.unknownUser, {nick: nick}, 'error');
          return true
        }
      }

      // Only accept messages from nicks we know are in the room.
      var user = this.roster[room][nick];
      if (user) {
        var body = null;
        var html = $('html body p', stanza).html();
        if (html) {
          body = html;
        } else {
          body = $($('body', stanza)[0]).text();
        }
        var time = $('delay', stanza).attr('stamp');
        if (time) message = ui.messageDelayed(
          {user: user, body: body, time: time, room: this.room.available[room], type: type}
        );
        else {
          ui.messageAppend(visual.formatMessage({user: user, body: body, type: type}));
          ui.playSound('receive');
        }
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
      this.announce();
      var room = this.room.target || config.settings.xmpp.room;
      if (config.settings.xmpp.autoJoin) {
        this.discoverRooms(function (rooms) {
          if (rooms[room]) chat.commands.join(room);
          else {
            ui.messageAddInfo(strings.error.unknownRoomAuto, {room: room});
            xmpp.prejoin();
          }
        });
      }
      else this.prejoin();
    }
    else if (status == 'offline') {
      // The connection is closed and cannot be reused.
      this.buildConnection();
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
      this.connection.send(this.pres().attrs({type: 'unavailable'}));
      this.connection.disconnect();
    }
  }
}
