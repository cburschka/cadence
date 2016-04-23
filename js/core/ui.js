/**
 * ui.js contains all functions that alter the user interface.
 */
var ui = {
  userLinks: {},
  sortedNicks: [],
  dom: null,
  userStatus: {},
  messages: [],
  colorPicker: null,
  autoScroll: true,
  sounds: {},
  urlFragment: window.location.hash,

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
        settings: $('#settingsContainer'),
      },
      emoticonSidebarContainer: $('#emoticonSidebarContainer'),
      emoticonTrayContainer: $('#emoticonTrayContainer'),
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

    // Build help sidebar.
    var helpSidebar = $('#helpList');
    var categories = strings.help.sidebar;
    for (var category in categories) {
      var table = $('<table>');
      table.append($('<caption>').append($('<h4>').text(categories[category].title)));
      var commands = categories[category].commands;
      for (var command in commands) {
        var row = $('<tr class="row">').append(
          $('<td class="desc">').text(commands[command][0]),
          $('<td class="code">').text(commands[command][1])
        );
        table.append(row);
      }
      helpSidebar.append(table);
    }

    // Build the navigation menu.
    for (link in config.ui.navigation)
      $('#navigation ul').append($('<li>').append(
        $('<a>').attr('href', config.ui.navigation[link]).text(link)
      ));
    if (config.ui.navigation) $('#navigation').css('display', 'inline-block');

    // Build and fill the emoticon containers.
    var bars = config.ui.emoticonSidebars
    for (var set in bars) {
      this.dom.menu['emoticon-' + set] = $('<div class="menuContainer emoticon-sidebar box"></div>')
        .attr('id', 'emoticon-' + set)
        .append($('<h3></h3>').text(bars[set].title))
        .append($('<div class="emoticon-list-sidebar" dir="ltr"></div>')
          .attr('id', 'emoticonsList-' + set)
        )
        .appendTo(this.dom.emoticonSidebarContainer);

      $('<button class="tray icon toggleMenu">')
        .attr('id', 'emoticon-' + set + 'Button')
        .attr('title', bars[set].title)
        .text(bars[set].title)
        .css('background-image', 'url(' + encodeURI(config.markup.emoticons[set].baseURL + bars[set].icon) + ')')
        .appendTo(this.dom.emoticonTrayContainer);
    }
    for (var set in config.markup.emoticons) {
      var list = $('#emoticonsList-' + set);
      for (var code in config.markup.emoticons[set].codes) {
        list.append($('<a class="insert-text"></a>')
          .attr('href', "javascript:void('" + code.replace(/'/g, '\\\'') + "');")
          .attr('title', code)
          .append($('<img />')
            .attr('src', config.markup.emoticons[set].baseURL + config.markup.emoticons[set].codes[code])
            .attr('alt', code)
          )
        );
      }
    }

    // Build the color palette picker.
    var palette = $('#colorCodesContainer');
    for (var color in config.markup.colorCodes) {
      var code = config.markup.colorCodes[color]
      palette.append($('<a class="colorCode"></a>')
        .attr('href', "javascript:void('" + code.replace(/'/g, '\\\'') + "');")
        .attr('title', code)
        .css('background-color', code)
      );
    }
    palette.append('<button class="button" id="textColorFull" class="string" data-string="label.button.advanced"></button>');

    var sounds = [$('<option value="" class="string" data-string="label.page.none">')];
    for (var sound in this.sounds) sounds.push(new Option(sound, sound));
    $('#settingsContainer select.soundSelect').append(sounds).after(function() {
      var event = this.id.substring('settings-notifications.sounds.'.length);
      return $('<button class="icon soundTest">').click(() => { ui.playSound(event); });
    });

    // Set the form values.
    $('#settingsContainer .settings').val(function() {
      return chat.getSetting(this.id.substring('settings-'.length));
    });
    this.setTextColorPicker(config.settings.textColor);
    $('#settingsContainer input.settings[type="checkbox"]').prop('checked', function() {
      return chat.getSetting(this.id.substring('settings-'.length));
    });
    $('#settings-notifications\\.triggers').val(config.settings.notifications.triggers.join(', '));

    // Open the last active sidebar.
    if (!this.dom.menu[config.settings.activeMenu]) {
      config.settings.activeMenu = 'onlineList';
    }
    this.toggleMenu(config.settings.activeMenu, true);

    // Set the volume.
    chat.setAudioVolume(config.settings.notifications.soundVolume);

    $('#audioButton').toggleClass('off', !config.settings.notifications.soundEnabled);

    ui.loadStrings();
  },

  loadStrings: function() {
    // Fill strings.
    $('.string').text(function() {
      return ui.getString($(this).attr('data-string'));
    });
    $('.string-html').html(function() {
      return ui.getString($(this).attr('data-html'));
    })
    $('.string-title').attr('title', function() {
      return ui.getString($(this).attr('data-title'));
    });

    // Add the access key labels to the BBCode buttons.
    $('#bbCodeContainer button').each(function() {
      if (this.accessKeyLabel) this.title = this.title + ' (' + this.accessKeyLabel + ')';
    });
  },

  /**
   * Initialize the event listeners.
   */
  initializeEvents: function() {
    // Make all links on the static page open in new tabs.
    visual.linkOnClick(document);

    // Inserting BBCode tags.
    var insertBBCode = (tag, arg) => {
      arg = arg ? '=' + arg : '';
      var v = ['[' + tag + arg + ']', '[/' + tag + ']'];
      chat.insertText(v);
      return true;
    };

    // The input field listens for <return>, <up>, <down> and BBCodes.
    this.dom.inputField.on({
      keypress: this.onKeyMap({
        //  9: <tab>
         9: () => { return this.autocomplete(); },
        // 13: <return> (unless shift is down)
        13: (e,x) => {
          if (!e.shiftKey) {
            chat.executeInput($(x).val())
            $(x).val('');
            return true;
          }
        },
        // 38: <arrow-up> (if the field is empty, or ctrl is down)
        38: (e,x) => { return (e.ctrlKey || !$(x).val()) && chat.historyUp(); },
        // 40: <arrow-down> (if ctrl is down)
        40: (e) => { return e.ctrlKey && chat.historyDown(); },

        // 98, 105, 117, 117: b,i,s,u
        98: (e) => { return e.ctrlKey && insertBBCode('b'); },
        105: (e) => { return e.ctrlKey && insertBBCode('i'); },
        115: (e) => { return e.ctrlKey && insertBBCode('s'); },
        117: (e) => { return e.ctrlKey && insertBBCode('u'); },
      }),
      // after any keystroke, update the message length counter.
      keyup: () => { this.updateMessageLengthCounter(); }
    });

    // The room selection menu listens for changes.
    this.dom.roomSelection.change(function() {
      if (this.value != xmpp.room.current) {
        if (this.value) chat.commands.join({name: this.value});
        else chat.commands.part();
      }
    });
    $(window).on('hashchange', () => {
      if (this.urlFragment != window.location.hash) {
        this.urlFragment = window.location.hash;
        if (this.urlFragment) chat.commands.join({
          name: this.getFragment()
        });
        else chat.commands.part();
      }
    });

    // Log in with the button or pressing enter.
    this.dom.loginContainer.submit((e) => {
      chat.commands.connect({user: $('#loginUser').val(), pass: $('#loginPass').val()});
      e.preventDefault();
    });
    $('#trayContainer button.toggleMenu').click(function() {
      ui.toggleMenu(this.id.substring(0, this.id.length - 'Button'.length));
    });

    // BBCode buttons.
    $('.insert-text').click(function() { chat.insertText(this.title); });
    $('.insert-bbcode').click(function() {
      if ($(this).hasClass('insert-bbcode-arg')) {
        var arg = prompt('This BBCode tag requires an argument:', '');
        if (!arg) return;
      }
      insertBBCode(this.value.toLowerCase(), arg || '');
    });

    // Open the color tray.
    $('#colorBBCode').click(() => {
      this.colorPicker = this.colorPicker != 'bbcode' ? 'bbcode' : null;
      $('#textColorFull').css('display', 'none');
      this.dom.colorCodesContainer[this.colorPicker == 'bbcode' ? 'fadeIn' : 'fadeOut'](500);
    });
    $('#textColor').click(() => {
      $('#textColorFull').css('display', 'block');
      if (config.settings.fullColor && config.settings.textColor != '') {
        $('#settings-textColor').click();
      }
      else {
        this.colorPicker = this.colorPicker != 'setting' ? 'setting' : null;
        this.dom.colorCodesContainer[this.colorPicker == 'setting' ? 'fadeIn' : 'fadeOut'](500);
      }
    });

    // The color tray has two modes (setting and bbcode).
    $('.colorCode').click(function() {
      if (ui.colorPicker == 'bbcode') {
        insertBBCode('color', this.title);
        $('#colorBBCode').click();
      }
      else if (ui.colorPicker == 'setting') {
        config.settings.fullColor = false;
        $('#textColor').click();
        $('#settings-textColor').val(this.title).change();
      }
    });

    // Toggle the full RGB color setting.
    $('#textColorFull').click(() => {
      $('#textColor').click();
      config.settings.fullColor = true;
      $('#settings-textColor').click();
    });
    // Clear the text color setting.
    $('#textColorClear').click(() => {
      config.settings.fullColor = false;
      chat.setSetting('textColor', '');
      this.setTextColorPicker('');
    });
    $('#settings-textColor').change(function() {
      ui.setTextColorPicker($(this).val())
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
    $('#settings-notifications\\.triggers').change(function() {
      var value = this.value.trim();
      value = value ? value.split(/[\s,;]+/) : [];
      chat.setSetting(this.id.substring('settings-'.length), value);
    });

    // If notifications are activated, ensure they can be sent.
    $('#settings-notifications\\.desktop').change(function() {
      if (this.value == 0) return;
      if (Notification.permission == 'default')
        Notification.requestPermission((permission) => {
          // If denied, revert the setting.
          if (permission != 'granted') $(this).val(0).change();
        });
      else if (Notification.permission == 'denied')
        $(this).val(0).change();
    }).change();

    // Attempt to maintain the scroll position when changing message heights.
    var toggler = (selector) => {
      // Find the message at the top of the viewport...
      var i = this.getMessageAt(this.dom.chatList.prop('scrollTop'));
      $(selector).toggle();
      this.updateHeights();
      if (i) {
        // ... and scroll to it again (snap to bottom if appropriate).
        this.dom.chatList.prop('scrollTop', this.messages[i].offset);
        this.scrollDown();
      }
    };
    $('#settings-markup\\.images').change(() => {
      toggler('img.rescale, span.image-alt');
    });
    $('#settings-markup\\.emoticons').change(() => {
      toggler('img.emoticon, span.emote-alt');
    });
    $('#settings-markup\\.colors').change(function() {
      if (this.checked) visual.addColor(ui.dom.chatList);
      else visual.removeColor(ui.dom.chatList);
      ui.dom.inputField.css('color', this.checked && config.settings.textColor || '');
    });
    $('#settings-markup\\.links').change(function() {
      $('.url-link').replaceWith(this.checked ? function() {
        return $('<a class="url-link"></a>').attr('href', $(this).text()).text($(this).text());
      } : function() {
        return $('<span class="url-link"></span>').text($(this).text());
      });
    });

    // Instantly apply sound volume.
    $('.soundVolume').change(function() {
      chat.setAudioVolume(this.value);
    });

    // Instantly apply date format.
    $('#settings-dateFormat').change(function() {
      var format = $(this).val();
      $('.time').text(function() {
        const t = $(this).attr('data-time');
        return moment(t).utcOffset(t).format(format);
      });
    });

    // /quit button.
    $('#logoutButton').click(() => { chat.commands.quit(); });

    $('#audioButton').click(function() {
      var audio = !config.settings.notifications.soundEnabled;
      chat.setSetting('notifications.soundEnabled', audio);
      $(this).toggleClass('off', !audio);
    });

    // scrolling up the chat list turns off auto-scrolling.
    this.dom.chatList.scroll(() => {
      this.checkAutoScroll();
      return true;
    });

    var usermenu = {
      selector: '.user:not(.user-role-bot)',
      className: 'box dialog',
      trigger: config.settings.contextmenu,
      delay: 700, // only applies to hover.
      build: this.userContextMenu
    };
    $.contextMenu(usermenu);

    var roommenu = {
      selector: '.xmpp-room',
      className: 'box dialog',
      trigger: config.settings.contextmenu,
      delay: 700,
      build: this.roomContextMenu
    };
    $.contextMenu(roommenu);

    $('#settings-contextmenu').change(function() {
      usermenu.trigger = this.value;
      roommenu.trigger = this.value;
      $.contextMenu('destroy', '.user:not(.user-role-bot)');
      $.contextMenu('destroy', '.xmpp-room');
      $.contextMenu(usermenu);
      $.contextMenu(roommenu);
    });
    $('#settingsList').tabs();
  },

  /**
   * Build the context menu for a user.
   * @param {jq} user The user element.
   */
  userContextMenu: function(user) {
    const c = (cmd) => { return chat.cmdAvailableStatus(cmd, true) };
    const labels = strings.label.command;
    const roster = xmpp.roster[xmpp.room.current]
    const userSelf = roster && roster[xmpp.nick.current];
    const nick = user.attr('data-nick');
    const jid = xmpp.JID.parse(user.attr('data-jid'));

    const mod = userSelf && userSelf.role == 'moderator';
    const ranks = {none: 0, member: 1, admin: 2, owner: 3};
    const rank = userSelf && ranks[userSelf.affiliation];
    const outranked = rank < ranks[user.attr('data-affiliation')];

    const items = {
      msg: {
        name: labels.msg,
        icon: 'msg',
        disabled: !c('msg') || !nick || !roster[nick], // disabled if user is not room occupant.
        callback: () => { chat.prefixMsg(nick); }
      },
      dmsg: {
        name: labels.dmsg,
        icon: 'msg',
        disabled: !c('dmsg') || !jid, // disabled if user is anonymous.
        callback: () => { chat.prefixMsg(jid, true); }
      },
      sep1: '---',
      invite: {
        name: labels.invite,
        icon: 'invite',
        // disabled on anonymous users, or users who are already in the room.
        disabled: !c('invite') || !jid || (nick && roster[nick] && jid.bare() == roster[nick].jid.bare()),
        callback: () => { chat.commands.invite({jid}); }
      },
      kick: {
        name: labels.kick,
        icon: 'leave',
        // disabled for non-mods, or higher affiliation, or absent users or yourself.
        disabled: !c('kick') || !mod || outranked || !nick || !roster[nick] || nick == xmpp.nick.current,
        callback: () => { chat.commands.kick(nick); }
      },
      ban: {
        name: labels.ban,
        icon: 'destroy',
        // disabled for non-admins, or higher affiliation, or anonymous users or yourself.
        disabled: !c('ban') || rank < 2 || outranked || !jid || jid.bare() == xmpp.currentJid.bare(),
        callback: () => { chat.commands.ban({jid}); }
      },
      sep2: '',
      whois: {
        name: labels.whois,
        icon: 'whois',
        disabled: !c('whois') || !nick || !roster[nick],
        callback: () => { chat.commands.whois(nick); }
      },
      ping: {
        name: labels.ping,
        icon: 'ping',
        disabled: !c('ping'),
        callback: () => { chat.commands.ping(nick ? {nick} : {jid}); }
      }
    }

    return {items, autoHide: config.settings.contextmenu == 'hover'};
  },

  /**
   * Build the context menu for a room.
   */
  roomContextMenu: function(element) {
    var c = (cmd) => { return chat.cmdAvailableStatus(cmd, true) };
    var labels = strings.label.command;
    var room = element.attr('data-room');
    var currentRoom = xmpp.room.current == room;
    var self = xmpp.roster[xmpp.room.current] && xmpp.roster[xmpp.room.current][xmpp.nick.current];
    var owner = currentRoom && self.affiliation == 'owner';
    var items = {
      join: {
        name: labels.join,
        icon: 'join',
        disabled: !c('join') || currentRoom,
        callback: () => { chat.commands.join({name: room}); }
      },
      part: {
        name: labels.part,
        icon: 'leave',
        disabled: !c('part') || !currentRoom,
        callback: chat.commands.part
      },
      configure: {
        name: labels.configure,
        icon: 'configure',
        disabled: !c('configure') || currentRoom && !owner, // can only see authorization inside.
        callback: () => { chat.commands.configure({name: room, interactive: true}); }
      },
      destroy: {
        name: labels.destroy,
        icon: 'destroy',
        disabled: !c('destroy') || currentRoom && !owner,
        callback: () => { chat.commands.destroy({room}); }
      }
    }
    return {items, autoHide: config.settings.contextmenu == 'hover'};
  },

  /**
   * Instantly delete the entire message log.
   */
  clearMessages: function() {
    this.messages = [];
    xmpp.historyEnd = {};
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
    $('#textColor')
      .css('color', color || '')
      .text(color || strings.label.settings.textColor.none)
      .toggleClass('string', !color)
      .css('background-color', color ? visual.hex2rgba(color, 0.3) : '');
    this.dom.inputField.css('color', config.settings.markup.colors && color || '');
    $('#settings-textColor').val(color);
    $('#textColorClear').css('display', color ? 'inline-block' : 'none');
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

    this.dom.chatList.animate({right : width + 'px'}, speed, () => {
      var maxWidth = this.dom.chatList.width() - 30;
      var maxHeight = this.dom.chatList.height() - 20;
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
   * Create a form out of an XMPP data form stanza.
   *
   * @param {jq} x The <x/> element containing the form fields.
   * @param {function} submit The callback that the completed form values will be sent to.
   * @return {jq} The HTML form.
   */
  dataForm: function(x, submit) {
    var fields = {};
    var input = (field) => {
      return $('<input/>').attr('name', field.attr('var'));
    };
    fields.hidden = (field) => {
      return input(field).attr('type', 'hidden')
        .attr('value', $('value', field).text());
    };
    fields['boolean'] = (field) => {
      return input(field).attr('type', 'checkbox')
        .prop('checked', $('value', field).text() == '1');
    };
    fields['text-single'] = (field) => {
      return input(field).attr('type', 'text')
        .attr('value', $('value', field).text());
    };
    fields['text-private'] = fields['text-single'];
    fields['jid-single'] = fields['text-single'];
    fields['text-multi'] = (field) => {
      var values = $.makeArray($('value', field).map(function() { return $(this).text(); }));
      return $('<textarea class="form-field">').attr('name', field.attr('var'))
        .text(values.join("\n"));
    };
    fields['jid-multi'] = (field) => {
      return fields['text-multi'](field).attr('title', strings.label.tip.multiline);
    };
    fields['list-single'] = (field) => {
      var f = $('<select>').attr('name', field.attr('var'));
      var value = field.children('value').text();
      $('option', field).each(function() {
        var v = $('value', this).text();
        f.append($('<option></option>').attr('value', v)
          .text($(this).attr('label'))
          .prop('selected', value == v)
        );
      });
      return f;
    };
    fields['list-multi'] = (field) => {
      return fields['list-single'](field).prop('multiple', true);
    };
    fields['fixed'] = (field) => {
      return $('<p>').text($('value', field).text());
    };

    val = (field) => { return field.val(); };
    var values = {};
    values['boolean'] = (field) => { return field.prop('checked') ? "1" : "0"; };
    values.hidden = val;
    values['text-single'] = val;
    values['text-private'] = val;
    values['jid-single'] = val;
    values['text-multi'] = (field) => { return val(field).split("\n"); };
    values['jid-multi'] = values['text-multi'];
    values['list-single'] = val;
    values['list-multi'] = val;
    values['fixed'] = () => { return undefined; };

    var form = $('<form class="data-form">').attr('title', $('title', x).text());
    x.children('field').each(function() {
      var type = $(this).attr('type');
      var field = fields[type]($(this)).addClass('data-form-field').attr('data-type', type).uniqueId();
      var label = $('<label>').attr('for', field.attr('id')).text($(this).attr('label'));
      form.append($('<div class="row">').append(label, field, '<br>'));
    });
    form.submit((e) => {
      e.preventDefault();
      var v = {};
      $('.data-form-field', form).each(function() {
        v[$(this).attr('name')] = values[$(this).attr('data-type')]($(this));
      });
      submit(v);
    });
    return form;
  },

  /**
   * Generate a dialog from a form.
   * By default, the dialog will have three buttons: Save, Apply, and Close.
   * Save will trigger the form's submit() event and close the dialog.
   * Apply will trigger the form's submit() event.
   * Close will close the dialog.
   *
   * @param form The form element.
   * @param {cancel, apply} Extra form actions.
   */
  formDialog: function(form, {cancel, apply}={}) {
    const buttons = [
      {
        text: strings.label.button.save,
        click: function() { form.submit(); $(this).dialog('destroy') }
      },
      {
         text: strings.label.button.close,
         click: function() { cancel && cancel(); $(this).dialog('destroy'); }
      }
    ];

    if (apply || apply === undefined) buttons.push({
      text: strings.label.button.apply,
      click: function() { form.submit(); }
    });

    form.dialog({
      dialogClass: 'box dialog',
      height: 0.8*$(window).height(),
      width: Math.min(0.75*$(window).width(), 600),
      buttons
    });
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
    var error = false;

    // Suppress verbose messages.
    if (0 <= (' ' + classes + ' ').indexOf(' verbose ')) {
      if (!config.settings.verbose) return;
    }
    else if (0 <= (' ' + classes + ' ').indexOf(' error ')) {
      this.playSound('error');
      error = true;
    }

    var body = visual.formatText(text, variables);
    var message = {
      body: body, type: 'local',
      user: config.ui.chatBotName && {
        nick: config.ui.chatBotName,
        role: 'bot',
        affiliation: 'bot'
      }
    };
    this.notifyDesktop(error ? 1 : 3, message);
    message = visual.formatMessage(message, true);
    message.html.find('.body').addClass(classes).addClass('message-bot');
    this.messageAppend(message);
    return message;
  },

  /**
   * Append a delayed (room history) message.
   *
   * @param {Object} message. Must have user, time, room and body keys.
   */
  messageDelayed: function(message) {
    var entry = visual.formatMessage(message);
    entry.html.addClass('delayed')
      .find('.dateTime').after(' ', $('<span class="log-room"></span>')
        .addClass(message.room && ('log-room-' + message.room.id))
        .text('[' + (message.room ? message.room.title : strings.label.page.offline) + ']')
      );
    this.messageInsert(entry);
  },

  /**
   * Insert a (rendered) message at an arbitrary point (using the timestamp).
   *
   * This is only used for delayed messages.
   */
  messageInsert: function(message) {
    var c = this.messages.length;
    if (c == 0 || message.timestamp > this.messages[c-1].timestamp) {
      return this.messageAppend(message);
    }
    for (var i = 0; i < c; i++) {
      if (message.timestamp < this.messages[i].timestamp) {
        message.offset = this.messages[i].offset;
        this.messages[i].html.before(message.html);
        this.messages.splice(i, 0, message);
        break;
      }
    }

    $(message.html).css({display:'block'});
    this.updateHeights(i);
    this.scrollDown();
  },

  /**
   * Append a rendered message to the end of the chat list.
   */
  messageAppend: function(message) {
    message.offset = this.dom.chatList.prop('scrollHeight');
    this.messages.push(message);
    this.dom.chatList.append(message.html);
    $(message.html).fadeIn(() => { this.scrollDown(); });
    this.scrollDown();
  },

  /**
   * Refresh the room selection menu.
   */
  refreshRooms: function(rooms) {
    var room = this.dom.roomSelection.val();
    $('option', this.dom.roomSelection).remove();
    var options = [new Option('---', '')];
    for (var id in rooms) {
      options.push(new Option(rooms[id].title, id));
    }
    this.dom.roomSelection.html(options).val(room);
  },

  /**
   * Add a user to the online list.
   */
  userAdd: function(user, animate) {
    var userLink = $('<div class="row">').append(
      $('<span class="user-roster">').append(visual.format.user(user))
    );

    visual.msgOnClick(userLink);

    if (user.nick == xmpp.nick.current) {
      $('span.user-roster', userLink).addClass('user-self');
      this.dom.onlineList.find('span.user-self').removeClass('user-self');
    }

    if (!this.userLinks[user.nick]) {
      for (var i = 0; i < this.sortedNicks.length; i++)
        if (user.nick.toLowerCase() < this.sortedNicks[i].toLowerCase())
          break;
      if (i < this.sortedNicks.length)
        userLink.insertBefore(this.userLinks[this.sortedNicks[i]]);
      else
        userLink.appendTo(this.dom.onlineList);
      this.sortedNicks.splice(i, 0, user.nick);
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
      for (var i = 0; i < this.sortedNicks.length; i++) {
        if (this.sortedNicks[i] == user.nick) {
          this.sortedNicks.splice(i, 1);
          break;
        }
      }
      delete this.userLinks[user.nick];
    }
  },

  /**
   * Get the room from the URL fragment.
   *
   * @returns {string}
   */
  getFragment: function() {
    return decodeURIComponent(this.urlFragment.substring(1));
  },


  /**
   * Set the URL fragment to a room.
   *
   * @param {string} room
   */
  setFragment: function(room) {
    ui.urlFragment = '#' + encodeURIComponent(room || '');
    window.location.hash = ui.urlFragment;
  },

  /**
   * Remove the online list with a new roster, and set the room selection menu.
   */
  updateRoom: function(room, roster) {
    this.title = (room ? xmpp.room.available[room].title + ' - ' : '') + config.ui.title;
    $(document).attr('title', this.title);

    var self = this;
    this.dom.roomSelection.val(room);
    // If no roster is given, only update the menu.
    if (!roster) return;
    this.dom.onlineList.slideUp(function() {
      $(this).html('');
      self.userLinks = {};
      self.userStatus = {};
      self.sortedNicks = [];
      for (var nick in roster) {
        self.userAdd(roster[nick], false);
      }
      $(this).slideDown();
    });
  },

  /**
   * Recalculate the vertical positions of all messages.
   *
   * @start (optional) the first offset to recalculate.
   */
  updateHeights: function(start) {
    var offset = ui.messages[start-1] ? ui.messages[start-1].offset : 0;
    for (var i = start || 1; i < ui.messages.length; i++) {
      offset += ui.messages[i].html.height();
      ui.messages[i].offset = offset;
    }
  },

  /**
   * Find the message at a given offset in the history via binary search.
   *
   * @return the index of the first message starting after the offset.
   */
  getMessageAt: function(offset) {
    var a = 0;
    var b = ui.messages.length - 1;
    if (b < 0) return null;
    while (a + 1 < b) {
      var c = (a + b) / 2 | 0;
      if (ui.messages[c].offset < offset) a = c;
      else b = c;
    }
    return b;
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
      var c = e.which || e.keyCode;
      if (callbacks[c] && callbacks[c](e, this)) {
        try {
          e.preventDefault();
        } catch(ex) {
          e.returnValue = false;
        }
        return false;
      }
      return true;
    };
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
    if (xmpp.userStatus == 'dnd') return;
    var sound = config.settings.notifications.sounds[event];
    return sound && this.sounds[sound] && (this.sounds[sound].play() || true);
  },

  /**
   * Trigger the correct message sound and desktop notification.
   * Only one sound is played, in order:
   * 1. keyword alert, 2. /msg, 3. sender alert, 4. incoming.
   * The first applicable, enabled sound will be played.
   */
  notify: function(message) {
    const text = message.body.text();
    const name = message.user.nick || message.user.jid.bare() || '';

    let mention = (text.indexOf(xmpp.nick.current) >= 0
                || text.indexOf(xmpp.user) >= 0);
    let sender = false;
    for (let trigger of config.settings.notifications.triggers) {
      mention = mention || (0 <= text.indexOf(trigger));
      sender = sender || (0 <= name.indexOf(trigger));
    }

    // Any kind of alert is level 1, everything else is 2.
    this.notifyDesktop(((mention || message.type == 'chat' || sender) ? 1 : 2), message);

    if (mention && this.playSound('mention')) return;
    if (message.type != 'groupchat' && this.playSound('msg')) return;
    if (sender && this.playSound('mention')) return;
    this.playSound('receive');

    if (!message.user.jid.equals(xmpp.currentJid)) {
      const sender = message.user.nick || message.user.jid.bare();
      this.blinkTitle(sender);
    }
  },

  /**
   * Generate a desktop notification.
   *
   * @param {int} level: The verbosity level of the notification:
   *                     - 1: Private messages & mentions
   *                     - 2: Other messages
   *                     - 3: Join/part notifications
   * @param {Object} message: The message object.
   */
  notifyDesktop: function(level, message) {
    if (xmpp.userStatus == 'dnd') return;
    if (document.hidden) return;
    if (level > config.settings.notifications.desktop) return;

    let body = $(message.body).text();
    let sender = message.user.nick || message.user.jid.bare();
    let title = sender;

    if (message.type != 'direct') {
      title = xmpp.room.available[xmpp.room.current].title;
      if (message.type != 'local') {
        if (message.type != 'groupchat')
          body = strings.info.whisper + ' ' + body;
        body = sender + ': ' + body;
      }
    }

    return new Notification(title, {body, tag: xmpp.room.current});
  },

  /**
   * Blink.
   */
  blinkTitle: function(string) {
    window.clearInterval(this.blinker);
    string = string ? string + ' - ' : '';
    var speed = config.settings.notifications.blinkSpeed; // faster than you would believe.
    var delay = Math.ceil(1000 / speed);
    var number = Math.ceil(1000 * config.settings.notifications.blinkLength / delay);
    if (!number) return;
    var state = false;
    this.blinker = window.setInterval(() => {
      if (!number) {
        $(document).attr('title', ui.title);
        return window.clearInterval(ui.blinker);
      }
      $(document).attr('title', (state ? '[@ ] ' : '[ @] ') + string + ui.title);
      state = !state;
      number--;
    }, delay);
  },

  /**
   * Autocomplete partial nicknames or commands with Tab.
   */
  autocomplete: function() {
    // Search algorithm for the longest common prefix of all matching strings.
    var prefixSearch = (prefix, words) => {
      var results = [];
      for (var i in words) {
        if (words[i].substring(0, prefix.length) == prefix) {
          results.push(words[i]);
        }
      }
      if (results.length > 1) {
        var result = results[0];
        // For each match, cut down to the longest common prefix.
        for (var i in results) {
          for (var j in results[i]) {
            if (result[j] != results[i][j]) {
              result = result.substring(0, j);
              break;
            }
          }
          result = result.substring(0, results[i].length);
        }
        results = result ? [result] : [];
      }
      if (results.length == 1) {
        return results[0];
      }
      else return '';
    };

    var inputField = this.dom.inputField;
    inputField.focus();
    var start = inputField[0].selectionStart;
    var end = inputField[0].selectionEnd;
    if (start != end) return false;
    var old = inputField.val();
    var prefix = old.substring(0, start).match(/(^|\s)((\S|\\\s)*)$/)[2];

    // Look for commands or nicknames.
    if (prefix[0] == '/') {
      var result = '/' + prefixSearch(prefix.substring(1), Object.keys(chat.commands).concat(Object.keys(config.settings.macros)));
    }
    else {
      var result = prefixSearch(prefix, Object.keys(this.userLinks));
    }
    if (result.length > prefix.length) {
      inputField.val(old.substring(0, start - prefix.length) + result + old.substring(start, old.length));
      inputField[0].selectionStart = start - prefix.length + result.length;
      inputField[0].selectionEnd = inputField[0].selectionStart;
    }
    return true;
  },

  getString: function(key) {
    var path = key.split('.');
    var ref = strings;
    for (var i = 0; i < path.length; i++) {
      ref = ref[path[i]];
    }
    return ref;
  }
};
