var ui = {
  userLinks: {},
  dom: null,
  userStatus: {},
  chatListHeight: null,
  messages: [],
  messageId: 0,
  messageHash: {},
  activeMenu: 'onlineList',

  initialize: function() {
    this.dom = {
      loginContainer: $('#loginContainer'),
      channelContainer: $('#channelContainer'),
      inputField: $('#inputField'),
      content: $('#content'),
      chatList: $('#chatList'),
      onlineList: $('#onlineList'),
      channelSelection: $('#channelSelection'),
      statusIconContainer: $('#statusIconContainer'),
      messageLengthCounter: $('#messageLengthCounter'),
      styleSheets: $('link').filter(function() {
        return $(this).attr('rel').indexOf('style') >= 0;
      }),
      menu: {
        help: $('#helpContainer'),
        onlineList: $('#onlineListContainer'),
        ponicon: $('#poniconContainer'),
        settings: $('#settingsContainer'),
      }
    };

    this.dom.inputField.on({
      keypress: this.enter(function(x) {
        chat.executeInput($(x).val());
        $(x).val('');
      }),
      keyup: this.eventInputKeyUp()
    });

    this.dom.channelSelection.change(function(e) {
      xmpp.changeRoom($(e.target).val());
    });

    this.dom.channelContainer.hide();

    var loginCallback = function() {
      chat.commands.connect({user: $('#loginUser').val(), pass: $('#loginPass').val()});
    };
    $('#loginButton').click(loginCallback);
    $('#loginPass, #loginUser').keypress(this.enter(loginCallback));

    $('#optionsContainer .button.toggleMenu').click(function() {
      ui.toggleMenu(this.id.substring(0, this.id.length - 'Button'.length));
    });

    $('input.setting').change(function() {
      config.settings[this.id.substring(0, this.id.length - 'Setting'.length)] = this.checked;
    }).prop('checked', function() {
      return config.settings[this.id.substring(0, this.id.length - 'Setting'.length)];
    });

    this.chatListHeight = parseInt($(this.dom.chatList).css('height'));
    this.setStatus('offline');

    for (var set in config.emoticons) {
      var html = '';
      for (var code in config.emoticons[set].codes) {
        html += '<a href="javascript:void" class="insert-text" title="'
             + code + '">' + '<img src="' + config.emoticons[set].baseURL
             + config.emoticons[set].codes[code] + '" alt="'
             + code + '" /></a>';
      }
      $('#emoticonsList-' + set).html(html);
    }
    $('.insert-text').click(function() { chat.insertText(this.title); });
    $('.insert-bbcode').click(function() {
      if ($(this).hasClass('insert-bbcode-arg'))
        var arg = '=' + prompt('This BBCode tag requires an argument:', '');
      else arg = '';
      var v = this.value.toLowerCase();
      v = ['[' + v + arg + ']', '[/' + v + ']'];
      chat.insertText(v);
    });
  },

  setStatus: function(status) {
    // status options are: online, waiting, offline.
    this.dom.statusIconContainer.attr('class', status);
    this.dom.loginContainer[status == 'online' ? 'hide' : 'show'](500);
  },

  setStyle: function(style) {
    if (config.ui.css.indexOf(style) != -1) {
      this.dom.styleSheets.each(function() {
        this.disabled = $(this).attr('title') != style;
      });
    };
  },

  toggleMenu: function(active) {
    if (this.activeMenu) {
      this.dom.menu[this.activeMenu].animate({width: 'hide'}, 'slow');
    }
    var width = 20;
    if (this.activeMenu != active) {
      var px = this.dom.menu[active].css('width');
      width += parseInt(px.substring(0,px.length-2)) + 8;
      this.activeMenu = active;
    }
    else {
      this.activeMenu = null;
    }
    this.dom.chatList.animate({right : width + 'px'}, 'slow', function() {
      var maxWidth = ui.dom.chatList.width() - 30;
      var maxHeight = ui.dom.chatList.height() - 20;
      $('img.rescale').each(function() { visual.rescale($(this), maxWidth, maxHeight); });
    });

    if (this.activeMenu) {
      this.dom.menu[active].animate({width: 'show'}, 'slow');
    }
  },

  messageAddInfo: function(text, variables, classes) {
    if (!classes && typeof variables == 'string') {
      classes = variables;
      variables = false;
    }
    if (0 <= (' ' + classes + ' ').indexOf(' verbose ')) {
      if (!config.settings.verbose) return;
    }
    text = text.replace(/\{([a-z]+)\}/g, function(rep, key) {
      return variables[key] ? visual.textPlain(variables[key]) : rep;
    });
    var message = visual.formatMessage({
      body: text,
      user: {nick: config.ui.chatBotName, role: 'bot', affiliation: 'bot'}
    });
    message.html.find('.user').addClass('user-bot');
    message.html.find('.body').addClass(classes);
    this.messageAppend(message);
    return message;
  },

  messageDelayed: function(message) {
    var entry = visual.formatMessage(message);
    if (!this.messageHash[entry.hash]) {
      this.messageHash[entry.hash] = true;
      entry.html.addClass('delayed');
      entry.html.find('.dateTime').after(' <span class="log-room-' + message.room + '">[' + message.room + ']</span> ');
      this.messageInsert(entry);
    }
  },

  messageInsert: function(message) {
    this.scrolledDown = this.dom.chatList.scrollTop() + this.chatListHeight == this.dom.chatList.prop('scrollHeight');
    var c = this.messages.length;
    if (message.timestamp < this.messages[0].timestamp) {
      this.messages[0].html.before(message.html);
      this.messages = [message].concat(this.messages);
    }
    else for (var i = 1; i <= c; i++) {
      if (i == this.messages.length || message.timestamp < this.messages[i].timestamp) {
        this.messages[i-1].html.after(message.html);
        this.messages.splice(i, 0, message);
        break;
      }
    }

    $(message.html).css({display:'block'});
    this.scrollDown();
  },

  messageAppend: function(message) {
    this.messageHash[message.hash] = true;
    this.scrolledDown = this.dom.chatList.scrollTop() + this.chatListHeight == this.dom.chatList.prop('scrollHeight');
    this.messages[this.messages.length] = message;
    this.dom.chatList.append(message.html);
    $(message.html).fadeIn(function() {
      ui.scrollDown();
    });
    this.scrollDown();
  },

  refreshRooms: function(rooms) {
    var options = this.dom.channelSelection.html('').prop('options');
    var anyRooms = false;
    for (id in rooms) {
      options[options.length] = new Option(rooms[id].title, id);
      anyRooms = true;
    }
    this.dom.channelContainer[anyRooms ? 'show' : 'hide'](500);
  },

  userAdd: function(user) {
    if (!this.userLinks[user.nick]) {
      this.userLinks[user.nick] = $('<div class="row">' + visual.formatUser(user) + '</div>'),
      this.dom.onlineList.append(this.userLinks[user.nick]);
      $('.row', this.dom.onlineList).slideDown(1000);
    }
  },

  userRemove: function(user) {
    if (this.userLinks[user.nick]) {
      this.userLinks[user.nick].remove();
      delete this.userLinks[user.nick];
    }
  },

  userRefresh: function(roster) {
    var self = this;
    this.dom.onlineList.slideUp(function() {
      $(this).html('');
      self.userLinks = {};
      self.userStatus = {};
      for (nick in roster) {
        self.userAdd(roster[nick]);
      }
      $(this).slideDown();
    });
  },

  enter: function(callback) {
    return function(event) {
      // <enter> without shift.
      if(event.keyCode === 13 && !event.shiftKey) {
        callback(this);
        try {
          event.preventDefault();
        } catch(e) {
          event.returnValue = false; // IE
        }
        return false;
      }
      return true;
    }
  },

  eventInputKeyUp: function() {
    var self = this;
    return function(event) {
      self.updateMessageLengthCounter();
    };
  },

  updateMessageLengthCounter: function() {
    this.dom.messageLengthCounter.text(this.dom.inputField.val().length);
  },

  scrollDown: function() {
    // Only autoscroll if we are at the bottom.
    if(config.settings.autoScroll && this.scrolledDown) {
      this.dom.chatList.scrollTop($('#chatList').prop('scrollHeight'));
    }
  }
};
