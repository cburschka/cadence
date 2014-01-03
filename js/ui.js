var ui = {
  userLinks: {},
  dom: null,
  roster: {},
  chatListHeight: null,

  initialize: function() {
    this.dom = {
      content: $('#content'),
      chatList: $('#chatList'),
      onlineList: $('#onlineList'),
      channelSelection: $('#channelSelection'),
      statusIconContainer: $('#statusIconContainer'),
      styleSheets: $('link').filter(function() {
        return $(this).attr('rel').indexOf('style') >= 0;
      })
    };

    this.chatListHeight = parseInt($(this.dom.chatList).css('height'));
    this.setStatus('offline');
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

  messageAdd: function(user, time, text) {
    this.chatListAppend(
      '<div class="row"><span class="dateTime">' + this.formatTime(time) + '</span> ' +
      '<span class="user">' + this.formatUser(user) + ':</span> ' +
      text + '</div>'
    );
  },

  messageAddInfo: function(text) {
    this.chatListAppend(
      '<div class="row"><span class="dateTime">' + this.formatTime() + '</span> ' +
      '<span class="chatBot user">' + config.ui.chatBotName + ':</span> ' +
      '<span style="font-style:italic">' + text + '</span></div>'
    );
  },

  messageClear: function() {
    this.dom.chatList.html('');
  },

  chatListAppend: function(text) {
    // Only autoscroll if we are at the bottom.
    var scrolledDown = this.dom.chatList.scrollTop() + this.chatListHeight == this.dom.chatList.prop('scrollHeight');
    this.dom.chatList.append(text);
    if(config.settings.autoScroll && scrolledDown) {
      this.dom.chatList.scrollTop(this.dom.chatList.prop('scrollHeight'));
    }
  },

  refreshRooms: function(rooms) {
    options = this.dom.channelSelection.html('').prop('options');
    for (id in rooms) {
      options[options.length] = new Option(rooms[id], id);
    }
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
    for (x in this.userLinks) {
      this.userLinks[x].remove();
    }
    this.userLinks = {};
  },

  formatUser: function(user) {
    nick_exists = user.nick != '';
    show_jid = user.user + (!user.local ? '@'+user.domain : '');

    return '<span class="user-role-' + user.role +
           ' user-affiliation-' + user.affiliation + '">' +
           (nick_exists ?
             ('<span class="user-jid user-alt-jid">' + show_jid + '</span>' +
             '<span class="user-nick user-alt-nick">' + user.nick + '</span>') :
             '<span class="user-jid">' + show_jid + '</span>'
           ) + '</span>'
  },

  setSetting: function(setting, value) {
    config.settings[setting] = value;
    if (setting == 'displayJid') {
      this.dom.content.toggleClass('display-jid', value)
    }
  }
}
