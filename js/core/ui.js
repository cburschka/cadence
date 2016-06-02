/**
 * ui.js contains all functions that alter the user interface.
 */
const ui = {
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
  init() {
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
  loadSounds() {
    config.sounds.forEach(sound => {
      this.sounds[sound] = new buzz.sound(config.soundURL + sound, {
        formats: ['ogg', 'mp3'],
        preload: true
      });
    });
  },

  /**
   * Create dynamic page elements.
   */
  initializePage() {
    // Build help sidebar.
    const help = strings.help.sidebar;
    const helpSections = Object.values(help).map(({title, commands}) => {
      const caption = $('<caption>').append($('<h4>').text(title));
      const rows = Object.values(commands).map(
        ([desc, code]) => $('<tr class="row">').append(
          $('<td class="desc">').text(desc),
          $('<td class="code">').text(code)
        )
      );
      return $('<table>').append(caption, rows);
    });
    $('#helpList').append(helpSections);

    // Build the navigation menu.
    const navigation = config.ui.navigation;
    const navLinks = $.map(navigation, (val, key) =>
      $('<li>').append($('<a>').attr('href', val).text(key))
    );
    $('#navigation ul').append(navLinks);
    $('#navigation').toggle(!!navLinks.length);

    // Build and fill the emoticon containers.
    const bars = config.ui.emoticonSidebars
    const emoticons = config.markup.emoticons;
    Object.keys(bars).forEach(set => {
      const {title, icon} = bars[set];
      const {codes, baseURL} = emoticons[set];

      $('<button class="tray icon toggleMenu">')
        .text(title)
        .attr({
          title,
          id: `emoticon-${set}Button`,
          'data-sidebar': `emoticon-${set}`,
        })
        .css('background-image', `url(${encodeURI(baseURL + icon)})`)
        .appendTo(this.dom.emoticonTrayContainer);

      const list = $('<div class="emoticon-list-sidebar" dir="ltr">')
        .attr('id', `emoticonsList-${set}`);

      const sidebar = $('<div class="menuContainer emoticon-sidebar box">')
        .attr('id', `emoticon-${set}`)
        .append($('<h3>').text(title), list)
        .appendTo(this.dom.emoticonSidebarContainer);

      this.dom.menu[`emoticon-${set}`] = sidebar;

      const shortcuts = Object.keys(codes).map(code =>
        $('<a class="insert-text">').attr({
          href: `javascript:void('${code.replace(/'/g, '\\\'')}');`,
          title: code
        })
        .append($('<img>').attr({
          src: baseURL + codes[code],
          alt: code
        }))
      );
      list.append(shortcuts);
    });

    // Build the color palette picker.
    const colorCodes = config.markup.colorCodes.map(code =>
      $('<a class="colorCode">')
      .attr('href', "javascript:void('" + code.replace(/'/g, '\\\'') + "');")
      .attr('title', code)
      .css('background-color', code)
    );
    $('#colorCodesContainer').prepend(colorCodes);

    const sounds = Object.keys(this.sounds).map(sound => new Option(sound));
    $('#settingsContainer select.soundSelect').append(sounds);
    $('button.soundTest').click(function() {
      return ui.playSound(this.getAttribute('data-sound'));
    });

    ui.loadStrings();
    ui.toggleMenu(false);
    ui.loadSettings();
  },

  loadStrings() {
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

  loadSettings() {
    this.setStyle(config.settings.activeStyle);

    // Set the form values.
    $('.settings').val(function() {
      const id = this.id.substring('settings-'.length);
      const value = Cadence.getSetting(id);
      return value;
    });
    $('input.settings[type="checkbox"]').prop('checked', function() {
      const id = this.id.substring('settings-'.length);
      const value = Cadence.getSetting(id);
      return value;
    });
    $('.settings').change();
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
  initializeEvents() {
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
        if (this.value) Cadence.tryCommand('join', {room: this.value});
        else Cadence.tryCommand('part');
      }
    });
    $(window).on('hashchange', () => {
      if (this.urlFragment != window.location.hash) {
        this.urlFragment = window.location.hash;
        if (this.urlFragment) {
          Cadence.tryCommand('join', {room: this.getFragment()});
        }
        else Cadence.tryCommand('part');
      }
    });

    // Log in with the button or pressing enter.
    this.dom.loginContainer.submit(e => {
      Cadence.tryCommand('connect', {
        user: $('#loginUser').val(),
        pass: $('#loginPass').val()
      });
      e.preventDefault();
    });
    $('#trayContainer button.toggleMenu').click(function() {
      const sidebar = this.getAttribute('data-sidebar');
      const oldMenu = config.settings.activeMenu;
      const newMenu = sidebar == oldMenu ? '' : sidebar;
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
      const {id, type, value, checked} = this;
      const newValue = (() => {
        switch (type) {
          case 'checkbox': return checked;
          case 'range': case 'select': case 'select-one':
            const num = parseFloat(value);
            if (value === String(num)) return num;
          default: return value;
        }
      })();
      Cadence.setSetting(id.substring('settings-'.length), newValue);
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
      else if (Notification.permission == 'denied') $(this).val(0).change();
    }).change();

    // Attempt to maintain the scroll position when changing message heights.
    const toggler = selector => {
      // Find the first message in full view.
      const scrollTop = this.dom.chatList.prop('scrollTop');
      const index = this.messages.findIndexBinary(m => m.offset >= scrollTop);
      $(selector).toggle();
      this.updateHeights();
      if (index) {
        // ... and scroll to it again (and snap to bottom if appropriate).
        this.dom.chatList.prop('scrollTop', this.messages[index].offset);
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
    $('#logoutButton').click(() => Cadence.tryCommand('quit'));

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

    ['left', 'right'].forEach(trigger => $.contextMenu({
      selector: '#statusButton',
      className: 'box dialog',
      trigger,
      build: this.contextMenuStatus
    }));
  },

  contextMenuStatus(_, {button}) {
    const check = cmd => Cadence.checkCommand(cmd) && (cmd != xmpp.show);
    const labels = strings.label.status;
    const joined = !!xmpp.room.current;
    const online = xmpp.connection.connected;
    const status = xmpp.show || 'available';
    const cmd = show => Cadence.tryCommand(show,
      {status: button == 2 && prompt(strings.info.promptStatus + show)}
    );
    const items = {back: {
      name: labels.available,
      icon: 'available',
      disabled: !check(online ? 'back' : 'connect'),
      callback: () => (online ? cmd('back') : Cadence.tryCommand('connect')),
    }};
    ['away', 'xa', 'dnd'].forEach(show => items[show] = {
      name: labels[show],
      icon: show,
      disabled: !check(show),
      callback: cmd
    });
    items.offline = {
      name: labels.offline,
      icon: 'offline',
      disabled: !check('quit'),
      callback: () => Cadence.tryCommand('quit'),
    };
    return {items};
  },

  /**
   * Build the context menu for a user.
   * @param {jq} user The user element.
   */
  userContextMenu(user) {
    const check = cmd => Cadence.checkCommand(cmd);
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
        disabled: !check('msg') || !nick || !roster[nick], // disabled if user is not room occupant.
        callback: () => Cadence.prefixMsg({nick})
      },
      dmsg: {
        name: labels.dmsg,
        icon: 'msg',
        disabled: !check('dmsg') || !jid, // disabled if user is anonymous.
        callback: () => Cadence.prefixMsg({jid})
      },
      sep1: '---',
      invite: {
        name: labels.invite,
        icon: 'invite',
        // disabled on anonymous users, or users who are already in the room.
        disabled: !check('invite') || !jid || nick && roster[nick] && jid.matchBare(roster[nick].jid),
        callback: () => Cadence.tryCommand('invite', {jid}),
      },
      kick: {
        name: labels.kick,
        icon: 'leave',
        // disabled for non-mods, or higher affiliation, or absent users or yourself.
        disabled: !check('kick') || !mod || outranked || !nick || !roster[nick] || nick == xmpp.nick.current,
        callback: () => Cadence.tryCommand('kick', {nick}),
      },
      ban: {
        name: labels.ban,
        icon: 'destroy',
        // disabled for non-admins, or higher affiliation, or anonymous users or yourself.
        disabled: !check('ban') || rank < 2 || outranked || !jid || jid.matchBare(xmpp.jid),
        callback: () => Cadence.tryCommand('ban', {jid}),
      },
      sep2: '',
      whois: {
        name: labels.whois,
        icon: 'whois',
        disabled: !check('whois') || !nick || !roster[nick],
        callback: () => Cadence.tryCommand('whois', {nick}),
      },
      ping: {
        name: labels.ping,
        icon: 'ping',
        disabled: !check('ping'),
        callback: () => Cadence.tryCommand('ping', {nick, jid}),
      }
    }

    return {items, autoHide: config.settings.contextmenu == 'hover'};
  },

  /**
   * Build the context menu for a room.
   */
  roomContextMenu(element) {
    const check = cmd => Cadence.checkCommand(cmd);
    const labels = strings.label.command;
    const room = element.attr('data-room');
    const currentRoom = xmpp.room.current == room;
    const self = xmpp.roster[xmpp.room.current] && xmpp.roster[xmpp.room.current][xmpp.nick.current];
    const owner = currentRoom && self.affiliation == 'owner';
    const items = {
      join: {
        name: labels.join,
        icon: 'join',
        disabled: !check('join') || currentRoom,
        callback: () => Cadence.tryCommand('join', {room}),
      },
      part: {
        name: labels.part,
        icon: 'leave',
        disabled: !check('part') || !currentRoom,
        callback: () => Cadence.tryCommand('part'),
      },
      configure: {
        name: labels.configure,
        icon: 'configure',
        disabled: !check('configure') || currentRoom && !owner, // can only see authorization inside.
        callback: () => Cadence.tryCommand('configure', {name: room, interactive: true}),
      },
      destroy: {
        name: labels.destroy,
        icon: 'destroy',
        disabled: !check('destroy') || currentRoom && !owner,
        callback: () => Cadence.tryCommand('destroy', {room}),
      }
    }
    return {items, autoHide: config.settings.contextmenu == 'hover'};
  },

  /**
   * Instantly delete the entire message log.
   */
  clearMessages() {
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
  setConnectionStatus(online) {
    // status options are: online, waiting, offline
    if (!online) this.updateRoom();
    this.setUserStatus(online ? xmpp.show : 'offline');
    this.dom.loginContainer[online ? 'fadeOut' : 'fadeIn'](500);
    this.dom.roomContainer[online ? 'fadeIn' : 'fadeOut'](500);
  },

  /**
   * Change the user status.
   */
  setUserStatus(show) {
    this.dom.statusButton.removeClass('available away dnd xa offline')
      .addClass(show || 'available');
  },

  /**
   * Change the active stylesheet.
   */
  setStyle(style) {
    this.dom.styleSheets.prop('disabled', 'disabled');
    this.dom.styleSheets
      .filter(function() { return this.title == style; })
      .removeAttr('disabled');
  },

  /**
   * This changes the value and appearance of the persistent color button.
   */
  setTextColorPicker(color) {
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
  toggleMenu(animate=true) {
    const speed = animate ? 'slow' : 0;
    const oldMenu = this.activeMenu;
    const newMenu = config.settings.activeMenu;
    // Sanity check, only toggle if the value changed.
    if (oldMenu === newMenu) return;
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
  dataForm(stanza, submit) {
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
      const values = Array.from($('value', field).map(function() {
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
  formDialog(form, {cancel, apply}={}) {
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
  messageInfo(text, variables, {error}={}) {
    const message = {
      body: visual.formatText(text, variables),
      time: new Date(),
      type: 'local',
    };
    this.notifyDesktop(error ? 1 : 3, message);

    const output = visual.formatMessage(message, true);
    if (error) output.html.find('.body').addClass('error');
    this.messageAppend(output);
  },

  /**
   * Create an error message.
   * This is an alias for messageInfo(text, variables, {error: true})
   */
  messageError(text, variables) {
    this.messageInfo(text, variables, {error: true});
    this.playSound('error');
  },

  /**
   * Append a delayed (room history) message.
   *
   * @param {Object} message. Must have user, time, room and body keys.
   */
  messageDelayed(message) {
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
  messageInsert(message) {
    const total = this.messages.length;
    const time = message.timestamp;

    // Find the first message that is newer.
    const index = this.messages.findIndex(m => time < m.timestamp);

    // If there are no newer messages, just append it.
    if (!~index) return this.messageAppend(message);

    // Otherwise, insert it before that message.
    message.offset = this.messages[index].offset;
    this.messages[index].html.before(message.html);
    this.messages.splice(index, 0, message);

    $(message.html).show();
    this.updateHeights(index);
    this.scrollDown();
  },

  /**
   * Append a rendered message to the end of the chat list.
   */
  messageAppend(message) {
    message.offset = this.dom.chatList.prop('scrollHeight');
    this.messages.push(message);
    this.dom.chatList.append(message.html);

    // After fade-in, scroll down again for inline images.
    $(message.html).slideDown(() => this.scrollDown());
    this.scrollDown();
  },

  /**
   * Refresh the room selection menu.
   */
  refreshRooms(rooms) {
    const room = this.dom.roomSelection.val();
    const options = [new Option('---', '')].concat(
      Object.keys(rooms).map(id => new Option(rooms[id].title, id))
    );
    this.dom.roomSelection.html(options).val(room);
  },

  /**
   * Update a roster entry.
   *
   * @param {String} user - The new user object.
   * @param {String} nick - The last known nickname of the user.
   */
  rosterInsert(user, {nick, animate}={}) {
    nick = nick || user.nick;
    if (animate === undefined) animate = true;
    const label = user.status || strings.label.status[user.show] || user.show;
    const entry = this.roster[nick] || $('<div class="row">').append(
      $('<div class="user-show-icon">').addClass(user.show).attr('title', label),
      visual.format.user(user)
    );
    const link = $('.user', entry);

    const exists = !!this.roster[nick];

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
        // And if the new nickname is already in the roster, remove that too:
        const oldEntry = this.roster[user.nick];
        if (oldEntry) oldEntry.remove();
      }
    }
    else {
      visual.msgOnClick(entry);
      link.toggleClass('user-self', user.nick == xmpp.nick.current);
    }

    this.roster[user.nick] = entry;

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
  rosterRemove(nick) {
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
  getFragment() {
    return decodeURIComponent(this.urlFragment.substring(1));
  },


  /**
   * Set the URL fragment to a room.
   *
   * @param {string} room
   */
  setFragment(room) {
    ui.urlFragment = '#' + encodeURIComponent(room || '');
    window.location.hash = ui.urlFragment;
  },

  /**
   * Remove the online list with a new roster, and set the room selection menu.
   */
  updateRoom(room, roster={}) {
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
      Object.keys(roster).forEach(nick => {
        this.rosterInsert(roster[nick], {animate: false});
      });

      list.slideDown();
    });
  },

  /**
   * Recalculate the vertical positions of all messages.
   *
   * @start (optional) the last correct offset.
   */
  updateHeights(start=0) {
    const first = ui.messages[start];
    ui.messages.slice(start+1).reduce((offset, message) => {
      message.offset = offset;
      return offset + message.html.height();
    }, first.offset + first.html.height());
  },

  /**
   * Helper function: Route a keystroke to a callback function.
   *
   * @param {Object} callbacks. Functions for each keycode to listen for.
   *                 Should return true if the event should be terminated.
   * @return true if the event should be terminated.
   */
  onKeyMap(map) {
    // Compile a lookup table from KeyEvent.DOM_VK_* constants or charcodes.
    const callbacks = {};
    Object.keys(map).forEach(key => {
      const index = KeyEvent["DOM_VK_" + key] || key.charCodeAt(0);
      callbacks[index] = map[key];
    });

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
  updateMessageLengthCounter() {
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
  scrollDown() {
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
  checkAutoScroll() {
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
  playSound(event) {
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
  notify(message) {
    const {body, type, user} = message;
    const {triggers} = config.settings.notifications;
    const allTriggers = Array.concat(triggers, xmpp.nick.current, xmpp.jid.node);
    const text = body.text();
    const name = user.nick || user.jid.bare() || '';

    const mention = allTriggers.some(trigger => ~text.indexOf(trigger));
    const sender = allTriggers.some(trigger => ~name.indexOf(trigger));

    // Any kind of alert is level 1, everything else is 2.
    this.notifyDesktop(((mention || type == 'chat' || sender) ? 1 : 2), message);

    if (!user.jid.equals(xmpp.jid)) {
      const sender = user.nick || user.jid.userString();
      this.blinkTitle(sender);
    }

    if (mention && this.playSound('mention')) return;
    if (type != 'groupchat' && this.playSound('msg')) return;
    if (sender && this.playSound('mention')) return;
    this.playSound('receive');
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
  notifyDesktop(level, message) {
    if (xmpp.show == 'dnd') return;
    if (!document.hidden) return;
    if (level > config.settings.notifications.desktop) return;

    const {title, body} = (() => {
      const {type, user, body} = message;
      const text = $(body).text();
      const sender = user && visual.format.user(user).text();
      const title = type == 'direct' ? sender : xmpp.getRoom().title;

      switch (type) {
        case 'direct':    return {title, body: text};
        case 'local':     return {title, body: text};
        case 'groupchat': return {title, body: `${sender}: ${text}`}
        default:
          return {title, body: `${sender}: ${strings.info.whisper} ${text}`}
      }
    })();

    return new Notification(title, {body, tag: xmpp.room.current});
  },

  /**
   * Blink.
   */
  blinkTitle(string) {
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
  autocomplete() {
    const inputField = this.dom.inputField;
    inputField.focus();
    const start = inputField[0].selectionStart;
    const end = inputField[0].selectionEnd;
    if (start != end) return false;
    const old = inputField.val();
    const [,slash,prefix=''] = old.substring(0, start).match(/(?:^|\s)(\/?)((?:\S|\\\s)*)$/);

    const commands = Object.keys(Cadence.commands).concat(Object.keys(config.settings.macros));
    const searchSpace = slash ? commands : this.sortedNicks;

    const candidates = searchSpace.filter(x => x.startsWith(prefix));
    if (!candidates.length) return true;

    const common = (candidates.length == 1 ?
      (candidates[0] + ' ') :
      candidates.reduce((a,b) => {
        const index = Array.from(a).findIndex((c, i) => c != b[i]);
        return a.substring(0, index);
      })
    );

    const next = common.substring(prefix.length);
    if (next) return Cadence.insertText(next) || true;
    const list = slash ? candidates.map(x => '/' + x) : candidates.map(x => xmpp.getOccupant(x));
    list.type = slash ? 'command' : 'user';
    ui.messageInfo(strings.info.suggestions, {list});
    return true;
  },

  getString(key) {
    const path = key.split('.');
    let ref = strings;
    for (let token of path) ref = ref[token];
    return ref;
  }
};
