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
   * Initialize the helper functions and create the connection object.
   *
   * The `this.callback = this.callback()` pattern is used to inject a reference
   * to the module (`this`) into the callback's scope, which is named `self`.
   */
  initialize: function() {
    this.discoverRooms = this.discoverRooms();
    this.eventConnectCallback = this.eventConnectCallback();
    this.eventPresenceCallback = this.eventPresenceCallback();
    this.eventMessageCallback = this.eventMessageCallback();
    this.disconnect = this.disconnect();
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
    this.connection.send(this.presence(this.room.current, nick));
  },

  /**
   * Send an unavailable presence to a specified room.
   *
   * @param {string} room The room to leave.
   */
  leaveRoom: function(room) {
    ui.messageAddInfo(strings.info.leave, {room:
      visual.formatRoom(this.room.available[this.room.current])
    }, 'verbose');
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
    var self = this;

    var joinRoom = function() {
      ui.messageAddInfo(strings.info.joining, {
        room: visual.formatRoom(self.room.available[room]),
        user: visual.formatUser({
          nick: self.nick.target,
          jid: self.connection.jid
        })
      }, 'verbose');
      self.connection.send(self.presence(room, self.nick.target));
    };

    var joinWithReservedNick = function() {
      this.getReservedNick(room, function(nick) {
        if (nick && nick != self.nick.target) {
          self.nick.target = nick;
          ui.messageAddInfo(strings.info.nickRegistered, {nick:nick}, 'verbose');
        }
        joinRoom();
      });
    };

    this.getRoomInfo(room, function(roomInfo) {
      if (!roomInfo) return ui.messageAddInfo(strings.error.unknownRoom, {room: room}, 'error');
      self.room.available[room] = roomInfo;
      if (config.settings.xmpp.registerNick) joinWithReservedNick();
      else joinRoom();
    });
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
  discoverRooms: function() {
    var self = this;
    return function(callback) {
      self.connection.sendIQ(
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
          self.room.available = rooms;
          ui.refreshRooms(self.room.available);
          if (callback) callback(rooms);
        },
        function() {}
      );
      return true;
    }
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
   * 110-code presences, which acknowledge/reflect a presence that we sent.
   * These may indicate the success of a join or nick request, which make us
   * alter the client state.
   *
   * Any other presence (with or without `unavailable` type). These, including
   * the 110-codes, alter the state of the user roster. Some changes
   * (leaving/joining a room, changing nick, changing <show/>) will also
   * generate a notification.
   */
  eventPresenceCallback: function() {
    var self = this;
    return function(stanza) {
      if (stanza) {
        var from = $(stanza).attr('from');
        // Discard any <presence/> that is not from the MUC domain.
        // (This client does not support direct non-MUC communication.)
        if (Strophe.getDomainFromJid(from) != config.xmpp.muc_service) return true;

        // Find the room and nickname that the presence came from, and the type.
        var room = Strophe.unescapeNode(Strophe.getNodeFromJid(from));
        var nick = Strophe.getResourceFromJid(from);
        var type = $(stanza).attr('type');

        // Initialize the room roster if it doesn't exist yet.
        if (!self.roster[room]) self.roster[room] = {};

        if (type == 'error') {
          if ($('conflict', stanza).length) {
            if (room == self.room.current) {
              ui.messageAddInfo(strings.error.nickConflict, 'error');
            }
            else {
              ui.messageAddInfo(strings.error.joinConflict, 'error');
              self.nickConflictResolve();
              ui.messageAddInfo(strings.info.rejoinNick, {nick:self.nick.target});
              self.joinRoom(self.room.target, self.nick.target);
            }
          }
        }
        else {
          // Find the status codes.
          var item = $(stanza).find('item');
          var codes = $.makeArray($('status', stanza).map(function() {
              return parseInt($(this).attr('code'));
          }));

          if (type == 'unavailable') {
            if (room == self.room.current) {
              // An `unavailable` 303 is a nick change to <item nick="{new}"/>
              if (codes.indexOf(303) >= 0) {
                var newNick = item.attr('nick');
                ui.messageAddInfo(strings.info.userNick, {
                  from:visual.formatUser(self.roster[room][nick]),
                  to:visual.formatUser({
                    nick:newNick,
                    jid:self.roster[room][nick].jid,
                    role:self.roster[room][nick].role,
                    affiliation:self.roster[room][nick].affiliation
                  })
                });
                // Move the roster entry to the new nick, so the new presence
                // won't trigger a notification.
                self.roster[room][newNick] = self.roster[room][nick];
              }
              // Any other `unavailable` presence indicates a logout.
              else {
                ui.messageAddInfo(strings.info.userOut, {
                  user:visual.formatUser(self.roster[room][nick])
                });
              }
              // In either case, the old nick must be removed and destroyed.
              ui.userRemove(self.roster[room][nick]);
              delete self.roster[room][nick];
            }
          }
          else {
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
                ui.messageAddInfo(strings.code[201], {
                  room: visual.formatRoom(self.room.available[room])
                }, 'verbose');
              }

              if (room != self.room.current) {
                // We are in a different room now. Leave the old one.
                if (self.room.current) self.leaveRoom(self.room.current);
                self.status = 'online';
                ui.messageAddInfo(strings.info.joined, {
                  room: visual.formatRoom(self.room.available[room])
                }, 'verbose');
                // If this room is not on the room list, add it.
                if (!self.room.available[room]) {
                  self.room.available[room] = {id: room, title: room, members: 1};
                  ui.refreshRooms(self.room.available);
                }
                // The room roster has been received by now. Refresh it.
                ui.updateRoom(room, self.roster[room]);
                // Delete the old room's roster, if one exists.
                delete self.roster[self.room.current];
                self.room.current = room;
              }
              self.nick.current = nick;
            }
            // We have fully joined this room - track the presence changes.
            if (self.room.current == room) {
              var userText = visual.formatUser(user)
              var vars = {user: userText, status: status ? ' (' + status + ')' : ''}
              if (!self.roster[room][nick]) {
                ui.messageAddInfo(strings.info.userIn, vars);
              }
              else if (self.roster[room][nick].show != show || self.roster[room][nick].status != status) {
                ui.messageAddInfo(strings.show[show], vars);
              }
            }

            self.roster[room][nick] = user;
            ui.userAdd(self.roster[room][nick]);
          }
        }
      }
      return true;
    }
  },

  /**
   * This function handles any <message> stanzas received.
   */
  eventMessageCallback: function() {
    var self = this;
    return function(stanza) {
      if (stanza) {
        var from = $(stanza).attr('from');
        var type = $(stanza).attr('type');
        var nick = Strophe.getResourceFromJid(from);
        var room = Strophe.unescapeNode(Strophe.getNodeFromJid(from));
        // Only accept messages in the current room.
        if (Strophe.getDomainFromJid(from) != config.xmpp.muc_service || room != self.room.current)
          return true;
        if (type == 'error') {
          if ($('error', stanza).attr('code') == '404') {
            ui.messageAddInfo(strings.error.unknownUser, {nick: nick}, 'error');
            return true
          }
        }

        // Only accept messages from nicks we know are in the room.
        var user = self.roster[room][nick];
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
            {user: user, body: body, time: time, room: self.room.available[room], type: type}
          );
          else ui.messageAppend(visual.formatMessage({user: user, body: body, type: type}));
        }
      }
      return true;
    }
  },

  /**
   * This function handles any changes in the connection state.
   */
  eventConnectCallback: function() {
    var self = this;
    return function(status, errorCondition) {
      var msg = strings.connection[status];
      var status = self.readConnectionStatus(status)
      if (errorCondition) msg += ' (' + errorCondition + ')';
      if (status != self.status)
        ui.messageAddInfo(msg, status == 'offline' ? 'error' : 'verbose');
      self.status = status;
      ui.setStatus(self.status);

      if (status == 'prejoin') {
        self.announce();
        var room = self.room.target || config.settings.room;
        if (config.settings.autoJoin) self.joinRoom(room);
        else self.prejoin();
      }
      else if (status == 'offline') {
        // The connection is closed and cannot be reused.
        self.buildConnection();
        self.nick.current = null;
        self.room.current = null;
        self.roster = {};
        ui.userRefresh({});
        ui.refreshRooms({});
      }
      return true;
    }
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
    var self = this;
    return function() {
      self.connection.send(self.pres().attrs({type: 'unavailable'}));
      self.connection.disconnect();
    };
  }
}
