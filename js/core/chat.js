/**
 * chat.js contains all the functions that alter the state
 * in response to user requests.
 *
 * @author Christoph Burschka <christoph@burschka.de>
 * @year 2014
 * @license GPL3+
 */
var chat = {
  /**
   * All commands executable in chat by prefixing them with '/'.
   */
  commands: {
    /**
     * away <msg>:
     *   Send a room presence with <show/> set to "away" and
     *   <status/> to "msg".
     */
    away: function(arg) {
      arg = arg.trim().match(/^\(*(.*?)\)*$/);
      xmpp.sendStatus('away', arg[1].trim());
    },

    /**
     * back <msg>:
     *   Send an empty room presence that unsets <show/> and <status/>.
     */
    back: function() {
      xmpp.sendStatus();
    },

    /**
     * connect <user> <pass>
     * connect {user:<user>, pass:<pass>}
     *   Open a connection and authenticate.
     */
    connect: function(arg) {
      if (typeof arg == 'string') {
        var m = /^([^\s"&'\/:<>@]*)(.*)$/.exec(arg.trim());
        arg = {user: m[1], pass: m[2].trim()};
      }
      if (!arg.user || !arg.pass)
        return ui.messageAddInfo('User and password are required.', 'error');
      if (arg.pass[0] == '"' && arg.pass[arg.pass.length-1] == '"') {
        arg.pass = arg.pass.substring(1, arg.pass.length-1);
      }
      xmpp.newConnection(arg.user, arg.pass);
    },

    /**
     * me <msg>
     *   Alias for /say "/me <msg>".
     */
    me: function(arg) {
      this.say('/me ' + arg); // XEP-0245 says to send this in plain.
    },

    /**
     * nick <nick>
     *   Ask XMPP to change the nick in the current room.
     */
    nick: function(arg) {
      var nick = visual.lengthLimit(visual.textPlain(arg.trim().replace(/ /g, '_')), config.ui.maxNickLength);
      xmpp.changeNick(nick);
    },

    /**
     * join <room>
     *   Ask XMPP to join <room>. If successful, XMPP
     *   will automatically leave the current room.
     */
    join: function(arg) {
      var room = arg.trim();
      if (xmpp.room.current == room) {
        return ui.messageAddInfo('You are already in room {room}.', {room:room}, 'error');
      }
      xmpp.joinRoom(room);
      chat.setSetting('xmpp.room', room);
    },

    /**
     * quit
     *   Ask XMPP to disconnect.
     */
    quit: function(arg) {
      xmpp.disconnect();
    },

    /**
     * say <msg>
     *   The default command that simply sends a message verbatim.
     */
    say: function(arg) {
      arg = visual.lengthLimit(visual.textPlain(arg), config.ui.maxMessageLength);
      chat.sendMessage(arg);
    },
  },

  /**
   * List the commands available by connection state.
   * This saves having to check the connection state in
   * each command handler.
   */
  cmdAvailableStatus: {
    online: ['away', 'back', 'join', 'me', 'nick', 'quit', 'say'],
    offline: ['connect'],
    waiting: ['connect', 'quit'],
  },

  /**
   * Parse input sent by the user and execute the appropriate command.
   */
  executeInput: function(text) {
    text = text.trim();
    if (!text) return;

    // Without commands, execute /say.
    var cmd = 'say';

    // Execute /cmd, but turn //cmd into /say /cmd.
    if (text[0] == '/') {
      if (text[1] != '/') {
        var i = text.indexOf(' ');
        if (i < 0) i = text.length;
        cmd = text.substring(1, i);
        text = text.substring(i);
      }
      else text = text.substring(1);
    }

    if (this.commands[cmd]) {
      if (this.cmdAvailableStatus[xmpp.status].indexOf(cmd) < 0) {
        return ui.messageAddInfo('/{cmd} command not available while {status}', {cmd:cmd,status:xmpp.status}, 'error');
      }
      this.commands[cmd](text);
    }
    else {
      ui.messageAddInfo('Unknown command: /{cmd}. Type "/say /{cmd}" or "//{cmd}" to say this in chat.', {cmd:cmd}, 'error');
    }
  },

  /**
   * Ask XMPP to send a message to the current room.
   */
  sendMessage: function(text) {
    html = bbcode.render(text);
    if (config.settings.textColor) {
      html = '<span class="color color-' + config.settings.textColor.substring(1) + '">' + html + '</span>';
    }
    xmpp.sendMessage(html);
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
    var inputFieldJQ = ui.dom.inputField;
    var inputField = inputFieldJQ[0]
    var start = inputField.selectionStart;
    var end = inputField.selectionEnd;
    var old = inputFieldJQ.val();
    rep = (typeof text == 'string') ? text : text[0] + old.substring(start, end) + text[1];
    inputFieldJQ.val(old.substring(0, start) + rep + old.substring(end));
    start += (start < end || rep == text) ? rep.length : text[0].length;
    end = start;
    inputField.selectionStart = start;
    inputField.selectionEnd = end;
  },

  /**
   * Take a dotted string and return the respective value
   * in the settings dictionary.
   */
  getSetting: function(key) {
    var path = key.split('.');
    var ref = config.settings;
    for (var i = 0; i < path.length; i++) {
      ref = ref[path[i]];
    }
    return ref;
  },

  /**
   * Take a dotted string and set that settings key to the
   * given value. Immediately saves.
   */
  setSetting: function(key, val) {
    var path = key.split('.');
    var ref = config.settings;
    for (var i = 0; i < path.length - 1; i++) {
      ref = ref[path[i]];
    }
    ref[path[path.length-1]] = val;
    this.saveSettings();
  },

  /**
   * Serialize the settings object and save it in the cookie.
   */
  saveSettings: function() {
    $.cookie(config.sessionName + '_settings', config.settings);
  }
}
