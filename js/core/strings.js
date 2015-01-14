/**
 * strings.js contains all user-facing strings that the client will generate.
 *
 * @author Christoph Burschka <christoph@burschka.de>
 * @year 2014
 * @license GPL3+
 */
var strings = {
  init: function() {
    var connection = {};
    connection[Strophe.Status.ERROR] = this.connection.error;
    connection[Strophe.Status.CONNECTING] = this.connection.connecting;
    connection[Strophe.Status.CONNFAIL] = this.connection.connfail;
    connection[Strophe.Status.AUTHENTICATING] = this.connection.authenticating;
    connection[Strophe.Status.AUTHFAIL] = this.connection.authfail;
    connection[Strophe.Status.CONNECTED] = this.connection.connected;
    connection[Strophe.Status.DISCONNECTED] = this.connection.disconnected;
    connection[Strophe.Status.DISCONNECTING] = this.connection.disconnecting;
    connection[Strophe.Status.ATTACHED] = this.connection.attached;
    this.connection = connection;
  },

  connection: {
    error : 'An error has occurred.',
    connecting : 'Connecting ...',
    connfail : 'Connection failed.',
    authenticating : 'Authenticating...',
    authfail : 'Authentication failed.',
    connected : 'You are now connected.',
    disconnected : 'You are now disconnected.',
    disconnecting : 'Disconnecting ...',
    attached : 'Session resumed.',
  },

  show: {
    away: [
      '{user} is away.',
      '{user} is away ({status}).',
    ],
    xa: [
      '{user} is away.',
      '{user} is away ({status}).',
    ],
    busy: [
      '{user} is busy.',
      '{user} is busy ({status}).',
    ],
    'default': [
      '{user} has returned.',
      '{user} has returned ({status}).',
    ],
  },

  code: {
    201: 'The room {name} has been newly created.',
    210: 'Your nick has been modified by the server.',
  },

  info: {
    joined: 'Now talking in {room}.',
    joining: 'Joining {room} as {user} ...',
    creating: 'Creating {room} as {user} ...',
    leave: 'Leaving {room} ...',
    nickRegistered: 'Switching to registered nick {nick}.',
    rejoinNick: 'Rejoining as {nick} ...',
    userIn: '{user} logs into the Chat.',
    userNick: '{user.from} is now known as {user.to}.',
    userOut: '{user} has logged out of the Chat.',
    motd: 'Announcement from {domain}: {raw.text}',
    noUsers: 'No users are online in {room}.',
    roomsAvailable: 'Available rooms: {raw.rooms}',
    usersInRoom: 'Users in {room}: {raw.users}.',
    usersInThisRoom: 'Users in this room: {raw.users}.',
    whisperTo: '(whispers to {nick})',
    whisper: '(whispers)',
    evicted: {
      kick: {
        me: [
          'You have been kicked!',
          'You have been been kicked ({reason})!',
          'You have been kicked by {user.actor}!',
          'You have been kicked by {user.actor} ({reason})!'
        ],
        other: [
          '{user} has been kicked.',
          '{user} has been kicked ({reason}).',
          '{user.actor} has kicked {user}.',
          '{user.actor} has kicked {user} ({reason}).'
        ],
      },
      ban: {
        me: [
          'You have been banned from {room}!',
          'You have been been banned from {room} ({reason})!',
          'You have been banned from {room} by {user.actor}!',
          'You have been banned from {room} by {user.actor} ({reason})!'
        ],
        other: [
          '{user} has been banned from {room}.',
          '{user} has been banned from {room} ({reason}).',
          '{user.actor} has banned {user} from {room}.',
          '{user.actor} has banned {user} from room ({reason}).'
        ],
      },
    },
    nickPrejoin: 'Your preferred nickname is now {nick}',
    sessionAuth: 'Automatically logging in as {username}',
    leavePage: 'Leaving this page will delete the chat history.',
    macros: 'Macros:<br /><code>{macros}</code>',
    aliasAdd: 'Alias /{cmd} added.',
    aliasReplace: 'Alias /{cmd} replaced.',
    aliasDelete: 'Alias /{cmd} deleted.',
    versionClient: 'Cadence version: {raw.version}',
    versionServer: 'Server version: {name} {version} running on {os}',
    banList: 'Banned users in this room:\n{users}',
    banListEmpty: 'No users are banned from this room.',
    banSuccess: 'You have banned {user} from {room}.',
    unbanSuccess: 'Unbanned {jid} from this room.',
    affiliateSuccess: 'Affiliation of {user} in {room} set to {type}.',
  },

  error: {
    admin: {
      forbidden: 'You are not authorized to execute "{command}" on this server.',
      badCommand: 'Unrecognized server command "{command}".',
      generic: 'Error while executing "{command}": {text}',
    },
    affiliate: {
      anon: 'You cannot see {user}\'s JID.',
      'default': 'Unknown error while attempting to change {user}\'s affiliation in {room}.',
      notAllowed: 'You lack the authority to do this.',
      outcast: 'Use the /ban command to do this.',
      syntax: 'Syntax: /affiliate owner|admin|member|none &lt;nick|JID&gt;',
      unknown: 'Nobody in {room} is named {nick}. Enter the JID.',
    },
    aliasFormat: 'Usage: /alias &lt;cmd&gt; /&lt;...&gt;[; /&lt;...&gt;]*',
    aliasConflict: '/alias: Can\'t overwrite command /{cmd}.',
    aliasRecursion: 'Failed to define {cmd}; recursion detected via {path}.',
    noMacros: 'No macros are defined.',
    badNick: 'The nickname {nick} is invalid.',
    ban: {
      'default': 'Unknown error while attempting to ban {user} from {room}.',
      notAllowed: 'You lack the authority to ban {user} from {room}.',
      self: 'You can\'t ban yourself!'
    },
    banList: {
      'default': 'Unknown error while getting the ban list.',
      forbidden: 'You are not authorized to get the ban list for this room.',
    },
    cmdStatus: {
      online: '/{cmd}: You are already online.',
      offline: '/{cmd}: You are offline.',
      prejoin: '/{cmd}: You need to join a room first.',
    },
    kick: {
      405: 'You lack the authority to kick {nick}.',
      406: 'You can\'t kick {nick} because they\'re not in the room.',
    },
    cmdUnknown: 'Unknown command: /{cmd}. Type "/say /{cmd}" or "//{cmd}" to say this in chat.',
    joinBanned: 'You are banned from {room}.',
    joinConflict: 'Unable to join; username {nick} already in use.',
    joinSame: 'You are already in {room}.',
    nickConflict: 'Username {nick} already in use.',
    noCreate: 'You are not allowed to create rooms.',
    noNick: 'You must set a nickname.',
    roomConf: 'The following fields could not be set on {name}: {fields}',
    roomExists: 'Could not create {room}; it already exists.',
    unban: 'Could not unban {jid} from this room.',
    unbanNone: 'No banned user matched your query.',
    userpass: 'User and password are required.',
    unknownRoom: 'Room {name} does not exist.',
    unknownRoomAuto: 'Cannot rejoin {name}; it doesn\'t exist.',
    unknownUser: 'User {nick} not found.',
    noRoomsAvailable: 'There are no rooms available.',
  }
};
