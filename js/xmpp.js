var xmpp = {
  connection: null,
  rooms: null,
  currentRoom: null,
  currentNick: null,
  resource: null,
  status: 'offline',
  inRoom: false,
  roster: {},
  nickByJid: {},

  initialize: function() {
    this.discoverRooms = this.discoverRooms();
    this.eventConnectCallback = this.eventConnectCallback();
    this.eventPresenceCallback = this.eventPresenceCallback();
    this.eventMessageCallback = this.eventMessageCallback();
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
    this.connection.addTimedHandler(30000, this.discoverRooms);
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

  parseJid: function(jid) {
    var r = /^(([^@]+)@)?([^\/]+)(\/(.+))?/.exec(jid);
    addr = {node: r[2], domain: r[3], resource: r[5]};
    return addr;
  },

  changeNick: function(nick) {
    this.preferredNick = nick;
    this.presenceRoomNick(this.currentRoom, nick);
  },

  registerParticipant: function (jidMuc, jidFull) {
    var addrMuc = this.parseJid(jidMuc);
    var user;
    if (jidFull) {
      var addrFull = this.parseJid(jidFull);
      user = {
        inroom: true,
        nick: addrMuc.resource,
        user: addrFull.node,
        domain: addrFull.domain,
        client: addrFull.resource,
        local: addrFull.domain == config.xmpp.domain
      };
    }
    else {
      user = {
        inroom: true,
        nick: addrMuc.resource,
        user: '[' + addrMuc.resource + ']',
        local: true,
      };
    }
    this.roster[user.nick] = user;
    this.nickByJid[jidFull] = this.nickByJid[jidMuc] = user;
    return user;
  },

  identifyJid: function (jid) {
    addr = this.parseJid(jid);
    if (addr.domain == config.xmpp.muc_service && addr.node == this.currentRoom) {
      if (this.roster[addr.resource]) {
        return this.roster[addr.resource];
      }
    }
    else {
      var user = {
        // Messages may arrive from users who are not in the room.
        // These have no nick.
        inroom: false,
        user: addr.node,
        domain: addr.domain,
        client: addr.resource,
        nick: this.nickByJid[jid] || '',
        local: addr.domain == config.xmpp.domain
      };
      return user;
    }
  },

  clearRoom: function() {
    ui.userClear();
    this.roster = {};
    this.inRoom = false;
  },

  changeRoom: function(room) {
    if (this.currentRoom && this.currentRoom != room) {
      this.leaveRoom(this.currentRoom);
    }
    this.currentRoom = room;
    this.joinRoom(this.currentRoom);
  },

  leaveRoom: function(room) {
    ui.messageClear();
    this.clearRoom();
    this.connection.send(this.pres()
      .attrs({to:room + '@' + config.xmpp.muc_service + '/' + this.currentNick, type:'unavailable'})
    );
  },

  getReservedNick: function(room, callback) {
    var self = this;
    this.connection.sendIQ(
      $iq({
        from: this.connection.jid,
        to:room + '@' + config.xmpp.muc_service,
        type:'get',
      }).c('query', {
        xmlns:Strophe.NS.DISCO_INFO,
        node:'x-roomuser-item',
      }),
      function(stanza) {
        var nick = (
          ($('query').attr('node') == 'x-roomuser-item') &&
          $('identity', stanza).attr('name') || null);
        callback(self, nick);
      },
      function() {}
    );
  },

  joinRoom: function(room) {
    this.getReservedNick(room, function(self,nick) {
      nick = nick || self.preferredNick;
      ui.messageAddInfo('Joining room ' + room + ' as ' + nick + ' ...');
      self.presenceRoomNick(room, nick);
    });
  },

  presenceRoomNick: function(room, nick) {
    this.connection.send(this.pres()
      .attrs({to:room + '@' + config.xmpp.muc_service + '/' + nick})
      .c('x', {xmlns:Strophe.NS.MUC})
    );
  },

  sendMessage: function(text) {
    this.connection.send(this.msg()
      .c('body', text).up()
      //.c('html', {xmlns:Strophe.NS.XHTML_IM})
      //.c('body', {xmlns:Strophe.NS.XHTML}).cnode($('<p>'+html+'</p>')[0])
    );
  },

  discoverRooms: function() {
    var self = this;
    return function() {
      self.connection.sendIQ(
        $iq({
          from: this.connection.jid,
          to:config.xmpp.muc_service,
          type:'get'
        }).c('query', {xmlns:Strophe.NS.DISCO_ITEMS}),
        function(stanza) {
          var rooms = {};
          $('item', stanza).each(function(s,t) {
            t = $(t);
            rooms[t.attr('jid').match(/^[^@]+/)[0]] = t.attr('name');
          });
          if (self.rooms != rooms) {
            self.rooms = rooms;
            ui.refreshRooms(self.rooms);
            room = self.currentRoom;
            if (!self.currentRoom || !rooms[self.currentRoom])
              room = config.xmpp.default_room;
            $('#channelSelection').val(room);
            self.changeRoom(room);
          }
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
        var from = self.parseJid($(stanza).attr('from'));
        if (from.node != self.currentRoom || from.domain != config.xmpp.muc_service) {
          // We are only interested in communicating with the room.
          return true;
        }

        var type = $(stanza).attr('type');
        if (type == 'error') {
          if ($('conflict', stanza).length) {
            if (self.inRoom) {
              ui.messageAddError('Error: Username already in use.');
            }
            else {
              ui.messageAddError('Error: Unable to join; username already in use.');
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
              var nick = item.attr('nick');
              ui.messageAddInfo(from.resource + ' is now known as ' + nick + '.');
              // Pre-fill the roster to avoid signalling a room rejoin.
              self.roster[nick] = self.roster[from.resource];
            }
            else {
              ui.messageAddInfo(from.resource + ' has logged out of the Chat.');
            }
            ui.userRemove(self.roster[from.resource]);
            self.roster[from.resource] = null;
          }
          else {
            // away, dnd, xa, chat, [default].
            var show = $('show', stanza).text() || 'default';
            if (codes.indexOf(110) >= 0) {
              self.inRoom = true;
              self.currentNick = from.resource;
            }
            // Roster is complete; we want to log presence changes.
            if (self.inRoom) {
              if (!self.roster[from.resource]) {
                ui.messageAddInfo(from.resource + ' logs into the Chat.');
              }
              if (show == 'away' || show == 'xa') {
                ui.messageAddInfo(from.resource + ' is away.');
              }
              else if (show == 'dnd') {
                ui.messageAddInfo(from.resource + ' is busy.');
              }
              else if (self.roster[from.resource] && self.roster[from.resource].show != show) {
                ui.messageAddInfo(from.resource + ' has returned.');
              }
            }

            self.roster[from.resource] = {
              nick: from.resource,
              jid: self.parseJid(item.attr('jid')) || null, // if not anonymous.
              role: item.attr('role'),
              affiliation: item.attr('affiliation'),
              show: show,
            };
            ui.userAdd(self.roster[from.resource]);
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
        var user = self.identifyJid($(stanza).attr('from'));
        if (user) {
          var body = null;
          var html = $('html body p', stanza).html();
          if (html) {
            body = html;
          } else {
            body = $($('body', stanza)[0]).text();
            //body = bbcode.render(body);
          }
          var time = $('delay', stanza).attr('stamp');
          if (time) time = new Date(time);
          ui.messageAddUser(user, time, body);
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
        ui.messageAddSuccess('XMPP: ' + msg);
        self.announce();
        self.discoverRooms();
      }
      else if (self.status == 'offline') {
        ui.messageAddError('XMPP: ' + msg);
        ui.connectionFailureAlert();
        // The connection is closed and cannot be reused.
        self.buildConnection();
        self.clearRoom();
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
    this.connection.send(this.pres().attrs({type: 'unavailable'}));
    this.connection.disconnect();
    this.setStatus('offline');
  }
}
