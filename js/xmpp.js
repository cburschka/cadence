var xmpp = {
  connection: null,
  rooms: null,
  currentRoom: null,
  currentNick: null,
  jid: null,
  currentRoomJid: null,
  resource: null,
  status: null,
  rosterReceived: false,
  roster: {},
  nickByJid: {},

  initialize: function() {
    this.connection = new Strophe.Connection(config.xmpp.boshURL);
    // DEBUG: print connection stream to console:
    //this.connection.rawInput = function(data) { console.log("RECV " + data) }
    //this.connection.rawOutput = function(data) { console.log("SEND " + data) }
    this.eventDiscoverRooms = this.eventDiscoverRooms();
    this.eventConnectCallback = this.eventConnectCallback();
    this.eventPresenceCallback = this.eventPresenceCallback();
    this.eventMessageCallback = this.eventMessageCallback();
    this.connection.addHandler(this.eventPresenceCallback, null, 'presence');
    this.connection.addHandler(this.eventMessageCallback, null, 'message');
    this.connection.addTimedHandler(30000, this.discoverRooms);

    // Try to attach to an old session. If it fails, initiate login.
    if (!this.resumeConnection()) {
      ui.connectionFailureAlert();
    }
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
    var jid = user + '@' + config.xmpp.domain + '/' + this.createResourceName();
    console.log("Connecting as", jid, pass);
    this.connection.connect(jid, pass, this.eventConnectCallback);
  },

  pres: function() {
    return $pres({from:this.connection.jid});
  },

  msg : function() {
    return $msg({
      from: this.connection.jid,
      to:   this.currentRoomJid,
      type: 'groupchat'
    });
  },

  announce: function() {
    this.connection.send(this.pres());
  },

  createResourceName: function() {
    return 'strophe/' + hex_sha1(""+Math.random()).substr(0,4);
  },

  parseJid: function(jid) {
    var r = /^(([^@]+)@)?([^\/]+)(\/(.+))?/.exec(jid);
    addr = {node: r[2], domain: r[3], resource: r[5]};
    return addr;
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

  changeRoom: function(room) {
    if (this.currentRoom) {
      this.leaveRoom(this.currentRoomJid);
    }
    this.currentRoom = room;
    this.currentRoomJid = room + '@' + config.xmpp.muc_service;
    this.joinRoom(this.currentRoomJid);
  },

  leaveRoom: function(roomJid) {
    ui.messageClear();
    ui.userClear();
    this.roster = {};
    this.rosterReceived = false;
    this.connection.send(this.pres()
      .attrs({to:roomJid + '/' + this.currentNick, type:'unavailable'})
    );
  },

  joinRoom: function(roomJid) {
    this.connection.send(this.pres()
      .attrs({to:roomJid + '/' + this.currentNick})
      .c('x', {xmlns:Strophe.NS.MUC})
    );
  },

  sendMessage: function(html, text) {
    this.connection.send(this.msg()
      .c('body', text).up()
      .c('html', {xmlns:Strophe.NS.XHTML_IM})
      .c('body', {xmlns:Strophe.NS.XHTML}).cnode($('<p>'+html+'</p>')[0])
    );
  },

  eventDiscoverRooms: function() {
    var self = this;
    return function() {
      self.connection.sendIQ(
        $iq({
          to:config.xmpp.muc_service,
          type:'get'
        })
        .c('query', {xmlns:Strophe.NS.DISCO_ITEMS}),
        function(stanza) {
          var rooms = {};
          $('item', stanza).each(function(s,t) {
            t = $(t);
            rooms[t.attr('jid').match(/^[^@]+/)[0]] = t.attr('name');
          });
          if (self.rooms != rooms) {
            self.rooms = rooms;
            ui.refreshRooms(self.rooms);
            if (!self.currentRoom || !rooms[currentRoom])
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
        var from = $(stanza).attr('from');
        var user, fullJid;
        var item = $(stanza).find('item');
        if (item.attr('role')) {
          extra = {
            jid: item.attr('jid'),
            role: item.attr('role'),
            affiliation: item.attr('affiliation'),
          };
          if ($('status', stanza).attr('code') == 110) {
            self.rosterReceived = true;
            extra.jid = self.jid;
          }
          user = self.registerParticipant(from, extra.jid);
          user.role = extra.role;
          user.affiliation = extra.affiliation;
        }
        else {
          user = self.identifyJid(from);
        }
        var exit = $(stanza).attr('type') == 'unavailable';
        var available = ['away', 'dnd', 'xa'].indexOf($('show', stanza).text()) < 0;
        var status = exit ? 'offline' : (available ? 'online' : 'away');
        if (user.inroom) {
          ui.userStatus(user, status, self.rosterReceived);
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
            body = ajaxChat.render(body);
          }
          var time = $('delay', stanza).attr('stamp');
          time = time ? new Date(time) : new Date();
          ui.messageAdd(user, time, body);
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
      ui.messageAddInfo('XMPP: ' + msg);
      if (self.status == 'online') {
        self.announce();
        self.discoverRooms();
      }
      else if (self.status == 'offline') {
        ui.connectionFailureAlert();
      }
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
    this.setStatus('offline')
  }
}
