/**
 * chat.js contains all the functions that alter the state
 * in response to user requests.
 *
 * @author Christoph Burschka <christoph@burschka.de>
 * @year 2014
 * @license GPL3+
 */
var chat = {
  history: [],
  historyIndex: 0,

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
     * clear:
     *   Clear the entire chat list screen.
     */
    clear: function() {
      ui.clearMessages();
      this.history = [];
      this.historyIndex = 0;
    },

    /**
     * connect <user> <pass>
     * connect {user:<user>, pass:<pass>}
     *   Open a connection and authenticate.
     */
    connect: function(arg) {
      var fail = function() { return ui.messageAddInfo(strings.error.userpass, 'error') };
      if (typeof arg == 'string') {
        var m = /^([^\s"&'\/:<>@]*)(.*)$/.exec(arg.trim());
        arg = {user: m[1], pass: m[2].trim()};
      }
      if (!arg.user || !arg.pass) {
        if (config.settings.xmpp.sessionAuth && config.xmpp.sessionAuthURL)
          return chat.sessionAuth(config.xmpp.sessionAuthURL, fail);
        else return fail();
      }
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
      var nick = visual.lengthLimit(visual.textPlain(arg.trim().replace(/\s/g, '%20'), config.ui.maxNickLength);
      xmpp.changeNick(nick);
    },

    /**
     * join <room>
     *   Ask XMPP to join <room>. If successful, XMPP
     *   will automatically leave the current room.
     */
    join: function(arg) {
      var room = chat.getRoomFromTitle(arg.trim());
      if (!room)
        return ui.messageAddInfo(strings.error.unknownRoom, {room: arg.trim()}, 'error');
      if (xmpp.room.current == room.id) {
        return ui.messageAddInfo(strings.error.joinSame, {
          room: visual.formatRoom(room)
        }, 'error');
      }
      xmpp.joinRoom(room.id);
      chat.setSetting('xmpp.room', room.id);
    },

    /**
     * list:
     *   List available rooms.
     */
    list: function() {
      xmpp.discoverRooms(function(rooms) {
        var links = [];
        for (var room in rooms) {
          links.push(
               '<a href="javascript:void()" onclick="chat.commands.join(\''
             + room + '\');"'
             + (room == xmpp.room.current ? ' style="font-weight: bold"' : '')
             + '>' + visual.formatRoom(rooms[room]) + '</a>'
          );
        }
        ui.messageAddInfo(strings.info.roomsAvailable, {rooms: links.join(', ')});
      });
    },

    /**
     * msg <nick> <msg>
     *   Send a private message to another occupant.
     */
    msg: function(arg) {
      arg = /^(.+?)\s+(.+)$/.exec(arg.trim());
      var nick = arg[1];
      if (!xmpp.roster[xmpp.room.current][nick])
        return ui.messageAddInfo(strings.error.unknownUser, {nick: nick}, 'error');
      var msg = visual.lengthLimit(visual.textPlain(arg[2]), config.ui.maxMessageLength);
      chat.sendMessage(msg, nick);
      ui.messageAppend(visual.formatMessage({
        type: 'chat',
        to: nick,
        user: xmpp.roster[xmpp.room.current][xmpp.nick.current],
        body: chat.formatOutgoing(msg)
      }));
    },

    /**
     * part
     *   Leave the current room without joining a different one.
     */
    part: function() {
      if (xmpp.room.current) xmpp.leaveRoom(xmpp.room.current);
    },

    /**
     * quit
     *   Ask XMPP to disconnect.
     */
    quit: function() {
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

    /**
     * who [room]
     *   Query the user list of a room.
     */
    who: function(arg) {
      arg = arg.trim();
      var room = arg ? chat.getRoomFromTitle(arg) : xmpp.room.available[xmpp.room.current];
      console.log(room);
      if (!room)
        return ui.messageAddInfo(arg ? strings.error.unknownRoom : 'You are not in a room.', {room: arg}, 'error');
      if (room.id != xmpp.room.current) {
        xmpp.getOccupants(room.id, function(users) {
          var out = [];
          for (var nick in users) out.push(nick)
          if (users) ui.messageAddInfo(strings.info.usersInRoom, {
            room: visual.formatRoom(room),
            users: out.join(', ')
          });
          else ui.messageAddInfo(strings.info.noUsers, {
            room: visual.formatRoom(room)
          });
        })
      }
      else {
        var links = []
        for (var user in xmpp.roster[xmpp.room.current])
          links.push(visual.formatUser(xmpp.roster[xmpp.room.current][user]));
        ui.messageAddInfo(strings.info.usersInThisRoom, {users:links.join(', ')});
      }
    }
  },

  /**
   * List the commands available by connection state.
   * This saves having to check the connection state in
   * each command handler.
   */
  cmdAvailableStatus: {
    online: ['away', 'back', 'clear', 'join', 'list', 'me', 'msg', 'nick', 'part', 'quit', 'say', 'who'],
    prejoin: ['join', 'list', 'nick', 'quit', 'who'],
    offline: ['clear', 'connect'],
    waiting: ['clear', 'connect', 'quit'],
  },

  /**
   * Parse input sent by the user and execute the appropriate command.
   */
  executeInput: function(text) {
    this.history.push(text);
    this.historyIndex = this.history.length;
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
        return ui.messageAddInfo(strings.error.cmdStatus, {cmd:cmd,status:xmpp.status}, 'error');
      }
      this.commands[cmd](text);
    }
    else {
      ui.messageAddInfo(strings.error.cmdUnknown, {cmd:cmd}, 'error');
    }
  },

  /**
   * Ask XMPP to send a message to the current room, or one of its occupants.
   *
   * @param {string} text: The message to send (already escaped, but pre-BBCode).
   * @param {string} nick: The recipient, or undefined.
   */
  sendMessage: function(text, nick) {
    html = this.formatOutgoing(text);
    xmpp.sendMessage(html, nick);
  },

  /**
   * Format an outgoing message.
   *
   * @param {string} text The message to send.
   * @return {string} The HTML output.
   */
  formatOutgoing: function(text) {
    html = bbcode.render(text);
    if (config.settings.textColor) {
      html = '<span class="color color-' + config.settings.textColor.substring(1) + '">' + html + '</span>';
    }
    return html;
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
   * Find a room by its title.
   */
  getRoomFromTitle: function(title) {
    if (xmpp.room.available[title]) return xmpp.room.available[title];
    for (var room in xmpp.room.available) {
      if (xmpp.room.available[room].title == title)
          return xmpp.room.available[room];
    }
  },

  /**
   * Attempt to authenticate using an existing web session.
   */
  sessionAuth: function(url, callback) {
    var salt = (new Date().getTime()) + Math.random();
    $.post(url, {salt: salt}, function(data) {
      if (!data) return;
      if (data.user && data.secret) {
        ui.messageAddInfo(strings.info.sessionAuth, {user:data.user});
        chat.commands.connect({user:data.user, pass:data.secret});
      }
      else {
        ui.setStatus('offline');
        if (callback) callback();
      }
    }, 'json').fail(callback);
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
