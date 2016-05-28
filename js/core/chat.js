var Cadence = {
  auth: undefined,
  history: [],
  historyIndex: 0,
  commands: {},

  /**
   * Execute a specific command.
   *
   * @param {string} command
   * @param {Object} arg
   */
  execute: function(command, arg) {
    return this.commands[command](arg);
  },

  /**
   * Register a new command.
   *
   * @param {string} name
   * @param {function} callback
   */
  addCommand: function(name, callback) {
    this.commands[name] = callback;
  },

  /**
   * Validate the current command by client state.
   */
  cmdAvailableState: function(command, silent) {
    const always = ['alias', 'clear', 'nick', 'save', 'version'];
    const chat = ['affiliate', 'away', 'back', 'ban', 'bans', 'dnd', 'invite', 'kick', 'me', 'msg', 'part', 'say', 'unban', 'whois'];
    const offline = ['connect'];

    // Always allow these commands (hence the name).
    if (always.includes(command)) return true;

    // When offline, only allow offline commands.
    if (!xmpp.connection.connected) {
      if (!silent && !offline.includes(command)) {
        ui.messageError(strings.error.cmdState.offline, {command});
      }
      return offline.includes(command);
    }

    // When online, forbid offline commands.
    if (offline.includes(command)) {
      if (!silent) ui.messageError(strings.error.cmdState.online, {command});
      return false;
    }

    // When not in a room, forbid chat commands.
    if (!xmpp.room.current) {
      if (!silent && Cadence.includes(command)) {
        ui.messageError(strings.error.cmdState.prejoin, {command});
      }
      return !Cadence.includes(command);
    }

    // Allow everything else.
    return true;
  },

  /**
   * Parse input sent by the user and execute the appropriate command.
   */
  executeInput: function(text, macro) {
    if (!macro) {
      this.history.push(text);
      this.historyIndex = this.history.length;
    }
    text = text.replace(/\s\s*$/, '');
    if (!text) return;

    // Without commands, execute /say.
    let command = 'say';

    // Execute /command, but turn //command into /say /command.
    const m = /^\/(\/?)(\S+)/.exec(text);
    if (m) {
      if (!m[1]) {
        command = m[2];
        text = text.substring(m[0].length);
      }
      else text = text.substring(1);
    }

    if (this.commands[command]) {
      if (this.cmdAvailableState(command)) this.commands[command](text);
    }
    else if (config.settings.macros[command])
      this.executeMacro(config.settings.macros[command], text);
    else
      ui.messageError(strings.error.cmdUnknown, {command});
  },

  /**
   * Run a stored macro:
   *
   * @param {[string]} macro: An array of commands.
   * @param {string} text: A string to replace $ with in the command array.
   */
  executeMacro: function(macro, text) {
    text = text.trim();
    macro.forEach(statement => this.executeInput(statement.replace(/\$/g, text, true)));
  },

  /**
   * Format an outgoing message.
   *
   * @param {string} text The message to send.
   * @return {object} An object with `html` and `text` keys, containing
   *         the html and markdown versions of the message.
   */
  formatOutgoing: function(text) {
    text = visual.lengthLimit(text, config.ui.maxMessageLength);
    let html = bbcode.render(visual.escapeHTML(text));
    if (config.settings.textColor) {
      html = '<span class="color" data-color="' + config.settings.textColor + '">' + html + '</span>';
    }
    return {html, text: bbcodeMD.render(text)};
  },

  /**
   * Go up to the previously sent message.
   */
  historyUp: function() {
    // Stop at the beginning.
    if (this.historyIndex <= 0) return false;

    // If a new non-history command is entered, save it first.
    if (this.historyIndex == this.history.length && ui.dom.inputField.val().trim())
      this.history.push(ui.dom.inputField.val());
    return ui.dom.inputField.val(this.history[--this.historyIndex]);
  },

  /**
   * Go down to the next sent message.
   */
  historyDown: function() {
    // Stop at the end.
    if (this.historyIndex >= this.history.length) return false;

    return ui.dom.inputField.val(this.history[++this.historyIndex] || '');
  },

  /**
   * Insert a text into the input field.
   * @param {string} text The text to insert.
   * @param {array} text The beginning and end tags to insert.
   *
   * If an array is given, then it will be wrapped around the selected
   * text. A string will replace the selected text.
   * If an array is given and no text is selected, the cursor will
   * be moved between the tags. Otherwise it will be moved to the end
   * of the inserted text.
   */
  insertText: function(text) {
    ui.dom.inputField.focus();
    const inputFieldJQ = ui.dom.inputField;
    const inputField = inputFieldJQ[0]
    const old = inputFieldJQ.val();
    let start = inputField.selectionStart;
    let end = inputField.selectionEnd;
    const rep = (typeof text == 'string') ? text : text[0] + old.substring(start, end) + text[1];
    inputFieldJQ.val(old.substring(0, start) + rep + old.substring(end));
    start += (start < end || rep == text) ? rep.length : text[0].length;
    end = start;
    inputField.selectionStart = start;
    inputField.selectionEnd = end;
  },

  /**
   * Prepend a /msg <nick> prefix.
   * This will replace any existing /msg <nick> prefix.
   */
  prefixMsg: function({nick, jid}) {
    const direct = !nick;

    let target = nick || jid;
    target = String(target).replace(/[\\\s"']/g, '\\$&');

    let text = ui.dom.inputField.val();

    const newPrefix = target && ((direct ? '/dmsg ' : '/msg ')  + target + ' ');
    const [oldPrefix] = text.match(/\/d?msg\s+((\\[\\\s]|[^\\\s])+)/) || [];
    if (oldPrefix) text = text.substring(oldPrefix.length).trimLeft();
    text = newPrefix  + text;

    ui.dom.inputField.val(text);
    ui.dom.inputField.focus();
  },

  /**
   * Find a room by its title.
   */
  getRoomFromTitle: function(title) {
    const rooms = xmpp.room.available;
    if (rooms[title]) return rooms[title];
    return $.map(rooms, x => x).find(room => room.title == title);
  },

  /**
   * Parse a commandline-style argument string.
   *
   * @param {string} args the raw argument string.
   *
   * @return An object with named and positional arguments.
   *         The array of positional arguments is stored in the 0 key.
   *         The 1 key stores the end position of each named or positional argument.
   */
  parseArgs: function(text) {
    if (typeof text !== 'string') return text;
    const key = /(?:--([a-z-]+))/;
    // Values can be single- or double-quoted. Quoted values can contain spaces.
    // All spaces and conflicting quotes can be escaped with backslashes.
    // All literal backslashes must also be escaped.
    const value = /(?:"((?:\\.|[^\\"])+)"|'((?:\\.|[^\\'])+)'|(?!["'\s])((?:\\.|[^\\\s])*))/;
    // A keyvalue assignment can be separated by spaces or an =.
    // When separated by spaces, the value must not begin with an unquoted --.
    const keyvalue = RegExp(key.source + '(?:=|\\s+(?!--))' + value.source);
    const re = RegExp('\\s+(?:' + keyvalue.source + '|' + key.source + '|' + value.source + ')', 'g');
    const args = {0:[], 1:{0:[]}};
    for (let match; match = re.exec(text); ) {
      // keyvalue: 1 = key, 2|3|4 = value
      if (match[1]) {
        let v = (match[2] || match[3] || match[4]).replace(/\\([\\\s"'])/g, '$1');
        if (['0', 'no', 'off', 'false'].includes(v)) v = false;
        args[match[1]] = v;
        args[1][match[1]] = re.lastIndex;
      }
      // key: 5 = key
      else if (match[5]) {
        args[match[5]] = true;
        args[1][match[5]] = re.lastIndex;
      }
      // value: 6|7|8 = value
      else {
        args[0].push((match[6] || match[7] || match[8]).replace(/\\(.)/g, '$1'));
        args[1][0].push(re.lastIndex);
      }
    }
    return args;
  },

  /**
   * Convert arguments to room configuration form.
   */
  roomConf: function(args) {
    const conf = {};

    const title = args.title || args.name;
    if (title)
      conf['muc#roomconfig_roomname'] = args.title || args.name;
    if (args.desc) conf['muc#roomconfig_roomdesc'] = args.desc;
    if (args.log !== undefined)
      conf['muc#roomconfig_enablelogging'] = args.log ? '1' : '0';
    if (args.persistent !== undefined)
      conf['muc#roomconfig_persistentroom'] = args.persistent ? '1' : '0';
    if (args['public'] !== undefined)
      conf['muc#roomconfig_publicroom'] = args['public'] ? '1' : '0';
    if (args.anonymous !== undefined)
      conf['muc#roomconfig_whois'] = args.anonymous ? 'moderators' : 'anyone';
    if (args.password !== undefined) {
      conf['muc#roomconfig_passwordprotectedroom'] = args.password ? '1' : '0';
      conf['muc#roomconfig_roomsecret'] = args.password;
    }
    if (args['members-only'] !== undefined)
      conf['muc#roomconfig_membersonly'] = args.membersonly ? '1' : '0';
    if (!$.isEmptyObject(conf)) return conf;
  },

  /**
   * Attempt to get authentication data through an existing web session.
   *
   * @param {String} url - The URL to post a request to.
   *
   * @return {Promise} A promise that resolves to the temporary credentials.
   */
  sessionAuth: function(url) {
    const salt = SHA1.b64_sha1((new Date().getTime()) + Math.random());
    return new Promise((resolve, reject) => {
      $.post(url, {salt})
      .done(({user, secret}) => {
        if (user && secret) resolve({user, pass: secret});
        else reject();
      })
      .fail(reject);
    });
  },

  /**
   * Set the volume.
   */
  setAudioVolume: function(volume) {
    buzz.all().setVolume(volume);
  },

  /**
   * Take a dotted string and return the respective value
   * in the settings dictionary.
   */
  getSetting: function(key) {
    const path = key.split('.');
    let ref = config.settings;
    for (let i = 0; i < path.length; i++) {
      ref = ref[path[i]];
    }
    return ref;
  },

  /**
   * Take a dotted string and set that settings key to the
   * given value. Immediately saves.
   */
  setSetting: function(key, val) {
    const path = key.split('.');
    let ref = config.settings;
    for (let i = 0; i < path.length - 1; i++) {
      ref = ref[path[i]];
    }
    if (ref[path[path.length-1]] !== val) {
      ref[path[path.length-1]] = val;
      config.settings.modified = (new Date()).toISOString();
      this.saveSettings();
    }
  },

  /**
   * Serialize the settings object and save it in the cookie.
   */
  saveSettings: function() {
    if (window.localStorage) {
      localStorage.settings = JSON.stringify(config.settings);
    }
    else {
      Cookies.set(config.clientName + '_settings', config.settings, {expires: 365});
    }
  },

  synchronizeSettings: function(type) {
    const settings = config.settings;
    const local = new Date(settings.modified).getTime();
    const sync = new Date(settings.sync.time).getTime();

    const set = () => xmpp.storeSettings(settings).then(() => {
      config.settings.sync = {account: xmpp.jid.node, time: settings.modified};
      Cadence.saveSettings();
      ui.messageInfo(strings.info.sync.set);
    });

    const get = stored => {
      stored.sync = {account: xmpp.jid.node, time: stored.modified};
      config.settings = stored;

      ui.loadSettings(); // Apply the new settings.
      this.saveSettings();
      ui.messageInfo(strings.info.sync.get);
    };

    if (type === 'set') return set();

    // First load the stored settings.
    xmpp.loadSettings()
    .then(stored => {
      const remote = new Date(stored.modified).getTime();
      if (local == remote) return ui.messageInfo(strings.info.sync.equal);
      if (type == 'get' || sync == local) return get(stored);
      if (sync == remote) return set();
      throw 'conflict';
    })
    .catch(error => {
      if (error == 'conflict') ui.messageError(strings.error.sync.conflict);
    });
  }
}
