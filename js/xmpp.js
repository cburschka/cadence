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

  initialize: function() {
    this.discoverRooms = this.eventDiscoverRooms();
    this.initializeConnection();
  },

  initializeConnection: function() {
    /* TODO: strophe can attach to an existing BOSH session.
      can we use this to somehow unify forum/chat sessions? */
    this.connection = new Strophe.Connection(config.xmpp.boshURL);

    // DEBUG: print connection stream to console:
    this.connection.rawInput = function(data) { console.log("RECV " + data) }
    this.connection.rawOutput = function(data) { console.log("SEND " + data) }
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
      console.log("Sending query for rooms.");
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
          console.log(rooms);
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
    // TODO: Do this properly.
    return 'strophe/' + hex_sha1(""+Math.random()).substr(0,4);
  },

  getUserName: function(muc_jid) {
    if (this.currentRoomJid && muc_jid.substr(0,this.currentRoomJid.length+1) == this.currentRoomJid + '/') {
      return muc_jid.substr(this.currentRoomJid.length + 1);
    }
  },

  changeRoom: function(room) {
    if (this.currentRoom) {
      this.leaveRoom(this.currentRoomJid);
    }
    ui.messageClear();
    ui.userClear();
    this.rosterReceived = false;
    this.currentRoom = room;
    this.currentRoomJid = room + '@' + config.xmpp.muc_service;
    this.joinRoom(this.currentRoomJid);
  },

  leaveRoom: function(roomJid) {
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
        var user = self.getUserName($(stanza).attr('from'));
        if (user) {
          console.log('Handling presence from nick ' + user);
          if ($(stanza).attr('type') == 'unavailable') {
            ui.userRemove(user);
          }
          else {
            ui.userAdd(user);
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
        var user = self.getUserName($(stanza).attr('from'));
        if (user) {
          var body = null;
          var html = $('html body p', stanza).html();
          if (html) {
            body = html;
          } else {
            body = $($('body', stanza)[0]).text();
            console.log(body);
            body = ajaxChat.render(body);
            console.log(body);
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
