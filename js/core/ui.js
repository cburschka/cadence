var ui = {
  userLinks: {},
  dom: null,
  userStatus: {},
  messages: [],
  messageId: 0,
  messageHash: {},
  colorPicker: null,

  init: function() {
    this.dom = {
      loginContainer: $('#loginContainer'),
      channelContainer: $('#channelContainer'),
      colorCodesContainer: $('#colorCodesContainer'),
      inputField: $('#inputField'),
      content: $('#content'),
      chatList: $('#chatList'),
      onlineList: $('#onlineList'),
      channelSelection: $('#channelSelection'),
      statusIcon: $('#statusIcon'),
      autoScrollIcon: $('#autoScrollIcon'),
      messageLengthCounter: $('#messageLengthCounter'),
      menu: {
        help: $('#helpContainer'),
        onlineList: $('#onlineListContainer'),
        ponicon: $('#poniconContainer'),
        settings: $('#settingsContainer'),
      }
    };
    this.initializePage();
    this.initializeEvents();
  },

  initializePage: function() {
    for (var set in config.markup.emoticons) {
      var html = '';
      for (var code in config.markup.emoticons[set].codes) {
        html += '<a href="javascript:void(\'' + code.replace('\'', '\\\'', 'g')
             +  '\');" class="insert-text" title="'
             + code + '">' + '<img src="' + config.markup.emoticons[set].baseURL
             + config.markup.emoticons[set].codes[code] + '" alt="'
             + code + '" /></a>';
      }
      $('#emoticonsList-' + set).html(html);
    }
    var html = '';
    for (var color in config.markup.colorCodes) {
      var code = config.markup.colorCodes[color]
      html += '<a href="javascript:void(\'' + code + '\');" title="' + code
           +  '" class="colorCode" style="background-color:' + code + '"></a>';
    }
    $('#colorCodesContainer').html(html);

    var options = '', links = '';
    for (var i in config.ui.css) {
      options += '<option value="' + config.ui.css[i] + '">' + config.ui.css[i] + '</option>';
      links += '<link class="alternate-style" rel="alternate stylesheet" type="text/css" href="'
            + config.ui.cssURL + config.ui.css[i] + '.css" title="' + config.ui.css[i] + '" />';
    }
    $('#styleSelection').html(options).val(config.settings.activeStyle);
    this.dom.styleSheets = $(links).appendTo('head');
    this.dom.styleSheets.last().load(function() {
      ui.setStyle(config.settings.activeStyle);
      $('#nocontent').fadeOut('slow');
      $('#content').fadeIn('slow');
    });
    $('#settingsContainer input.settings').val(function() {
      return chat.getSetting(this.id.substring('settings-'.length));
    });
    if (config.settings.textColor) {
      $('#settings-textColor')
        .css('color', config.settings.textColor)
        .text(config.settings.textColor)
        .css('background-color', visual.hex2rgba(config.settings.textColor, 0.3));
      this.dom.inputField.css('color', config.settings.textColor);
      $('#settings-textColorClear').css('display', 'inline-block');
    }
    $('#settingsContainer input.settings[type=checkbox]').prop('checked', function() {
      return chat.getSetting(this.id.substring('settings-'.length));
    });
    this.toggleMenu(config.settings.activeMenu, true);
  },

  initializeEvents: function() {
    this.dom.inputField.on({
      keypress: this.onEnterKey(function(x) {
        chat.executeInput($(x).val());
        $(x).val('');
      }),
      keyup: this.eventInputKeyUp()
    });
    this.dom.channelSelection.change(function() { chat.commands.join(this.value); });

    var loginCallback = function() {
      chat.commands.connect({user: $('#loginUser').val(), pass: $('#loginPass').val()});
    };
    $('#loginButton').click(loginCallback);
    $('#loginPass, #loginUser').keypress(this.onEnterKey(loginCallback));
    $('#trayContainer .button.toggleMenu').click(function() {
      ui.toggleMenu(this.id.substring(0, this.id.length - 'Button'.length));
    });

    var insertBBCode = function(tag, arg) {
      arg = arg ? '=' + arg : '';
      var v = ['[' + tag + arg + ']', '[/' + tag + ']'];
      chat.insertText(v);
    };

    $('.insert-text').click(function() { chat.insertText(this.title); });
    $('.insert-bbcode').click(function() {
      if (!arg && ($(this).hasClass('insert-bbcode-arg')))
        arg = prompt('This BBCode tag requires an argument:', '');
      insertBBCode(this.value, arg);
    });

    $('#colorBBCode').click(function() {
      ui.colorPicker = ui.colorPicker != 'bbcode' ? 'bbcode' : null;
      ui.dom.colorCodesContainer[ui.colorPicker == 'bbcode' ? 'fadeIn' : 'fadeOut'](500);
    });
    $('#settings-textColor').click(function() {
      ui.colorPicker = ui.colorPicker != 'setting' ? 'setting' : null;
      ui.dom.colorCodesContainer[ui.colorPicker == 'setting' ? 'fadeIn' : 'fadeOut'](500);
    });
    $('.colorCode').click(function() {
      if (ui.colorPicker == 'bbcode') {
        insertBBCode('color', this.title);
        $('#colorBBCode').click();
      }
      else if (ui.colorPicker == 'setting') {
        if (!config.settings.textColor) $('#settings-textColorClear').fadeIn();
        $('#settings-textColor').click()
        .css('color', this.title).text(this.title)
        .css('background-color', visual.hex2rgba(this.title, 0.3));
        ui.dom.inputField.css('color', this.title);
        chat.setSetting('textColor', this.title);
      }
    });
    $('#settings-textColorClear').click(function() {
      chat.setSetting('textColor', null);
      $('#settings-textColor')
        .text('None')
        .css('color', '').text('None')
        .css('background-color', '');
      ui.dom.inputField.css('color', '');
      $(this).fadeOut();
    });
    $('#styleSelection').change(
      function() { ui.setStyle($(this).val()); }
    );
    $('#settingsContainer input.settings').change(function() {
      var value = this.type == 'checkbox' ? this.checked : this.value;
      chat.setSetting(this.id.substring('settings-'.length), value);
    });
    $('#logoutButton').click(function() {
      chat.commands.quit();
    });

    this.dom.chatList.scroll(function() {
      ui.checkAutoScroll();
    });
  },

  setStatus: function(status) {
    // status options are: online, waiting, offline.
    this.dom.statusIcon.attr('class', status).attr('title');
    this.dom.loginContainer[status == 'online' ? 'hide' : 'show'](500);
  },

  setStyle: function(style) {
    config.settings.activeStyle = style;
    this.dom.styleSheets.each(function() {
      this.disabled = this.title != style;
    });
    chat.saveSettings();
  },

  toggleMenu: function(newMenu, init) {
    var oldMenu = init ? null : config.settings.activeMenu;
    if (oldMenu) this.dom.menu[oldMenu].animate({width: 'hide'}, 'slow');

    var width = 20;
    if (oldMenu != newMenu) {
      var px = this.dom.menu[newMenu].css('width');
      width += parseInt(px.substring(0,px.length-2)) + 8;
    }

    this.dom.chatList.animate({right : width + 'px'}, 'slow', function() {
      var maxWidth = ui.dom.chatList.width() - 30;
      var maxHeight = ui.dom.chatList.height() - 20;
      $('img.rescale').each(function() { visual.rescale($(this), maxWidth, maxHeight); });
    });

    if (oldMenu != newMenu) {
      this.dom.menu[newMenu].animate({width: 'show'}, 'slow');
      config.settings.activeMenu = newMenu;
    }
    else config.settings.activeMenu = null;
    chat.saveSettings();
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
    message.html.find('.body').addClass(classes);
    this.messageAppend(message);
    return message;
  },

  messageDelayed: function(message) {
    var entry = visual.formatMessage(message);
    if (!this.messageHash[entry.hash]) {
      this.messageHash[entry.hash] = true;
      entry.html.addClass('delayed');
      entry.html.find('.dateTime').after(' <span class="log-room log-room-' + message.room + '">[' + message.room + ']</span> ');
      this.messageInsert(entry);
    }
  },

  messageInsert: function(message) {
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

  userAdd: function(user, animate) {
    if (!this.userLinks[user.nick]) {
      this.userLinks[user.nick] = $('<div class="row">' + visual.formatUser(user) + '</div>'),
      this.dom.onlineList.append(this.userLinks[user.nick]);
      if (animate) this.userLinks[user.nick].slideDown(1000);
      else this.userLinks[user.nick].css('display', 'block');
    }
  },

  userRemove: function(user) {
    if (this.userLinks[user.nick]) {
      this.userLinks[user.nick].slideUp(1000).remove();
      delete this.userLinks[user.nick];
    }
  },

  updateRoom: function(room, roster) {
    var self = this;
    this.dom.channelSelection.val(room);
    this.dom.onlineList.slideUp(function() {
      $(this).html('');
      self.userLinks = {};
      self.userStatus = {};
      for (nick in roster) {
        self.userAdd(roster[nick], false);
      }
      $(this).slideDown();
    });
  },

  onEnterKey: function(callback) {
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
    if(this.autoScroll) {
      this.dom.chatList.animate({scrollTop: $('#chatList').prop('scrollHeight')}, 500);
    }
  },

  checkAutoScroll: function() {
    var chatListHeight = parseInt($(this.dom.chatList).css('height'));
    var autoScroll = this.dom.chatList.scrollTop() + chatListHeight == this.dom.chatList.prop('scrollHeight');
    if (this.autoScroll != autoScroll) {
      this.autoScroll = autoScroll;
      this.dom.autoScrollIcon.attr('class', autoScroll ? 'on' : 'off');
    }
  }
};