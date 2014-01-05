var xmpp = {
  connection: null,
  rooms: null,
  currentRoom: null,
  currentNick: null,
  resource: null,
  status: 'offline',
  roster: {},

  initialize: function() {
    this.discoverRooms = this.discoverRooms();
    this.eventConnectCallback = this.eventConnectCallback();
    this.eventPresenceCallback = this.eventPresenceCallback();
    this.eventMessageCallback = this.eventMessageCallback();
    this.disconnect = this.disconnect();
    this.buildConnection();
    // Try to attach to an old session. If it fails, initiate login.
    if (!this.resumeConnection()) {
      ui.connectionFailureAlert();
    }
  },

  buildConnection: function() {
    this.connection = new Strophe.Connection(config.xmpp.boshURL);
    this.connection.addHandler(this.eventPresenceCallback, null, 'presence');
    this.connection.addHandler(this.eventMessageCallback, null, 'message');
    this.connection.addTimedHandler(30, function() {
      xmpp.discoverRooms(function(rooms) {
        self.rooms = rooms;
        ui.refreshRooms(self.rooms);
      });
    });
    // DEBUG: print connection stream to console:
    //this.connection.rawInput = function(data) { console.log("RECV " + data) }
    //this.connection.rawOutput = function(data) { console.log("SEND " + data) }
  },

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

  newConnection: function(user, pass) {
    this.session = {};
    this.preferredNick = user;
    var jid = user + '@' + config.xmpp.domain + '/' + this.createResourceName();
    console.log("Connecting as", jid, pass);
    this.connection.connect(jid, pass, this.eventConnectCallback);
  },

  pres: function() {
    return $pres({from:this.connection.jid});
  },

  msg: function() {
    return $msg({
      from: this.connection.jid,
      to:   this.currentRoom + '@' + config.xmpp.muc_service,
      type: 'groupchat'
    });
  },

  announce: function() {
    this.connection.send(this.pres());
  },

  createResourceName: function() {
    return 'strophe/' + hex_sha1(""+Math.random()).substr(0,6);
  },

  nickConflictResolve: function() {
    var m = /^(.*?)([\d]*)$/.exec(this.preferredNick);
    var i = 1;
    if (m[2]) {
      i = parseInt(m[2]) + 1;
    }
    this.preferredNick = m[1] + i;
  },

  changeNick: function(nick) {
    this.preferredNick = nick;
    this.presenceRoomNick(this.currentRoom, nick);
  },

  changeRoom: function(room) {
    var self = this;
    $('#channelSelection').val(room);
    this.joinRoom(room);
  },

  leaveRoom: function(room) {
    this.connection.send(this.pres()
      .attrs({to:room + '@' + config.xmpp.muc_service + '/' + this.currentNick, type:'unavailable'})
    );
  },

  getReservedNick: function(room, callback, callbackError) {
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

  joinRoom: function(room) {
    var self = this;

    ui.messageAddInfo('Joining room ' + room + '...');
    this.getReservedNick(room, function(nick) {
      if (nick && nick != self.preferredNick)
        ui.messageAddInfo('Switching to registered nick ' + nick + '.');
      else nick = self.preferredNick;
      self.presenceRoomNick(room, nick);
    }, function(stanza) {
      var msg = $('text', stanza).html() || 'Server error.';
      ui.messageAddInfo('Could not join room ' + room + ': ' + msg, 'error');
    });
  },

  presenceRoomNick: function(room, nick) {
    this.connection.send(this.pres()
      .attrs({
        to:Strophe.escapeNode(room) + '@' + config.xmpp.muc_service + '/' + nick
      })
      .c('x', {xmlns:Strophe.NS.MUC})
    );
  },

  sendMessage: function(html) {
    html = $('<p>' + html + '</p>');
    this.connection.send(this.msg()
      .c('body', html.text()).up()
      .c('html', {xmlns:Strophe.NS.XHTML_IM})
      .c('body', {xmlns:Strophe.NS.XHTML}).cnode(html[0])
    );
  },

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
            rooms[room] = $(t).attr('name');
          });
          callback(rooms);
        },
        function() {}
      );
      return true;
    }
  },

  eventPresenceCallback: function() {
    var self = this;
    return function(stanza) {
      if (stanza) {
        var from = $(stanza).attr('from');
        // We are only interested in communicating with the room.
        if (Strophe.getDomainFromJid(from) != config.xmpp.muc_service) return true;
        var room = Strophe.unescapeNode(Strophe.getNodeFromJid(from));
        var nick = Strophe.getResourceFromJid(from);

        if (!self.roster[room]) self.roster[room] = {};

        var type = $(stanza).attr('type');
        if (type == 'error') {
          if ($('conflict', stanza).length) {
            if (room == self.currentRoom) {
              ui.messageAddInfo('Error: Username already in use.', 'error');
            }
            else {
              ui.messageAddInfo('Error: Unable to join; username already in use.', 'error');
              self.nickConflictResolve();
              ui.messageAddInfo('Rejoining as ' + self.preferredNick + ' ...');
              self.presenceRoomNick(self.currentRoom, self.preferredNick);
            }
          }
        }
        else {
          var item = $(stanza).find('item');
          var codes = $.makeArray($('status', stanza).map(function() {
              return parseInt($(this).attr('code'));
          }));

          if (type == 'unavailable') {
            if (codes.indexOf(303) >= 0) {
              var newNick = item.attr('nick');
              ui.messageAddInfo(nick + ' is now known as ' + newNick + '.');
              // Move the roster entry to the new nick, so the new presence
              // won't trigger a notification.
              self.roster[room][newNick] = self.roster[room][nick];
            }
            else {
              ui.messageAddInfo(nick + ' has logged out of the Chat.');
            }
            ui.userRemove(self.roster[room][nick]);
            delete self.roster[room][nick];
          }
          else {
            // away, dnd, xa, chat, [default].
            var show = $('show', stanza).text() || 'default';
            // Self-presence.
            if (codes.indexOf(110) >= 0) {
              // Only be in one room at a time:
              if (room != self.currentRoom) {
                self.leaveRoom(self.currentRoom);
                ui.userRefresh(self.roster[room]);
                delete self.roster[self.currentRoom];
                self.currentRoom = room;
              }
              self.currentNick = nick;
              if (codes.indexOf(210) >= 0) {
                ui.messageAddInfo('Your nick has been modified by the server.')
              }
              if (codes.indexOf(201) >= 0) {
                ui.messageAddInfo('The room ' + room + ' has been newly created.');
              }
            }
            // We have fully joined this room - track the presence changes.
            if (self.currentRoom == room) {
              if (!self.roster[room][nick]) {
                ui.messageAddInfo(nick + ' logs into the Chat.');
              }
              if (show == 'away' || show == 'xa') {
                ui.messageAddInfo(nick + ' is away.');
              }
              else if (show == 'dnd') {
                ui.messageAddInfo(nick + ' is busy.');
              }
              else if (self.roster[room][nick] && self.roster[room][nick].show != show) {
                ui.messageAddInfo(nick + ' has returned.');
              }
            }

            self.roster[room][nick] = {
              nick: nick,
              jid: item.attr('jid') || null, // if not anonymous.
              role: item.attr('role'),
              affiliation: item.attr('affiliation'),
              show: show,
            };
            ui.userAdd(self.roster[room][nick]);
          }
        }
      }
      return true;
    }
  },

  eventMessageCallback: function() {
    var self = this;
    return function(stanza) {
      if (stanza) {
        var from = $(stanza).attr('from');
        var nick = Strophe.getResourceFromJid(from);
        var room = Strophe.unescapeNode(Strophe.getNodeFromJid(from));
        if (Strophe.getDomainFromJid(from) != config.xmpp.muc_service || room != self.currentRoom)
          return true;
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
            {user: user, body: body, time: time}
          );
          else ui.messageAppend(ui.messageCreate({user: user, body: body}));
        }
      }
      return true;
    }
  },

  eventConnectCallback: function() {
    var self = this;
    return function(status, errorCondition) {
      self.setStatus(self.readConnectionStatus(status))
      var msg = self.readStatusMessage(status)
      if (errorCondition) msg += ' (' + errorCondition + ')';
      console.log("Received connection event", status, errorCondition, msg);
      if (self.status == 'online') {
        ui.messageAddInfo('XMPP: ' + msg, 'success');
        self.announce();
        self.discoverRooms(function(rooms) {
          self.rooms = rooms;
          ui.refreshRooms(self.rooms);
          var room = self.currentRoom || config.xmpp.default_room;
          if (room != self.currentRoom) {
            self.changeRoom(room);
          }
        });
      }
      else if (self.status == 'offline') {
        ui.messageAddInfo('XMPP: ' + msg, 'error');
        ui.connectionFailureAlert();
        // The connection is closed and cannot be reused.
        self.buildConnection();
        self.roster = {};
        ui.userRefresh({});
        ui.refreshRooms({});
      }
      else ui.messageAddInfo('XMPP: ' + msg);
      return true;
    }
  },

  readConnectionStatus: function(status) {
    switch (status) {
      case Strophe.Status.ERROR:
      case Strophe.Status.CONNFAIL:
      case Strophe.Status.AUTHFAIL:
      case Strophe.Status.DISCONNECTED:
        return 'offline';
      case Strophe.Status.CONNECTING:
      case Strophe.Status.AUTHENTICATING:
      case Strophe.Status.DISCONNECTING:
        return 'waiting';
      case Strophe.Status.CONNECTED:
      case Strophe.Status.ATTACHED:
        return 'online';
    }
  },

  readStatusMessage: function(status) {
    switch (status) {
      case Strophe.Status.ERROR: return config.xmpp.strings.status.ERROR;
      case Strophe.Status.CONNECTING: return config.xmpp.strings.status.CONNECTING;
      case Strophe.Status.CONNFAIL: return config.xmpp.strings.status.CONNFAIL;
      case Strophe.Status.AUTHENTICATING: return config.xmpp.strings.status.AUTHENTICATING;
      case Strophe.Status.AUTHFAIL: return config.xmpp.strings.status.AUTHFAIL;
      case Strophe.Status.CONNECTED: return config.xmpp.strings.status.CONNECTED;
      case Strophe.Status.DISCONNECTED: return config.xmpp.strings.status.DISCONNECTED;
      case Strophe.Status.DISCONNECTING: return config.xmpp.strings.status.DISCONNECTING;
      case Strophe.Status.ATTACHED: return config.xmpp.strings.status.ATTACHED;
    }
  },

  setStatus: function(status) {
    this.status = status
    ui.setStatus(status);
  },

  disconnect: function() {
    var self = this;
    return function() {
      self.connection.send(self.pres().attrs({type: 'unavailable'}));
      self.connection.disconnect();
      self.setStatus('offline');
    };
  }
}
