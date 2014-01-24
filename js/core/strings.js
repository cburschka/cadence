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
    ],
  },

  code: {
    201: 'The room {room} has been newly created.',
    210: 'Your nick has been modified by the server.',
  },

  info: {
    joined: 'Now talking in {room}.',
    joining: 'Joining {room} as {user} ...',
    leave: 'Leaving {room} ...',
    nickRegistered: 'Switching to registered nick {nick}.',
    rejoinNick: 'Rejoining as {nick} ...',
    userIn: '{user} logs into the Chat.',
    userNick: '{user.from} is now known as {user.to}.',
    userOut: '{user} has logged out of the Chat.',
    noUsers: 'No users are online in {room}.',
    roomsAvailable: 'Available rooms: {raw.rooms}',
    usersInRoom: 'Users in {room}: {users}.',
    usersInThisRoom: 'Users in this room: {raw.users}.',
    whisperTo: '(whispers to {nick})',
    whisper: '(whispers)',
    kicked: [
      '{user} has been kicked.',
      '{user} has been kicked ({reason}).',
      '{user.actor} has kicked {user}.',
      '{user.actor} has kicked {user} ({reason}).'
    ],
    kickedMe: [
      'You have been kicked!',
      'You have been been kicked ({reason})!',
      'You have been kicked by {user.actor}!',
      'You have been kicked by {user.actor} ({reason})!'
    ],
    nickPrejoin: 'Your preferred nickname is now {nick}',
    sessionAuth: 'Automatically logging in as {username}',
    leavePage: 'Leaving this page will delete the chat history.',
    macros: 'Macros:<br /><code>{macros}</code>',
    aliasAdd: 'Alias /{cmd} added.',
    aliasReplace: 'Alias /{cmd} replaced.',
    aliasDelete: 'Alias /{cmd} deleted.',
  },

  error: {
    aliasFormat: 'Usage: /alias &lt;cmd&gt; /&lt;...&gt;[; /&lt;...&gt;]*',
    aliasConflict: '/alias: Can\'t overwrite command /{cmd}.',
    aliasRecursion: 'Failed to execute macro; it is probably recursive.',
    noMacros: 'No macros are defined.',
    cmdStatus: {
      online: '/{cmd}: You are already online.',
      offline: '/{cmd}: You are offline.',
      waiting: '/{cmd}: Not available while connecting.',
      prejoin: '/{cmd}: You need to join a room first.',
    },
    kick: {
      405: 'You don\'t have the authority to kick {nick}.',
      406: 'You can\'t kick {nick} because they\'re not in the room.',
    },
    cmdUnknown: 'Unknown command: /{cmd}. Type "/say /{cmd}" or "//{cmd}" to say this in chat.',
    joinConflict: 'Unable to join; username {nick} already in use.',
    joinSame: 'You are already in {room}.',
    nickConflict: 'Username {nick} already in use.',
    userpass: 'User and password are required.',
    unknownRoom: 'Room {room} does not exist.',
    unknownRoomAuto: 'Cannot rejoin {room}; it doesn\'t exist.',
    unknownUser: 'User {nick} not found.',
    noRoomsAvailable: 'There are no rooms available.',
  }
};
