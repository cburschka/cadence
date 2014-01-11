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

  buildConnection: function() {
    this.connection = new Strophe.Connection(config.xmpp.boshURL);
    this.connection.addHandler(this.eventPresenceCallback, null, 'presence');
    this.connection.addHandler(this.eventMessageCallback, null, 'message');
    this.connection.addTimedHandler(30, function() {
      xmpp.discoverRooms(function(rooms) {
        self.room.available = rooms;
        ui.refreshRooms(self.room.available);
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
    this.nick.target = user;
    var jid = user + '@' + config.xmpp.domain + '/' + this.createResourceName();
    this.connection.connect(jid, pass, this.eventConnectCallback);
  },

  pres: function() {
    return $pres({from:this.connection.jid});
  },

  msg: function() {
    return $msg({
      from: this.connection.jid,
      to:   this.room.current + '@' + config.xmpp.muc_service,
      type: 'groupchat'
    });
  },

  announce: function() {
    this.connection.send(this.pres());
  },

  createResourceName: function() {
    return 'strophe/' + (new Date()).getTime();
  },

  nickConflictResolve: function() {
    var m = /^(.*?)([\d]*)$/.exec(this.nick.target);
    var i = 1;
    if (m[2]) {
      i = parseInt(m[2]) + 1;
    }
    this.nick.target = m[1] + i;
  },

  changeNick: function(nick) {
    this.nick.target = nick;
    this.connection.send(this.presence(this.room.current, nick));
  },

  leaveRoom: function(room) {
    this.connection.send(this.presence(room, nick, {type: 'unavailable'}));
  },

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

  joinRoom: function(room) {
    this.room.target = room;
    var self = this;

    var joinRoom = function() {
      ui.messageAddInfo('Joining room {room} as [user] ...', {
        room: room,
        user: visual.formatUser({
          nick: self.nick.target,
          jid: self.connection.jid
        })
      }, 'verbose');
      self.connection.send(self.presence(room, self.nick.target));
    }

    if (config.settings.xmpp.registerNick) {
      this.getReservedNick(room, function(nick) {
        if (nick && nick != self.nick.target) {
          self.nick.target = nick;
          ui.messageAddInfo('Switching to registered nick {nick}.', {nick:nick}, 'verbose');
        }
        joinRoom();
      });
    }
    else joinRoom();
  },

  presence: function(room, nick, attrs) {
    return this.pres()
      .attrs({
        to:Strophe.escapeNode(room) + '@' + config.xmpp.muc_service + '/' + nick
      })
      .attrs(attrs)
      .c('x', {xmlns:Strophe.NS.MUC})
      .up();
  },

  sendStatus: function(show, status) {
    var p = this.presence(this.room.current, this.nick.current);
    if (show) {
      p.c('show', {}, show);
      if (status) p.c('status', {}, status);
    }
    this.connection.send(p);
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
            var m = /^(.*?)(?: *\((\d+)\))?$/.exec($(t).attr('name'));
            if (m) {
              rooms[room] = {title: Strophe.unescapeNode(m[1]), members: m[2] || null};
            }
            else {
              rooms[room] = {title: room, members: null};
            }
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
            if (room == self.room.current) {
              ui.messageAddInfo('Error: Username already in use.', 'error');
            }
            else {
              ui.messageAddInfo('Error: Unable to join; username already in use.', 'error');
              self.nickConflictResolve();
              ui.messageAddInfo('Rejoining as {nick} ...', {nick:self.nick.target});
              self.joinRoom(self.room.target, self.nick.target);
            }
          }
        }
        else {
          var item = $(stanza).find('item');
          var codes = $.makeArray($('status', stanza).map(function() {
              return parseInt($(this).attr('code'));
          }));

          if (type == 'unavailable') {
            if (room == self.room.current) {
              if (codes.indexOf(303) >= 0) {
                var newNick = item.attr('nick');
                ui.messageAddInfo('[from] is now known as [to].', {
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
              else {
                ui.messageAddInfo('[user] has logged out of the Chat.', {
                  user:visual.formatUser(self.roster[room][nick])
                });
              }
              ui.userRemove(self.roster[room][nick]);
              delete self.roster[room][nick];
            }
          }
          else {

            // away, dnd, xa, chat, [default].
            var show = $('show', stanza).text() || 'default';
            var status = $('status', stanza).text() || '';
            // create user object:
            var user = {
              nick: nick,
              jid: item.attr('jid') || null, // if not anonymous.
              role: item.attr('role'),
              affiliation: item.attr('affiliation'),
              show: show,
              status: status
            };
            // Self-presence.
            if (codes.indexOf(110) >= 0) {
              if (codes.indexOf(210) >= 0) {
                ui.messageAddInfo('Your nick has been modified by the server.', 'verbose')
              }
              if (codes.indexOf(201) >= 0) {
                ui.messageAddInfo('The room {room} has been newly created.', {room:room}, 'verbose');
              }

              // Only be in one room at a time:
              if (room != self.room.current) {
                if (self.room.current) {
                  ui.messageAddInfo('Leaving room {room} ...', {room:self.room.current}, 'verbose');
                  self.leaveRoom(self.room.current);
                }
                ui.messageAddInfo('Now talking in room {room}.', {room:room}, 'verbose');
                if (!self.room.available[room]) {
                  self.room.available[room] = {title: room, members: 1};
                  ui.refreshRooms(self.room.available);
                }
                ui.updateRoom(room, self.roster[room]);
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
                ui.messageAddInfo('[user] logs into the Chat.', vars);
              }
              if (show == 'away' || show == 'xa') {
                ui.messageAddInfo('[user] is away{status}.', vars);
              }
              else if (show == 'dnd') {
                ui.messageAddInfo('[user] is busy{status}.', vars);
              }
              else if (self.roster[room][nick] && self.roster[room][nick].show != show) {
                ui.messageAddInfo('[user] has returned{status}.', vars);
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

  eventMessageCallback: function() {
    var self = this;
    return function(stanza) {
      if (stanza) {
        var from = $(stanza).attr('from');
        var nick = Strophe.getResourceFromJid(from);
        var room = Strophe.unescapeNode(Strophe.getNodeFromJid(from));
        if (Strophe.getDomainFromJid(from) != config.xmpp.muc_service || room != self.room.current)
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
            {user: user, body: body, time: time, room: room}
          );
          else ui.messageAppend(visual.formatMessage({user: user, body: body}));
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
      if (self.status == 'online') {
        ui.messageAddInfo(msg, 'verbose');
        self.announce();
        self.discoverRooms(function(rooms) {
          self.room.available = rooms;
          ui.refreshRooms(self.room.available);
          var room = self.room.current || config.settings.xmpp.room;
          self.joinRoom(room);
        });
      }
      else if (self.status == 'offline') {
        ui.messageAddInfo(msg, 'error');
        // The connection is closed and cannot be reused.
        self.buildConnection();
        self.roster = {};
        ui.userRefresh({});
        ui.refreshRooms({});
      }
      else ui.messageAddInfo(msg, 'verbose');
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
