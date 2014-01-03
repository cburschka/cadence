var ui = {
  userLinks: [],
  dom: null,

  initialize: function() {
    this.dom = {
      chatList: $('#chatList'),
      onlineList: $('#onlineList'),
      channelSelection: $('#channelSelection'),
      statusIconContainer: $('#statusIconContainer'),
      styleSheets: $('link').filter(function() {
        return $(this).attr('rel').indexOf('style') >= 0;
      })
    };
    //preload the Alert icon (it can't display if there's no connection unless it's cached!)
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
      '<span class="user">' + user + ':</span> ' + 
      text + '</div>'
    );
  },

  messageAddInfo: function(text) {
    this.chatListAppend(
      '<div class="row"><span class="dateTime">' + this.formatTime() + '</span> ' + 
      '<span class="chatBot user">INFO:</span> ' + 
      text + '</div>'
    );
  },

  messageClear: function() {
    this.dom.chatList.html('');
  },

  chatListAppend: function(text) {
    // Only autoscroll if we are at the bottom.
    var scrolledDown = this.dom.chatList.scrollTop + this.chatListHeight == this.dom.chatList.scrollHeight;
    this.dom.chatList.append(text);
    if(config.settings.autoScroll && scrolledDown) {
      this.dom.chatList.scrollTop = this.dom.chatList.scrollHeight;    
    }
  },

  refreshRooms: function(rooms) {
    options = this.dom.channelSelection.html('').prop('options');
    for (id in rooms) {
      options[options.length] = new Option(rooms[id], id);
    }
  },

  userStatusChange: function(user, status) {
    this.messageAddInfo(config.ui.userStatus[status].replace('%s', user));
  }

  userAdd: function(user) {
    if (!this.userLinks[user]) {
      this.userLinks[user] = $(config.ui.userLink.replace('%s', user));
      this.dom.onlineList.append(this.userLinks[user]);
    }
  },

  userRemove: function(user) {
    if (this.userLinks[user]) {
      this.userLinks[user].remove();
      this.userLinks[user] = null;
    }
  },

  userClear: function() {
    for (x in this.userLinks) {
      this.userLinks[x].remove();
    }
    this.userLinks = [];
  },
}
