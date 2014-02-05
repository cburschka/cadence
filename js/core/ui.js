/**
 * ui.js contains all functions that alter the user interface.
 *
 * @author Christoph Burschka <christoph@burschka.de>
 * @year 2014
 * @license GPL3+
 */
var ui = {
  userLinks: {},
  dom: null,
  userStatus: {},
  messages: [],
  messageId: 0,
  messageHash: {},
  colorPicker: null,
  autoScroll: true,
  sounds: {},

  /**
   * Initialize the module:
   * - store references to frequently accessed DOM elements.
   * - build dynamically generated elements, and set form values.
   * - initialize event listeners.
   */
  init: function() {
    this.dom = {
      loginContainer: $('#loginContainer'),
      roomContainer: $('#roomContainer'),
      colorCodesContainer: $('#colorCodesContainer'),
      inputField: $('#inputField'),
      content: $('#content'),
      chatList: $('#chatList'),
      onlineList: $('#onlineList'),
      roomSelection: $('#roomSelection'),
      statusIcon: $('#statusIcon'),
      autoScrollIcon: $('#autoScrollIcon'),
      messageLengthCounter: $('#messageLengthCounter'),
      menu: {
        help: $('#helpContainer'),
        onlineList: $('#onlineListContainer'),
        ponicon: $('#poniconContainer'),
        settings: $('#settingsContainer'),
      },
      styleSheets: $('link.alternate-style'),
    };
    this.title = $(document).attr('title');
    this.loadSounds();
    this.initializePage();
    this.initializeEvents();
  },

  /**
   * Load the sound files.
   */
  loadSounds: function() {
    for (var i in config.sounds) {
      var sound = config.sounds[i];
      this.sounds[sound] = new buzz.sound(config.soundURL + sound, {formats: ['ogg', 'mp3'], preload: true});
    }
  },

  /**
   * Create dynamic page elements.
   */
  initializePage: function() {
    this.setStyle(config.settings.activeStyle);
    // Build the emoticon containers.
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

    // Build the color palette picker.
    var html = '';
    for (var color in config.markup.colorCodes) {
      var code = config.markup.colorCodes[color]
      html += '<a href="javascript:void(\'' + code + '\');" title="' + code
           +  '" class="colorCode" style="background-color:' + code + '"></a>';
    }
    $('#colorCodesContainer').html(html);

    var sounds = [new Option('---', '')];
    for (var sound in this.sounds) sounds.push(new Option(sound, sound));
    $('#settingsContainer select.soundSelect').html(sounds);

    // Set the form values.
    $('#settingsContainer .settings').val(function() {
      return chat.getSetting(this.id.substring('settings-'.length));
    });
    this.setTextColorPicker(config.settings.textColor);
    $('#settingsContainer input.settings[type=checkbox]').prop('checked', function() {
      return chat.getSetting(this.id.substring('settings-'.length));
    });

    // Open the last active sidebar.
    this.toggleMenu(config.settings.activeMenu, true);

    // Set the volume.
    chat.setAudioVolume(config.settings.notifications.soundVolume);

    $('#audioButton').toggleClass('off', !config.settings.notifications.soundEnabled);
  },

  /**
   * Initialize the event listeners.
   */
  initializeEvents: function() {

    // The input field listens for three keystrokes.
    this.dom.inputField.on({
      keypress: this.onKeyMap({
        // 13: <enter> (unless shift is down)
        13: function(e,x) {
          if (!e.shiftKey) {
            chat.executeInput($(x).val())
            $(x).val('');
            return true;
          }
        },
        // 38: <arrow-up> (if the field is empty, or ctrl is down)
        38: function(e,x) { return (e.ctrlKey || !$(x).val()) && chat.historyUp(); },
        // 40: <arrow-down> (if ctrl is down)
        40: function(e) { return e.ctrlKey && chat.historyDown(); }
      }),
      // after any keystroke, update the message length counter.
      keyup: function() { ui.updateMessageLengthCounter(); }
    });

    // The room selection menu listens for changes.
    this.dom.roomSelection.change(function() {
      if (this.value) chat.commands.join(this.value);
      else chat.commands.part();
    });

    // Log in with the button or pressing enter.
    var loginCallback = function() {
      chat.commands.connect({user: $('#loginUser').val(), pass: $('#loginPass').val()});
    };
    $('#fakeLoginForm').submit(function(e) {
      loginCallback();
      e.preventDefault();
    });
    $('#loginPass, #loginUser').keypress(this.onKeyMap({13:loginCallback}));
    $('#trayContainer button.toggleMenu').click(function() {
      ui.toggleMenu(this.id.substring(0, this.id.length - 'Button'.length));
    });

    // Inserting BBCode tags.
    var insertBBCode = function(tag, arg) {
      arg = arg ? '=' + arg : '';
      var v = ['[' + tag + arg + ']', '[/' + tag + ']'];
      chat.insertText(v);
    };
    $('.insert-text').click(function() { chat.insertText(this.title); });
    $('.insert-bbcode').click(function() {
      if ($(this).hasClass('insert-bbcode-arg'))
        var arg = prompt('This BBCode tag requires an argument:', '');
      insertBBCode(this.value.toLowerCase(), arg || '');
    });

    // Open the color tray.
    $('#colorBBCode').click(function() {
      ui.colorPicker = ui.colorPicker != 'bbcode' ? 'bbcode' : null;
      ui.dom.colorCodesContainer[ui.colorPicker == 'bbcode' ? 'fadeIn' : 'fadeOut'](500);
    });
    $('#settings-textColor').click(function() {
      ui.colorPicker = ui.colorPicker != 'setting' ? 'setting' : null;
      ui.dom.colorCodesContainer[ui.colorPicker == 'setting' ? 'fadeIn' : 'fadeOut'](500);
    });

    // The color tray has two modes (setting and bbcode).
    $('.colorCode').click(function() {
      if (ui.colorPicker == 'bbcode') {
        insertBBCode('color', this.title);
        $('#colorBBCode').click();
      }
      else if (ui.colorPicker == 'setting') {
        $('#settings-textColor').click();
        ui.setTextColorPicker(this.title);
        chat.setSetting('textColor', this.title);
      }
    });

    // Clear the text color setting.
    $('#settings-textColorClear').click(function() {
      chat.setSetting('textColor', null);
      ui.setTextColorPicker(null);
    });

    // Listen for changes in the style menu.
    $('#styleSelection').change(
      function() { ui.setStyle($(this).val()); }
    ).val(config.settings.activeStyle);

    // Instantly save changed settings in the cookie.
    $('#settingsContainer .settings').change(function() {
      var value = this.type == 'checkbox' ? this.checked : this.value;
      chat.setSetting(this.id.substring('settings-'.length), value);
    });

    // Instantly apply sound volume.
    $('.soundVolume').change(function() {
      chat.setAudioVolume(this.value);
    });

    // /quit button.
    $('#logoutButton').click(function() {
      chat.commands.quit();
    });

    $('#audioButton').click(function() {
      var audio = !config.settings.notifications.soundEnabled;
      chat.setSetting('notifications.soundEnabled', audio);
      $(this).toggleClass('off', !audio);
    });

    // scrolling up the chat list turns off auto-scrolling.
    this.dom.chatList.scroll(function() {
      ui.checkAutoScroll();
      return true;
    });
  },

  /**
   * Instantly delete the entire message log.
   */
  clearMessages: function() {
    this.messages = [];
    this.messageId = 0;
    this.messageHash = {};
    this.dom.chatList.html('');
  },

  /**
   * Change the connection status:
   * - unset the online list when leaving a room.
   * - change the status icon.
   * - toggle between login form and room selection menu.
   */
  setStatus: function(status) {
    // status options are: online, waiting, offline, prejoin.
    if (status != 'online') ui.updateRoom('', {});
    if (status == 'prejoin') status = 'online';
    this.dom.statusIcon.attr('class', status).attr('title');
    this.dom.loginContainer[status == 'online' ? 'fadeOut' : 'fadeIn'](500);
    this.dom.roomContainer[status == 'online' ? 'fadeIn' : 'fadeOut'](500);
  },

  /**
   * Change the active stylesheet.
   */
  setStyle: function(style) {
    config.settings.activeStyle = style;
    this.dom.styleSheets.prop('disabled', 'disabled');
    this.dom.styleSheets
      .filter(function() { return this.title == style; })
      .removeAttr('disabled');
    chat.saveSettings();
  },

  /**
   * This changes the value and appearance of the persistent color button.
   */
  setTextColorPicker: function(color) {
    $('#settings-textColor')
      .css('color', color || '')
      .text(color || 'None')
      .css('background-color', color ? visual.hex2rgba(color, 0.3) : '');
    this.dom.inputField.css('color', color || '');
    $('#settings-textColorClear').css('display', color ? 'inline-block' : 'none');
  },

  /**
   * Close the active sidebar and (if needed) open a different one.
   */
  toggleMenu: function(newMenu, init) {
    var speed = init ? 0 : 'slow';
    var oldMenu = init ? null : config.settings.activeMenu;
    if (oldMenu) this.dom.menu[oldMenu].animate({width: 'hide'}, 'slow');

    var width = 20;
    if (oldMenu != newMenu) {
      var px = this.dom.menu[newMenu].css('width');
      width += parseInt(px.substring(0,px.length-2)) + 8;
    }

    this.dom.chatList.animate({right : width + 'px'}, speed, function() {
      var maxWidth = ui.dom.chatList.width() - 30;
      var maxHeight = ui.dom.chatList.height() - 20;
      $('img.rescale').each(function() { visual.rescale($(this), maxWidth, maxHeight); });
    });

    if (oldMenu != newMenu) {
      this.dom.menu[newMenu].animate({width: 'show'}, speed);
      config.settings.activeMenu = newMenu;
    }
    else config.settings.activeMenu = null;
    chat.saveSettings();
  },

  /**
   * Create an informational message.
   * The first two arguments are passed straight to visual.formatText().
   *
   * @param {string} text The message to display (should be in strings.js)
   * @param {Object} variables (optional) The variables to insert into the text.
   * @param {string} classes (optional) Any classes (space-separated) to add.
   *                 The common ones are verbose (message will be suppressed if
   *                 verbosity is off) or error (message will be colored red).
   */
  messageAddInfo: function(text, variables, classes) {
    // If the second argument is a string, we skipped the variables.
    if (!classes && typeof variables == 'string') {
      classes = variables;
      variables = false;
    }

    // Suppress verbose messages.
    if (0 <= (' ' + classes + ' ').indexOf(' verbose ')) {
      if (!config.settings.verbose) return;
    }
    else if (0 <= (' ' + classes + ' ').indexOf(' error ')) {
      this.playSound('error');
    }

    text = visual.formatText(text, variables);
    var message = visual.formatMessage({
      body: text,
      user: {nick: config.ui.chatBotName, role: 'bot', affiliation: 'bot'}
    });
    message.html.find('.body').addClass(classes).addClass('message-bot');
    this.messageAppend(message);
    return message;
  },

  /**
   * Append a delayed (room history) message.
   * If the message hash already exists, ignore it. This is to prevent rooms
   * from readding their history when rejoining without clearing the screen.
   *
   * @param {Object} message. Must have user, time, room, body and hash keys.
   */
  messageDelayed: function(message) {
    var entry = visual.formatMessage(message);
    if (!this.messageHash[entry.hash]) {
      this.messageHash[entry.hash] = true;
      entry.html.addClass('delayed');
      entry.html.find('.dateTime').after(
          ' <span class="log-room log-room-' + message.room.id + '">['
        + visual.format.room(message.room)
        + ']</span>'
      );
      this.messageInsert(entry);
    }
  },

  /**
   * Insert a (rendered) message at an arbitrary point (using the timestamp).
   *
   * This is only used for delayed messages.
   */
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

  /**
   * Append a rendered message to the end of the chat list.
   */
  messageAppend: function(message) {
    this.messageHash[message.hash] = true;
    this.messages.push(message);
    this.dom.chatList.append(message.html);
    $(message.html).fadeIn(function() {
      ui.scrollDown();
    });
    this.scrollDown();
    if (message.message.user.nick != xmpp.nick.current)
    	this.blinkTitle(message.message.user.nick);
  },

  /**
   * Refresh the room selection menu.
   */
  refreshRooms: function(rooms) {
    var room = this.dom.roomSelection.val();
    $('option', this.dom.roomSelection).remove();
    var options = [new Option('---', '')];
    for (id in rooms) {
      options.push(new Option(rooms[id].title, id));
    }
    this.dom.roomSelection.html(options).val(room);
  },

  /**
   * Add a user to the online list.
   */
  userAdd: function(user, animate) {
    var userLink = $('<div class="row">' + visual.format.user(user) + '</div>');

    if (!this.userLinks[user.nick]) {
      userLink.appendTo(this.dom.onlineList);
      if (animate) userLink.slideDown(1000);
    }
    else userLink.replaceAll(this.userLinks[user.nick])
    userLink.css('display', 'block');
    this.userLinks[user.nick] = userLink;
  },

  /**
   * Remove a user from the online list.
   */
  userRemove: function(user) {
    if (this.userLinks[user.nick]) {
      this.userLinks[user.nick].slideUp(1000).remove();
      delete this.userLinks[user.nick];
    }
  },

  /**
   * Remove the online list with a new roster, and set the room selection menu.
   */
  updateRoom: function(room, roster) {
    var self = this;
    this.dom.roomSelection.val(room);
    // If no roster is given, only update the menu.
    if (!roster) return;
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

  /**
   * Helper function: Route a keystroke to a callback function.
   *
   * @param {Object} callbacks. Functions for each keycode to listen for.
   *                 Should return true if the event should be terminated.
   * @return true if the event should be terminated.
   */
  onKeyMap: function(callbacks) {
    return function(e) {
      if (callbacks[e.keyCode] && callbacks[e.keyCode](e, this)) {
        try {
          e.preventDefault();
        } catch(ex) {
          e.returnValue = false;
        }
        return false;
      }
      return true;
    }
  },

  /**
   * Recalculate the input field length, and update the counter.
   * When a maximum length is set, count down to it.
   */
  updateMessageLengthCounter: function() {
    var length = this.dom.inputField.val().length;
    if (config.ui.maxMessageLength) {
      var content = (config.ui.maxMessageLength - length);
      this.dom.messageLengthCounter.css('color', content < 0 ? 'red' : '');
      this.dom.messageLengthCounter.text(content);
    }
    else this.dom.messageLengthCounter.text(this.dom.inputField.val().length);
  },

  /**
   * Scroll to the bottom of the chat list if autoscrolling is enabled.
   */
  scrollDown: function() {
    // Only autoscroll if we are at the bottom.
    if(this.autoScroll) {
      this.autoScrolled = true;
      this.dom.chatList[0].scrollTop = this.dom.chatList[0].scrollHeight;
      this.autoScrolled = false;
    }
  },

  /**
   * Recalculate auto-scrolling mode: If the user initiated the scroll event
   * (determined by this.autoScrolled being false), and the view is >=1/3 of
   * a screen from the bottom (magic number), then auto-scrolling should
   * be disabled.
   */
  checkAutoScroll: function() {
    if (this.autoScrolled) return;
    var chatListHeight = parseInt($(this.dom.chatList).css('height'));
    var autoScroll = this.dom.chatList.scrollTop() + 1.3*chatListHeight >= this.dom.chatList.prop('scrollHeight');
    if (this.autoScroll != autoScroll) {
      this.autoScroll = autoScroll;
      this.dom.autoScrollIcon.attr('class', autoScroll ? 'on' : 'off');
    }
  },

  /**
   * Trigger a particular sound event.
   */
  playSound: function(event) {
    if (!config.settings.notifications.soundEnabled || !config.settings.notifications.soundVolume)
      return;
    var sound = config.settings.notifications.sounds[event];
    if (sound && this.sounds[sound]) this.sounds[sound].play();
  },

  /**
   * Blink.
   */
  blinkTitle: function(string) {
    window.clearInterval(this.blinker);
    string = string ? ' ' + string + ' - ' : '';
    var speed = config.settings.notifications.blinkSpeed; // faster than you would believe.
    var delay = Math.ceil(1000 / speed);
    var number = Math.ceil(1000 * config.settings.notifications.blinkLength / delay);
    if (!number) return;
    var state = false;
    this.blinker = window.setInterval(function() {
      if (!number) {
        $(document).attr('title', ui.title);
        return window.clearInterval(ui.blinker);
      }
      $(document).attr('title', (state ? '[@ ]' : '[ @]') + string + ui.title);
      state = !state;
      number--;
    }, delay);
  }
};
