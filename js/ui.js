var ui = {
  userLinks: {},
  dom: null,
  roster: {},
  chatListHeight: null,

  initialize: function() {
    this.dom = {
      inputField: $('#inputField'),
      content: $('#content'),
      chatList: $('#chatList'),
      onlineList: $('#onlineList'),
      channelSelection: $('#channelSelection'),
      statusIconContainer: $('#statusIconContainer'),
      messageLengthCounter: $('#messageLengthCounter'),
      styleSheets: $('link').filter(function() {
        return $(this).attr('rel').indexOf('style') >= 0;
      })
    };

    this.dom.inputField.on({
      keypress: this.eventInputKeyPress(),
      keyup: this.eventInputKeyUp()
    });

    this.dom.channelSelection.change(function(e) {
      xmpp.changeRoom($(e.target).val());
    });

    $('#channelContainer').hide();

    this.chatListHeight = parseInt($(this.dom.chatList).css('height'));
    this.setStatus('offline');
  },

  connectionFailureAlert: function() {
    this.messageAddInfo('Type /connect &lt;user&gt; &lt;pass&gt; to connect.');
  },

  setStatus: function(status) {
    // status options are: online, waiting, offline.
    this.dom.statusIconContainer.attr('class', status);
  },

  setStyle: function(style) {
    if (config.css.indexOf(style) != -1) {
      this.dom.styleSheets.each(function() {
        this.disabled = $(this).attr('title') != style;
      });
    };
  },

  formatTime: function(time) {
    time = time || (new Date());
    return moment(time).format(config.settings.dateFormat);
  },

  messageAddUser: function(user, body, time) {
    body = visual.renderText(body);
    this.messageAdd('<span class="user">' + this.formatUser(user) + ':</span> ' + body, time);
  },

  messageAddInfo: function(text) {
    this.messageAdd(
      '<span class="user user-bot">' + config.ui.chatBotName + ':</span> ' +
      '<span class="message-bot">' + text + '</span>'
    );
  },

  messageAddSuccess: function(text) {
    this.messageAddInfo('<span class="success">' + text + '</span>');
  },

  messageAddError: function(text) {
    this.messageAddInfo('<span class="error">' + text + '</span>');
  },

  messageAdd: function(text, time) {
    var scrolledDown = this.dom.chatList.scrollTop() + this.chatListHeight == this.dom.chatList.prop('scrollHeight');
    this.dom.chatList.append(
      '<div class="row"><span class="dateTime">' +
      this.formatTime(time) + '</span> ' +
      text + '</div>'
    );
    // Only autoscroll if we are at the bottom.
    if(config.settings.autoScroll && scrolledDown) {
      this.dom.chatList.scrollTop(this.dom.chatList.prop('scrollHeight'));
    }
  },

  messageClear: function() {
    this.dom.chatList.html('');
  },

  refreshRooms: function(rooms) {
    var options = this.dom.channelSelection.html('').prop('options');
    var anyRooms = false;
    for (id in rooms) {
      options[options.length] = new Option(rooms[id], id);
      anyRooms = true;
    }
    $('#channelContainer')[anyRooms ? 'show' : 'hide'](500);
  },

  userStatus: function(user, status, notify) {
    if (status == 'offline' && this.userLinks[user.nick]) {
      this.userRemove(user);
    }
    else if (!this.userLinks[user.nick]) {
      this.userAdd(user);
    }
    if (this.roster[user.nick] != status) {
      if (this.userLinks[user.nick])
        this.userLinks[user.nick].attr('class', 'user-' + status);
      if (notify) {
        if (this.roster[user.nick] == 'away' && status == 'online') msg = 'available';
        else msg = status;
        this.messageAddInfo(config.ui.userStatus[msg].replace(
          '%s', this.formatUser(user)));
      }
      this.roster[user.nick] = status;
    }
  },

  userAdd: function(user) {
    if (!this.userLinks[user.nick]) {
      this.userLinks[user.nick] = $('<div class="row">' + this.formatUser(user) + '</div>'),
      this.dom.onlineList.append(this.userLinks[user.nick]);
    }
  },

  userRemove: function(user) {
    if (this.userLinks[user.nick]) {
      this.userLinks[user.nick].remove();
      this.userLinks[user.nick] = null;
    }
  },

  userClear: function() {
    this.dom.onlineList.hide(500);
    for (x in this.userLinks) {
      this.userLinks[x].remove();
    }
    this.userLinks = {};
    this.roster = {};
    this.dom.onlineList.show(500);
  },

  formatUser: function(user) {
    return '<span class="user-role-' + user.role +
           ' user-affiliation-' + user.affiliation + '" ' +
             (user.jid ? ('title="' + user.jid + '" ') : '') +
              user.nick + '</span>';
  },

  eventInputKeyPress: function() {
    var self = this;
    return function(event) {
      // <enter> without shift.
      if(event.keyCode === 13 && !event.shiftKey) {
        chat.executeInput(self.dom.inputField.val());
        self.dom.inputField.val('');
        try {
          event.preventDefault();
        } catch(e) {
          event.returnValue = false; // IE
        }
        return false;
      }
      return true;
    };
  },

  eventInputKeyUp: function() {
    var self = this;
    return function(event) {
      self.updateMessageLengthCounter();
    };
  },

  updateMessageLengthCounter: function() {
    this.dom.messageLengthCounter.text(this.dom.inputField.val().length);
  }
};
