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
    this.discoverRooms = this.eventDiscoverRooms();
    this.initializeConnection();
  },

  initializeConnection: function() {
    /* TODO: strophe can attach to an existing BOSH session.
      can we use this to somehow unify forum/chat sessions? */
    this.connection = new Strophe.Connection(config.xmpp.boshURL);

    // DEBUG: print connection stream to console:
    //this.connection.rawInput = function(data) { console.log("RECV " + data) }
    //this.connection.rawOutput = function(data) { console.log("SEND " + data) }
    this.resource = this.createResourceName();
    this.jid = config.xmpp.user + '@' + config.xmpp.domain + '/' + this.resource;
    this.currentNick = config.xmpp.user;
    this.connection.addHandler(this.eventPresenceCallback(), null, 'presence');
    this.connection.addHandler(this.eventMessageCallback(), null, 'message');
    this.connection.addTimedHandler(30000, this.discoverRooms);
    this.connection.connect(this.jid, config.xmpp.pass, this.eventConnectCallback());
  },

  pres: function() {
    return $pres({from:this.jid});
  },

  msg : function() {
    return $msg({
      from: this.jid,
      to:   this.currentRoomJid,
      type: 'groupchat'
    });
  },

  announce: function() {
    this.connection.send(this.pres());
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

  createResourceName: function() {
    return 'strophe/' + hex_sha1(""+Math.random()).substr(0,4);
  },

  parseJid: function(jid) {
    var r = /^(([^@]+)@)?([^\/]+)(\/(.+))?/.exec(jid);
    addr = {node: r[2], domain: r[3], resource: r[5]};
    return addr;
  },

  registerFullJid: function (jidMuc, jidFull) {
    var addrMuc = this.parseJid(jidMuc);
    var addrFull = this.parseJid(jidFull);
    var user = {
      inroom: true,
      nick: addrMuc.resource,
      user: addrFull.node,
      domain: addrFull.domain,
      client: addrFull.resource,
      local: addrFull.domain == config.xmpp.domain
    };
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

  eventPresenceCallback: function() {
    var self = this;
    return function(stanza) {
      if (stanza) {
        stanza = $(stanza);
        var from = stanza.attr('from');
        var fullJid = $('item', stanza).attr('jid');
        var user;
        var isMe = $('status', stanza).attr('code') == 110;
        if (isMe) {
          self.rosterReceived = true;
          user = self.registerFullJid(from, self.jid);
        }
        else if (fullJid) {
          user = self.registerFullJid(from, fullJid);
        }
        else {
          user = self.identifyJid(from);
        }
        var exit = stanza.attr('type') == 'unavailable';
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
      ui.messageAddInfo(msg);
      if (self.status == 'online') {
        self.announce();
        self.discoverRooms();
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
