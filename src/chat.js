const Cadence = {
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

    static from(error) {
      if (error instanceof Cadence.Error) return error;

      // Print a stack trace for generic JavaScript errors:
      if (error instanceof Error) {
        const {name, message, stack} = error;
        console.log(error);
        return new Cadence.Error(strings.error.javascript, {name, message, stack});
      }

      // Avoid useless string representations, and the weird comma thing arrays do.
      let string = String(error);
      if (error instanceof Array || string == '[object Object]') {
        string = JSON.stringify(error);
      }
      return new Cadence.Error(strings.error.unknown, {error: string});
    }
  },

  /**
   * Execute a specific command.
   *
   * @param {string} command
   * @param {Object} arg
   *
   * @return {Promise} a promise that resolves when the command completes.
   */
  execute(command, arg={}) {
    return Promise.resolve(this.getCommand(command).execute(arg));
  },

  /**
   * Attempt to execute a command, catching and printing errors.
   *
   * @param {string} command
   * @param {Object} arg
   *
   * @return {Promise} a promise that resolves when the command completes or fails.
   */
  tryCommand(command, arg) {
    return Promise.resolve()
    .then(() => this.execute(command, arg))
    .catch(error => this.handleError(error, command));
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

  /**
   * Check if a command is currently executable, catching errors.
   *
   * @param {string} name
   *
   * @return {boolean} whether or not the command is available.
   */
  checkCommand(command) {
    try {
      return this.getCommand(command).isAvailable();
    }
    catch (e) {
      return false;
    }
  },

  handleError(error, command) {
    error = Cadence.Error.from(error);
    // Put the command into the error's context variables.
    if (command) error.data = $.extend({command}, error.data);
    error.output();
  },

  /**
   * Parse input sent by the user and execute the appropriate command.
   */
  executeInput(text, inMacro) {
    if (!inMacro) {
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

    const macro = config.settings.macros[command];

    // Catch both synchronous and asynchronous errors.
    return Promise.resolve()
    .then(() => macro ?
      this.executeMacro(macro, text) :
      this.getCommand(command).isAvailable().invoke(text)
    )
    .catch(error => this.handleError(error, command));
  },

  /**
   * Run a stored macro:
   *
   * @param {Array} macro: An array of commands.
   * @param {string} text: A string to replace $ with in the command array.
   *
   * @return {Promise} A promise that resolves when all tasks are complete.
   */
  executeMacro(macro, text) {
    const re = /\s+((?:[^\\\s]|\\.)*)/g;
    let index = 0;
    const _macro = macro.map(statement => statement.replace(/\$/g, () => {
      const match = re.exec(text);
      if (!match) return '';
      index = match.index + match[0].length;
      return match[1];
    }));
    _macro[_macro.length-1] += text.substring(index);

    return Promise.all(_macro.map(s => this.executeInput(s, true)));
  },

  /**
   * Format an outgoing message.
   *
   * @param {string} text The message to send.
   * @return {object} An object with `html` and `text` keys, containing
   *         the html and markdown versions of the message.
   */
  sendMessage({to, text, type='normal'}) {
    const color = config.settings.textColor;
    const html = $('<p>').append(this.bbcode(visual.escapeHTML(text)));
    const body = {html, text: this.bbcodeMD(text)};
    const meta = color && {color};
    const message = {to, body, type, meta};
    xmpp.sendMessage(message);
    return message;
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
    const handler = (status, error) => {
      if (status == Strophe.Status.DISCONNECTED) {
        ui.setConnectionStatus(false);
        this.handleError(new this.Error(strings.info.connection.disconnected));
      }
      else if (error == 'system-shutdown') {
        this.handleError(new this.Error(strings.error.connection.shutdown));
      }
    }

    return xmpp.connect(user, pass, handler)
    // Then either join a room or list the available rooms.
    .then(() => {
      ui.setConnectionStatus(true);
      ui.messageInfo(strings.info.connection.connected);
      config.settings.sync.auto && this.tryCommand('sync');
      // A room in the URL fragment (even an empty one) overrides autojoin.
      if (ui.getFragment() || config.settings.xmpp.autoJoin && !ui.urlFragment) {
        const room = ui.getFragment() || config.settings.xmpp.room;
        // Try to join, but ignore failures.
        return this.execute('join', {room}).catch(e => {
          this.handleError(e);
          return this.execute('list');
        });
      }
      else return this.execute('list');
    })
    // Notify user of connection failures.
    .catch(error => {
      ui.setConnectionStatus(false);
      switch (error.status) {
        case Strophe.Status.AUTHFAIL:
          throw new this.Error(strings.error.connection.authfail);
        case Strophe.Status.CONNFAIL:
          if (error.error == 'x-strophe-bad-non-anon-jid') {
            throw new this.Error(strings.error.connection.anonymous)
          }
          throw new this.Error(strings.error.connection.connfail);
        case Strophe.Status.ERROR:
          throw new this.Error(strings.error.connection.other);
      }
      throw error;
    });
  },

  /**
   * Convert arguments to room configuration form.
   */
  roomConf(args) {
    const conf = {};
    const {title, desc, log, persistent, anonymous, password} = args;
    const _public = args['public'];
    const membersonly = args['members-only'];

    if (title)
      conf['muc#roomconfig_roomname'] = title;
    if (desc) conf['muc#roomconfig_roomdesc'] = desc;
    if (log !== undefined)
      conf['muc#roomconfig_enablelogging'] = log ? '1' : '0';
    if (persistent !== undefined)
      conf['muc#roomconfig_persistentroom'] = persistent ? '1' : '0';
    if (_public !== undefined)
      conf['muc#roomconfig_publicroom'] = _public ? '1' : '0';
    if (anonymous !== undefined)
      conf['muc#roomconfig_whois'] = anonymous ? 'moderators' : 'anyone';
    if (password !== undefined) {
      conf['muc#roomconfig_passwordprotectedroom'] = password ? '1' : '0';
      conf['muc#roomconfig_roomsecret'] = password;
    }
    if (membersonly !== undefined)
      conf['muc#roomconfig_membersonly'] = membersonly ? '1' : '0';
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
    return key.split('.').reduce((x, y) => x[y], config.settings);
  },

  /**
   * Take a dotted string and set that settings key to the
   * given value. Immediately saves.
   */
  setSetting(key, val) {
    const path = key.split('.');
    const last = path.pop();
    const ref = path.reduce((x, y) => x[y], config.settings);
    if (ref[last] !== val) {
      ref[last] = val;
      this.saveSettings(true);
    }
  },

  loadSettings(settings) {
    if (!settings) return;
    if (settings.version == config.version) config.settings = settings;
    else {
      // Merge and update the version.
      config.settings = Object.merge(config.settings, settings);
      config.settings.version = config.version;
    }
  },

  /**
   * Serialize the settings object and save it in the cookie.
   *
   * @param {boolean} update Sets the modification time.
   */
  saveSettings(update) {
    if (update) config.settings.modified = (new Date()).toISOString();
    if (window.localStorage) {
      localStorage.settings = JSON.stringify(config.settings);
    }
    else {
      Cookies.set(config.clientName + '_settings', config.settings, {expires: 365});
    }
  },

  synchronizeSettings(type) {
    const old = config.settings.sync.account;
    const account = xmpp.jid.node;

    // We're already synchronized with another account.
    if (old && old != account && !type) {
      throw new Cadence.Error(strings.error.sync.change, {old, new: account});
    }

    const settings = config.settings;
    const local = new Date(settings.modified).getTime();
    const sync = new Date(settings.sync.time).getTime();

    const set = () => {
      config.settings.sync = {account, time: settings.modified, auto: true};
      xmpp.storeSettings(settings).then(() => {
        Cadence.saveSettings();
        ui.loadSettings();
        ui.messageInfo(strings.info.sync.set);
      });
    };

    const get = stored => {
      if (!stored.sync) throw new Cadence.Error(strings.error.sync.missing);
      stored.sync.time = stored.modified;
      Cadence.loadSettings(stored);

      ui.loadSettings(); // Apply the new settings.
      this.saveSettings();
      ui.messageInfo(strings.info.sync.get);
    };

    if (type === 'set') return set();

    return xmpp.loadSettings().then(stored => {
      if (type == 'get') return get(stored);

      // If there is no stored data, store it.
      if (!stored) return set();
      // If we have never synchronized, then load.
      if (!old) return get(stored);
      const remote = new Date(stored.modified).getTime();
      if (local == remote) return ui.messageInfo(strings.info.sync.equal);
      if (sync == local) return get(stored);
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
      if (!xmpp.connection.authenticated) {
        throw new Cadence.Error(strings.error.cmdState.online);
      }
      return true;
    },

    offline() {
      if (xmpp.connection.authenticated) {
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
