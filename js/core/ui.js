/**
 * ui.js contains all functions that alter the user interface.
 */
var ui = {
  activeMenu: null,
  roster: {},
  sortedNicks: [],
  dom: null,
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
      roster: $('#roster'),
      roomSelection: $('#roomSelection'),
      statusButton: $('#statusButton'),
      autoScrollIcon: $('#autoScrollIcon'),
      messageLengthCounter: $('#messageLengthCounter'),
      menu: {
        help: $('#helpContainer'),
        roster: $('#rosterContainer'),
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
    for (let sound of config.sounds) {
      this.sounds[sound] = new buzz.sound(config.soundURL + sound, {
        formats: ['ogg', 'mp3'],
        preload: true
      });
    }
  },

  /**
   * Create dynamic page elements.
   */
  initializePage: function() {
    // Build help sidebar.
    const helpSidebar = $('#helpList');
    const categories = strings.help.sidebar;
    for (let key in categories) {
      const table = $('<table>');
      table.append($('<caption>').append($('<h4>').text(categories[key].title)));
      const commands = categories[key].commands;
      for (let key in commands) {
        const row = $('<tr class="row">').append(
          $('<td class="desc">').text(commands[key][0]),
          $('<td class="code">').text(commands[key][1])
        );
        table.append(row);
      }
      helpSidebar.append(table);
    }

    // Build the navigation menu.
    const navigation = config.ui.navigation;
    for (let key in navigation)
      $('#navigation ul').append($('<li>').append(
        $('<a>').attr('href', navigation[key]).text(key)
      ));
    if (navigation) $('#navigation').css('display', 'inline-block');

    // Build and fill the emoticon containers.
    const bars = config.ui.emoticonSidebars
    const emoticons = config.markup.emoticons;
    for (let set in bars) {
      this.dom.menu['emoticon-' + set] = $('<div class="menuContainer emoticon-sidebar box"></div>')
        .attr('id', 'emoticon-' + set)
        .append($('<h3></h3>').text(bars[set].title))
        .append($('<div class="emoticon-list-sidebar" dir="ltr"></div>')
          .attr('id', 'emoticonsList-' + set)
        )
        .appendTo(this.dom.emoticonSidebarContainer);

      $('<button class="tray icon toggleMenu">')
        .attr({
          title: bars[set].title,
          id: 'emoticon-' + set + 'Button',
          'data-sidebar': 'emoticon-' + set,
        })
        .text(bars[set].title)
        .css('background-image', 'url(' + encodeURI(emoticons[set].baseURL + bars[set].icon) + ')')
        .appendTo(this.dom.emoticonTrayContainer);
    }

    for (let set in emoticons) {
      const list = $('#emoticonsList-' + set);
      for (let code in emoticons[set].codes) {
        list.append($('<a class="insert-text"></a>')
          .attr('href', "javascript:void('" + code.replace(/'/g, '\\\'') + "');")
          .attr('title', code)
          .append($('<img />')
            .attr('src', emoticons[set].baseURL + emoticons[set].codes[code])
            .attr('alt', code)
          )
        );
      }
    }

    // Build the color palette picker.
    const palette = $('#colorCodesContainer');
    const colorCodes = config.markup.colorCodes;
    for (let code of colorCodes) {
      palette.append($('<a class="colorCode"></a>')
        .attr('href', "javascript:void('" + code.replace(/'/g, '\\\'') + "');")
        .attr('title', code)
        .css('background-color', code)
      );
    }
    palette.append('<button class="button" id="textColorFull" class="string" data-string="label.button.advanced">');

    const sounds = [$('<option value="" class="string" data-string="label.page.none">')];
    for (let sound in this.sounds) sounds.push(new Option(sound, sound));
    $('#settingsContainer select.soundSelect').append(sounds).after(function() {
      const event = this.id.substring('settings-notifications.sounds.'.length);
      return $('<button class="icon soundTest">').click(() => ui.playSound(event));
    });

    ui.loadStrings();
    ui.toggleMenu(false);
    ui.loadSettings();
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

  loadSettings: function() {
    this.setStyle(config.settings.activeStyle);

    // Set the form values.
    $('.settings').val(function() {
      return Cadence.getSetting(this.id.substring('settings-'.length));
    }).change();
    $('input.settings[type="checkbox"]').prop('checked', function() {
      return Cadence.getSetting(this.id.substring('settings-'.length));
    }).change();
    $('#settings-notifications\\.triggers').val(config.settings.notifications.triggers.join(', '));

    this.setTextColorPicker(config.settings.textColor);
    this.toggleMenu();

    // Set the volume.
    Cadence.setAudioVolume(config.settings.notifications.soundVolume);
    $('#audioButton').toggleClass('off', !config.settings.notifications.soundEnabled);
  },

  /**
   * Initialize the event listeners.
   */
  initializeEvents: function() {
    // Make all links on the static page open in new tabs.
    visual.linkOnClick(document);

    // Inserting BBCode tags.
    const insertBBCode = (tag, arg='') => {
      const open = '[' + tag + (arg && '=' + arg) + ']';
      const close = '[/' + tag + ']';
      Cadence.insertText([open, close]);
      return true;
    };

    // The input field listens for <return>, <up>, <down> and BBCodes.
    this.dom.inputField.on({
      keypress: this.onKeyMap({
        TAB: () => this.autocomplete(),
        RETURN: (e,x) => {
          if (!e.shiftKey) {
            Cadence.executeInput($(x).val())
            $(x).val('');
            return true;
          }
        },

        // Arrow-Up requires Ctrl if any text has been entered.
        UP: (e,x) => ((e.ctrlKey || !$(x).val()) && Cadence.historyUp()),
        DOWN: e => (e.ctrlKey && Cadence.historyDown()),

        b: e => (e.ctrlKey && insertBBCode('b')),
        i: e => (e.ctrlKey && insertBBCode('i')),
        s: e => (e.ctrlKey && insertBBCode('s')),
        u: e => (e.ctrlKey && insertBBCode('u')),
      }),
      // after any keystroke, update the message length counter.
      keyup: () => this.updateMessageLengthCounter(),
    });

    // The room selection menu listens for changes.
    this.dom.roomSelection.change(function() {
      if (this.value != xmpp.room.current) {
        if (this.value) Cadence.execute('join', {name: this.value});
        else Cadence.execute('part');
      }
    });
    $(window).on('hashchange', () => {
      if (this.urlFragment != window.location.hash) {
        this.urlFragment = window.location.hash;
        if (this.urlFragment) Cadence.execute('join', {
          name: this.getFragment()
        });
        else Cadence.execute('part');
      }
    });

    // Log in with the button or pressing enter.
    this.dom.loginContainer.submit(e => {
      Cadence.execute('connect', {
        user: $('#loginUser').val(),
        pass: $('#loginPass').val()
      });
      e.preventDefault();
    });
    $('#trayContainer button.toggleMenu').click(function() {
      const sidebar = this.getAttribute('data-sidebar');
      const oldMenu = config.settings.activeMenu;
      const newMenu = sidebar == oldMenu ? null : sidebar;
      Cadence.setSetting('activeMenu', newMenu);
      ui.toggleMenu();
    });

    // BBCode buttons.
    $('.insert-text').click(function() { Cadence.insertText(this.title); });
    $('.insert-bbcode').click(function() {
      const tag = this.value.toLowerCase();
      if ($(this).hasClass('insert-bbcode-arg')) {
        const arg = prompt(strings.info.promptBBCodeArg);
        if (arg) insertBBCode(tag, arg);
      }
      else insertBBCode(tag);
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
      Cadence.setSetting('textColor', '');
      this.setTextColorPicker('');
    });
    $('#settings-textColor').change(function() {
      ui.setTextColorPicker($(this).val())
    });

    // Listen for changes in the style menu.
    $('#settings-activeStyle').change(function() {
      ui.setStyle($(this).val());
    });

    // Instantly save changed settings in the cookie.
    $('.settings').change(function() {
      let value = this.value;
      if (this.type == 'checkbox') value = this.checked;
      else if ((this.type == 'range' || this.type == 'select') && value === String(parseFloat(value))) value = parseFloat(value);
      Cadence.setSetting(this.id.substring('settings-'.length), value);
    });
    $('#settings-notifications\\.triggers').change(function() {
      let value = this.value.trim();
      value = value ? value.split(/[\s,;]+/) : [];
      Cadence.setSetting(this.id.substring('settings-'.length), value);
    });

    // If notifications are activated, ensure they can be sent.
    $('#settings-notifications\\.desktop').change(function() {
      if (this.value == 0) return;
      if (Notification.permission == 'default')
        Notification.requestPermission(permission => {
          // If denied, revert the setting.
          if (permission != 'granted') $(this).val(0).change();
        });
      else if (Notification.permission == 'denied')
        $(this).val(0).change();
    }).change();

    // Attempt to maintain the scroll position when changing message heights.
    const toggler = selector => {
      // Find the message at the top of the viewport...
      const i = this.getMessageAt(this.dom.chatList.prop('scrollTop'));
      $(selector).toggle();
      this.updateHeights();
      if (i) {
        // ... and scroll to it again (snap to bottom if appropriate).
        this.dom.chatList.prop('scrollTop', this.messages[i].offset);
        this.scrollDown();
      }
    };
    $('#settings-markup\\.images').change(() =>
      toggler('img.rescale, span.image-alt')
    );
    $('#settings-markup\\.emoticons').change(() =>
      toggler('img.emoticon, span.emote-alt')
    );
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
      Cadence.setAudioVolume(this.value);
    });

    // Instantly apply date format.
    $('#settings-dateFormat').change(function() {
      const format = $(this).val();
      $('.time').text(function() {
        const t = $(this).attr('data-time');
        return moment(t).utcOffset(t).format(format);
      });
    });

    // /quit button.
    $('#logoutButton').click(() => Cadence.execute('quit'));

    $('#audioButton').click(function() {
      const audio = !config.settings.notifications.soundEnabled;
      Cadence.setSetting('notifications.soundEnabled', audio);
      $(this).toggleClass('off', !audio);
    });

    // scrolling up the chat list turns off auto-scrolling.
    this.dom.chatList.scroll(() => (this.checkAutoScroll() || true));

    const usermenu = {
      selector: '.user:not(.user-role-bot)',
      className: 'box dialog',
      trigger: config.settings.contextmenu,
      delay: 700, // only applies to hover.
      build: this.userContextMenu
    };
    $.contextMenu(usermenu);

    const roommenu = {
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

    for (let trigger of ['left', 'right']) $.contextMenu({
      selector: '#statusButton',
      className: 'box dialog',
      trigger,
      build: this.contextMenuStatus
    });
  },

  contextMenuStatus: function(_, {button}) {
    const labels = strings.label.status;
    const joined = !!xmpp.room.current;
    const online = xmpp.connection.connected;
    const status = xmpp.show || 'available';
    const cmd = show => Cadence.execute('show',
      button == 2 && prompt(strings.info.promptStatus) || ''
    );
    const items = {back: {
      name: labels.available,
      icon: 'available',
      disabled: joined ? status == 'available' : online,
      callback: joined ? cmd : () => Cadence.execute('connect'),
    }};
    for (let show of ['away', 'xa', 'dnd']) items[show] = {
      name: labels[show],
      icon: show,
      disabled: !joined || status == show,
      callback: cmd
    }
    items.offline = {
      name: labels.offline,
      icon: 'offline',
      disabled: !online,
      callback: () => Cadence.execute('quit'),
    };
    return {items};
  },

  /**
   * Build the context menu for a user.
   * @param {jq} user The user element.
   */
  userContextMenu: function(user) {
    const c = cmd => Cadence.cmdAvailableState(cmd, true);
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
        callback: () => Cadence.prefixMsg({nick})
      },
      dmsg: {
        name: labels.dmsg,
        icon: 'msg',
        disabled: !c('dmsg') || !jid, // disabled if user is anonymous.
        callback: () => Cadence.prefixMsg({jid})
      },
      sep1: '---',
      invite: {
        name: labels.invite,
        icon: 'invite',
        // disabled on anonymous users, or users who are already in the room.
        disabled: !c('invite') || !jid || nick && roster[nick] && jid.matchBare(roster[nick].jid),
        callback: () => Cadence.execute('invite', {jid}),
      },
      kick: {
        name: labels.kick,
        icon: 'leave',
        // disabled for non-mods, or higher affiliation, or absent users or yourself.
        disabled: !c('kick') || !mod || outranked || !nick || !roster[nick] || nick == xmpp.nick.current,
        callback: () => Cadence.execute('kick', {nick}),
      },
      ban: {
        name: labels.ban,
        icon: 'destroy',
        // disabled for non-admins, or higher affiliation, or anonymous users or yourself.
        disabled: !c('ban') || rank < 2 || outranked || !jid || jid.matchBare(xmpp.jid),
        callback: () => Cadence.execute('ban', {jid}),
      },
      sep2: '',
      whois: {
        name: labels.whois,
        icon: 'whois',
        disabled: !c('whois') || !nick || !roster[nick],
        callback: () => Cadence.execute('whois', {nick}),
      },
      ping: {
        name: labels.ping,
        icon: 'ping',
        disabled: !c('ping'),
        callback: () => Cadence.execute('ping', {nick, jid}),
      }
    }

    return {items, autoHide: config.settings.contextmenu == 'hover'};
  },

  /**
   * Build the context menu for a room.
   */
  roomContextMenu: function(element) {
    const c = cmd => Cadence.cmdAvailableState(cmd, true);
    const labels = strings.label.command;
    const room = element.attr('data-room');
    const currentRoom = xmpp.room.current == room;
    const self = xmpp.roster[xmpp.room.current] && xmpp.roster[xmpp.room.current][xmpp.nick.current];
    const owner = currentRoom && self.affiliation == 'owner';
    const items = {
      join: {
        name: labels.join,
        icon: 'join',
        disabled: !c('join') || currentRoom,
        callback: () => Cadence.execute('join', {name: room}),
      },
      part: {
        name: labels.part,
        icon: 'leave',
        disabled: !c('part') || !currentRoom,
        callback: () => Cadence.execute('part'),
      },
      configure: {
        name: labels.configure,
        icon: 'configure',
        disabled: !c('configure') || currentRoom && !owner, // can only see authorization inside.
        callback: () => Cadence.execute('configure', {name: room, interactive: true}),
      },
      destroy: {
        name: labels.destroy,
        icon: 'destroy',
        disabled: !c('destroy') || currentRoom && !owner,
        callback: () => Cadence.execute('destroy', {room}),
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
  setConnectionStatus: function(online) {
    // status options are: online, waiting, offline
    if (!online) this.updateRoom();
    this.setUserStatus(online ? xmpp.show : 'offline');
    this.dom.loginContainer[online ? 'fadeOut' : 'fadeIn'](500);
    this.dom.roomContainer[online ? 'fadeIn' : 'fadeOut'](500);
  },

  /**
   * Change the user status.
   */
  setUserStatus: function(show) {
    this.dom.statusButton.removeClass('available away dnd xa offline')
      .addClass(show || 'available');
  },

  /**
   * Change the active stylesheet.
   */
  setStyle: function(style) {
    this.dom.styleSheets.prop('disabled', 'disabled');
    this.dom.styleSheets
      .filter(function() { return this.title == style; })
      .removeAttr('disabled');
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
   * Update sidebars in response to a configuration change.
   *
   * @param {boolean} animate Set to false to skip animation (on startup).
   */
  toggleMenu: function(animate=true) {
    const speed = animate ? 'slow' : 0;
    const oldMenu = this.activeMenu;
    const newMenu = config.settings.activeMenu;
    // Sanity check, only toggle if the value changed.
    if (oldMenu == newMenu) return;
    if (oldMenu) this.dom.menu[oldMenu].animate({width: 'hide'}, speed);

    // New menu's width, plus an 8px margin. Yay for magic hard-coded pixels.
    const menuWidth = newMenu ? 8 + parseInt(this.dom.menu[newMenu].css('width')) : 0;
    const width = 20 + menuWidth;

    // Resize the chat pane's right margin, then rescale inline images.
    this.dom.chatList.animate({right : width + 'px'}, speed, () => {
      const maxWidth = this.dom.chatList.width() - 30;
      const maxHeight = this.dom.chatList.height() - 20;
      $('img.rescale').each(function() { visual.rescale($(this), maxWidth, maxHeight); });
    });

    if (newMenu) {
      this.dom.menu[newMenu].animate({width: 'show'}, speed);
      this.activeMenu = newMenu;
    }
    else this.activeMenu = null;
  },

  /**
   * Create a form out of an XMPP data form stanza.
   * @see http://xmpp.org/extensions/xep-0004.html
   *
   * This function uses a callback instead of a promise to allow
   * repeated submissions-
   *
   * @param {Object} stanza The XMPP stanza
   * @param {function} submit The callback that the completed form will be sent to.
   * @return {jQuery} The HTML form.
   */
  dataForm: function(stanza, submit) {
    // The standard constructor turns <field var=?> into <input name=?>.
    const input = field => $('<input>').attr('name', field.attr('var'));

    // These are all the field constructors, by type.
    const fields = {};
    fields.hidden = field => input(field).attr({
      type: 'hidden',
      value: $('value', field).text(),
    });

    // Per https://www.w3.org/TR/xmlschema-2/#boolean-lexical-representation,
    // true booleans may be represented by "true" or "1".
    fields.boolean = field => input(field).attr({
      type: 'checkbox',
      checked: ['true', '1'].includes($('value', field).text()),
    });
    fields['text-single'] = field => input(field).attr({
      type: 'text',
      value: $('value', field).text()
    });
    fields['text-private'] = fields['text-single'];
    fields['jid-single'] = fields['text-single'];
    fields['text-multi'] = field => {
      const values = $.makeArray($('value', field).map(function() {
        return $(this).text();
      }));

      return $('<textarea class="form-field">')
        .attr('name', field.attr('var'))
        .text(values.join("\n"));
    };
    fields['jid-multi'] = field => fields['text-multi'](field).attr({
      title: strings.label.tip.multiline
    });

    fields['list-single'] = field => {
      const select = $('<select>').attr('name', field.attr('var'));
      const defaultValue = field.children('value').text();

      $('option', field).each(function() {
        const value = $('value', this).text();
        const option = $('<option>').attr({
          value,
          selected: value == defaultValue
        });
        option.text($(this).attr('label'));
        select.append(option);
      });
      return select;
    };
    fields['list-multi'] = field => fields['list-single'](field).attr({
      multiple: true
    });
    fields['fixed'] = field => $('<p>').text($('value', field).text());

    // These are all the value callbacks, by type.
    const values = {};
    const val = field => field.val();
    values.hidden = val;
    values.boolean = field => (field.prop('checked') ? "1" : "0");
    values['text-single'] = val;
    values['text-private'] = val;
    values['jid-single'] = val;
    values['text-multi'] = field => field.val().split("\n");
    values['jid-multi'] = values['text-multi'];
    values['list-single'] = val;
    values['list-multi'] = val;
    values['fixed'] = () => undefined;

    const x = $('x', stanza);
    const form = $('<form class="data-form">');

    form.attr('title', $('title', x).text());

    x.children('field').each(function() {
      const type = $(this).attr('type');
      const field = fields[type]($(this));
      field.addClass('data-form-field');
      field.attr('data-type', type);
      field.uniqueId();

      const label = $('<label>');
      label.attr('for', field.attr('id'));
      label.text($(this).attr('label'));

      const row = $('<div class="row">');
      row.append(label, field, '<br>');

      form.append(row);
    });

    form.submit(event => {
      event.preventDefault();
      const data = {};
      $('.data-form-field', form).each(function() {
        const key = $(this).attr('name');
        const value = values[$(this).attr('data-type')]($(this));
        data[key] = value;
      });
      submit(data);
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
   * @param {Object} options (optional)
   */
  messageInfo: function(text, variables, {error}={}) {
    const body = visual.formatText(text, variables);
    let message = {
      type: 'local',
      body,
      user: config.ui.chatBotName && {
        nick: config.ui.chatBotName,
        role: 'bot',
        affiliation: 'bot'
      }
    };
    this.notifyDesktop(error ? 1 : 3, message);

    message = visual.formatMessage(message, true);
    message.html.find('.body').addClass('message-bot');

    if (error) {
      this.playSound('error');
      message.html.find('.body').addClass('error');
    }

    this.messageAppend(message);
  },

  /**
   * Create an error message.
   * This is an alias for messageInfo(text, variables, {error: true})
   */
  messageError: function(text, variables) {
    this.messageInfo(text, variables, {error: true});
  },

  /**
   * Append a delayed (room history) message.
   *
   * @param {Object} message. Must have user, time, room and body keys.
   */
  messageDelayed: function(message) {
    const entry = visual.formatMessage(message);
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
    const total = this.messages.length;
    const time = message.timestamp;

    // If there are no newer messages, just append it.
    if (!total || time > this.messages[total-1].timestamp)
      return this.messageAppend(message);

    // Otherwise, find the first message that is newer.
    let i;
    for (i = 0; i < total; i++)
      if (time < this.messages[i].timestamp)
        break;

    // Insert it before that message.
    message.offset = this.messages[i].offset;
    this.messages[i].html.before(message.html);
    this.messages.splice(i, 0, message);

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

    // After fade-in, scroll down again for inline images.
    $(message.html).fadeIn(() => this.scrollDown());
    this.scrollDown();
  },

  /**
   * Refresh the room selection menu.
   */
  refreshRooms: function(rooms) {
    const room = this.dom.roomSelection.val();
    $('option', this.dom.roomSelection).remove();
    const options = [new Option('---', '')];
    for (let id in rooms) {
      options.push(new Option(rooms[id].title, id));
    }
    this.dom.roomSelection.html(options).val(room);
  },

  /**
   * Update a roster entry.
   *
   * @param {String} user - The new user object.
   * @param {String} nick - The last known nickname of the user.
   */
  rosterInsert: function(user, {nick, animate}={}) {
    nick = nick || user.nick;
    if (animate === undefined) animate = true;
    const label = user.status || strings.label.status[user.show] || user.show;
    const entry = this.roster[nick] || $('<div class="row">').append(
      $('<div class="user-show-icon">').addClass(user.show).attr('title', label),
      visual.format.user(user)
    );
    const link = $('.user', entry);

    const exists = !!this.roster[nick];
    this.roster[user.nick] = entry;

    // If the entry already exists:
    if (exists) {
      // Update entry.
      $('.user-show-icon', entry).attr({
        class: 'user-show-icon ' + user.show,
        title: label
      });
      link.attr({
        'data-affiliation': user.affiliation,
        'data-jid': user.jid,
        'data-nick': user.nick,
        'data-role': user.role,
        'data-show': user.show,
        'title': user.jid,
      }).removeClass(
        (_, css) => css.match(/(jid|user-(affiliation|role))-/g).join(' ')
      ).addClass([
        'user-affiliation-' + user.affiliation,
        'user-role-' + user.role
      ].concat(user.jid && visual.jidClass(user.jid)).join(' '));

      // If the nickname has changed:
      if (nick && nick != user.nick) {
        link.text(user.nick);
        // Remove the old nickname from the index.
        const oldIndex = this.sortedNicks.indexOf(nick);
        this.sortedNicks.splice(oldIndex, 1);
        delete this.roster[nick];
      }
    }
    else {
      visual.msgOnClick(entry);
      link.toggleClass('user-self', user.nick == xmpp.nick.current);
    }

    // If the nick is still in the sorted index, we're done.
    if (~this.sortedNicks.indexOf(nick)) return;

    // Find the (case-insensitive) alphabetical successor of this entry:
    const _lower = user.nick.toLowerCase();
    const newIndex = this.sortedNicks.findIndex(value => _lower < value.toLowerCase());

    if (~newIndex) {
      entry.insertBefore(this.roster[this.sortedNicks[newIndex]]);
      this.sortedNicks.splice(newIndex, 0, user.nick);
    }
    else {
      entry.appendTo(this.dom.roster);
      this.sortedNicks.push(user.nick);
    }

    // The new item becomes visible after being added to the DOM.
    if (!exists) animate ? entry.slideDown() : entry.show();
  },

  /**
   * Remove a user from the online list.
   *
   * The user will remain visible as "offline" for a short time.
   */
  rosterRemove: function(nick) {
    const entry = this.roster[nick];

    if (entry) {
      this.rosterInsert({nick, show: 'offline'});
      setTimeout(() => {
        // Ensure the user is still offline.
        if ($('.user[data-show=offline]', entry).length) {
          delete this.roster[nick];
          entry.slideUp(() => entry.remove());
          const index = this.sortedNicks.indexOf(nick);
          if (~index) this.sortedNicks.splice(index, 1);
        }
      }, 5000);
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
  updateRoom: function(room, roster={}) {
    const list = this.dom.roster;

    this.title = (room ? xmpp.room.available[room].title + ' - ' : '') + config.ui.title;
    $(document).attr('title', this.title);

    this.dom.roomSelection.val(room);
    this.setFragment(room);
    this.setUserStatus('available');

    list.slideUp(() => {
      list.html('');
      this.roster = {};
      this.sortedNicks = [];
      for (let nick in roster)
        this.rosterInsert(roster[nick], {animate: false});

      list.slideDown();
    });
  },

  /**
   * Recalculate the vertical positions of all messages.
   *
   * @start (optional) the first offset to recalculate.
   */
  updateHeights: function(start) {
    let offset = ui.messages[start-1] ? ui.messages[start-1].offset : 0;
    for (let i = start || 1; i < ui.messages.length; i++) {
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
    let a = 0;
    let b = ui.messages.length - 1;
    if (b < 0) return null;
    while (a + 1 < b) {
      const c = (a + b) / 2 | 0;
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
  onKeyMap: function(map) {
    // Compile a lookup table from KeyEvent.DOM_VK_* constants or charcodes.
    const callbacks = {};
    for (let key in map) {
      const index = KeyEvent["DOM_VK_" + key] || key.charCodeAt(0);
      callbacks[index] = map[key];
    }
    return function(event) {
      const char = event.which || event.keyCode;
      if (callbacks[char] && callbacks[char](event, this)) {
        try {
          event.preventDefault();
        } catch(ex) {
          event.returnValue = false;
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
    const length = this.dom.inputField.val().length;
    if (config.ui.maxMessageLength) {
      const content = (config.ui.maxMessageLength - length);
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

    const chatList = this.dom.chatList;
    const viewHeight = parseInt(chatList.css('height'));
    const totalHeight = chatList.prop('scrollHeight');
    const bottom = chatList.scrollTop() + viewHeight;

    const autoScroll = totalHeight - bottom <= viewHeight/3;

    if (this.autoScroll != autoScroll) {
      this.autoScroll = autoScroll;
      this.dom.autoScrollIcon.attr('class', autoScroll ? 'on' : 'off');
    }
  },

  /**
   * Trigger a particular sound event.
   *
   * @return {boolean} True if a sound was played.
   */
  playSound: function(event) {
    if (!config.settings.notifications.soundEnabled || !config.settings.notifications.soundVolume)
      return;
    if (xmpp.show == 'dnd') return;
    const sound = config.settings.notifications.sounds[event];
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
                || text.indexOf(xmpp.jid.node) >= 0);
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

    if (!message.user.jid.equals(xmpp.jid)) {
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
    if (xmpp.show == 'dnd') return;
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

    const speed = config.settings.notifications.blinkSpeed; // faster than you would believe.
    const delay = Math.ceil(1000 / speed);

    let number = Math.ceil(1000 * config.settings.notifications.blinkLength / delay);
    if (!number) return;
    let state = false;

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
    const prefixSearch = (prefix, words) => {
      let results = words.filter(word => word.substring(0, prefix.length) == prefix);

      if (results.length > 1) {
        let result = results[0];
        // For each match, cut down to the longest common prefix.
        for (let candidate of results) {
          for (let c in candidate) {
            if (result[c] != candidate[c]) {
              result = result.substring(0, j);
              break;
            }
          }
          result = result.substring(0, results[i].length);
        }
        results = result ? [result] : [];
      }
      if (results.length == 1) return results[0];
      else return '';
    };

    const inputField = this.dom.inputField;
    inputField.focus();
    const start = inputField[0].selectionStart;
    const end = inputField[0].selectionEnd;
    if (start != end) return false;
    const old = inputField.val();
    const prefix = old.substring(0, start).match(/(^|\s)((\S|\\\s)*)$/)[2];

    // Look for commands or nicknames.
    let result;
    if (prefix[0] == '/') {
      const searchSpace = Object.keys(Cadence.commands).concat(Object.keys(config.settings.macros));
      result = '/' + prefixSearch(prefix.substring(1), searchSpace);
    }
    else
      result = prefixSearch(prefix, this.sortedNicks);

    if (result.length > prefix.length) {
      inputField.val(old.substring(0, start - prefix.length) + result + old.substring(start, old.length));
      inputField[0].selectionStart = start - prefix.length + result.length;
      inputField[0].selectionEnd = inputField[0].selectionStart;
    }
    return true;
  },

  getString: function(key) {
    const path = key.split('.');
    let ref = strings;
    for (let token of path) ref = ref[token];
    return ref;
  }
};
