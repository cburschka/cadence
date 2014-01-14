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
    away: '[user] is away{status}.',
    xa: '[user] is away{status}.',
    busy: '[user] is busy{status}.',
    default: '[user] has returned.',
  },

  code: {
    201: 'The room {room} has been newly created.',
    210: 'Your nick has been modified by the server.',
  },

  info: {
    joined: 'Now talking in {room}.',
    joining: 'Joining {room} as [user] ...',
    leave: 'Leaving {room} ...',
    nickRegistered: 'Switching to registered nick {nick}.',
    rejoinNick: 'Rejoining as {nick} ...',
    userIn: '[user] logs into the Chat.',
    userNick: '[from] is now known as [to].',
    userOut: '[user] has logged out of the Chat.',
    noUsers: 'No users are online in {room}.',
    roomsAvailable: 'Available rooms: [rooms]',
    usersInRoom: 'Users in {room}: {users}.',
    usersInThisRoom: 'Users in this room: [users].',
    whisperTo: '(whispers to {nick})',
    whisper: '(whispers)',
    kicked: [
      '[user] has been kicked.',
      '[user] has been kicked ({reason}).',
      '[actor] has kicked [user].',
      '[actor] has kicked [user] ({reason}).'
    ],
    kickedMe: [
      'You have been kicked!',
      'You have been been kicked ({reason})!',
      'You have been kicked by [actor]!',
      'You have been kicked by [actor] ({reason})!'
    ],
    nickPrejoin: 'Your preferred nickname is now {nick}',
  },

  error: {
    cmdStatus: '/{cmd} command not available while {status}',
    cmdUnknown: 'Unknown command: /{cmd}. Type "/say /{cmd}" or "//{cmd}" to say this in chat.',
    joinConflict: 'Unable to join; username already in use.',
    joinSame: 'You are already in room {room}.',
    nickConflict: 'Username already in use.',
    userpass: 'User and password are required.',
    unknownRoom: 'Room {room} does not exist.',
    unknownUser: 'User {nick} not found.',
  }
};
