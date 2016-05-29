var Cadence = {
  auth: undefined,
  history: [],
  historyIndex: 0,
  commands: {},

  Command: class {
    constructor(callback) {
      this.callback = callback;
      this.parser = Cadence.parseArgs;
    }

    execute(arg) {
      // Make sure all commands return promises, even synchronous ones.
      return Promise.resolve(this.callback(arg));
    }

    invoke(string) {
      return this.execute(this.parser(string));
    }

    require(requirement) {
      this.requires = requirement;
      return this;
    }

    parse(parser) {
      this.parser = parser;
      return this;
    }

    isAvailable() {
      return (!this.requires || this.requires()) && this;
    }
  },

  Error: class {
    constructor(msg, data) {
      this.msg = msg;
      this.data = data;
    }

    toString() {
      return visual.formatText(this.msg, this.data).text();
    }

    output() {
      ui.messageError(this.msg, this.data);
    }

    static fromError(error) {
      if (error instanceof Error) return new Cadence.Error(strings.error.javascript, error);
      // Catch whatever crazy stuff has been thrown at us.
      return new Cadence.Error(strings.error.unknown, {error: JSON.stringify(error)});
    }
  },

  /**
   * Execute a specific command.
   *
   * @param {string} command
   * @param {Object} arg
   */
  execute(command, arg={}) {
    return this.getCommand(command).execute(arg);
  },

  /**
   * Register a new command.
   * The callback function should accept a single object argument.
   * The optional parser argument should process a string into an acceptable object.
   *
   * @param {string} name
   * @param {function} callback
   */
  addCommand(name, callback) {
    return this.commands[name] = new Cadence.Command(callback);
  },

  getCommand(command) {
    if (command in this.commands) return this.commands[command];
    else throw new Cadence.Error(strings.error.cmdUnknown, {command});
  },

  checkCommand(command) {
    try {
      return this.getCommand(command).isAvailable();
    }
    catch (e) {
      return false;
    }
  },

  tryCommand(command, arg) {
    try {
      this.execute(command, arg).catch(error => this.handleError(command, error));
    }
    catch (error) {
      this.handleError(command, error);
    }
  },

  handleError(command, error) {
    if (!(error instanceof Cadence.Error)) {
      error = Cadence.Error.fromError(error);
    }
    error.data = $.extend(error.data, {command});
    error.output();
  },

  /**
   * Parse input sent by the user and execute the appropriate command.
   */
  executeInput(text, macro) {
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

    if (command in config.settings.macros) {
      return this.executeMacro(config.settings.macros[command], text);
    }

    // Catch both synchronous and asynchronous errors.
    try {
      return this.getCommand(command).isAvailable().invoke(text)
        .catch(error => this.handleError(command, error));
    }
    catch (error) {
      this.handleError(command, error);
    }
  },

  /**
   * Run a stored macro:
   *
   * @param {[string]} macro: An array of commands.
   * @param {string} text: A string to replace $ with in the command array.
   */
  executeMacro(macro, text) {
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
  formatOutgoing(text) {
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
  historyUp() {
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
  historyDown() {
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
  insertText(text) {
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
  prefixMsg({nick, jid}) {
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
  getRoomFromTitle(title) {
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
  parseArgs(text) {
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

  connect(user, pass) {
    ui.messageInfo(strings.info.connection.connecting);

    // This is a callback, because it happens after the promise is resolved.
    // That also means we can't throw an error here.
    const disconnect = () => {
      ui.setConnectionStatus(false);
      (new Cadence.Error(strings.info.connection.disconnected)).output();
    }

    return xmpp.connect(user, pass, disconnect)
    // Then either join a room or list the available rooms.
    .then(() => {
      ui.setConnectionStatus(true);
      ui.messageInfo(strings.info.connection.connected);
      // A room in the URL fragment (even an empty one) overrides autojoin.
      if (ui.getFragment() || config.settings.xmpp.autoJoin && !ui.urlFragment) {
        const room = ui.getFragment() || config.settings.xmpp.room;
        Cadence.execute('join', {room});
      }
      else Cadence.execute('list');
    })
    // Notify user of connection failures.
    .catch(error => {
      ui.setConnectionStatus(false);
      switch (error.status) {
        case Strophe.Status.AUTHFAIL:
          throw new Cadence.Error(strings.error.connection.authfail);
        case Strophe.Status.CONNFAIL:
          if (error.error == 'x-strophe-bad-non-anon-jid') {
            throw new Cadence.Error(strings.error.connection.anonymous)
          }
          throw new Cadence.Error(strings.error.connection.connfail);
        case Strophe.Status.ERROR:
          throw new Cadence.Error(strings.error.connection.other);
      }
      throw error;
    });
  },

  /**
   * Convert arguments to room configuration form.
   */
  roomConf(args) {
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
  sessionAuth(url) {
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
  setAudioVolume(volume) {
    buzz.all().setVolume(volume);
  },

  /**
   * Take a dotted string and return the respective value
   * in the settings dictionary.
   */
  getSetting(key) {
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
  setSetting(key, val) {
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
  saveSettings() {
    if (window.localStorage) {
      localStorage.settings = JSON.stringify(config.settings);
    }
    else {
      Cookies.set(config.clientName + '_settings', config.settings, {expires: 365});
    }
  },

  synchronizeSettings(type) {
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
      throw new Cadence.Error(strings.error.sync.conflict);
    });
  }
};

(() => {
  /**
   * Validate the current command by client state.
   */
  Cadence.requirements = {
    online() {
      if (!xmpp.connection.connected) {
        throw new Cadence.Error(strings.error.cmdState.online);
      }
      return true;
    },

    offline() {
      if (xmpp.connection.connected) {
        throw new Cadence.Error(strings.error.cmdState.offline);
      }
      return true;
    },

    room() {
      if (!xmpp.room.current) {
        throw new Cadence.Error(strings.error.cmdState.room);
      }
      return true;
    }
  };
})();
