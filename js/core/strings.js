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
    dnd: [
      '{user} is busy.',
      '{user} is busy ({status}).',
    ],
    'default': [
      '{user} has returned.',
      '{user} has returned ({status}).',
    ],
  },
  showOther: [
    '{user} changed mode to "{show}".',
    '{user} changed mode to "{show}" ({status}).',
  ],

  code: {
    201: 'The room {name} has been newly created.',
    210: 'Your nick has been modified by the server.',
  },

  info: {
    admin: {
      result: 'Completed command "{command}":\n{raw:result}',
      completed: 'Completed command "{command}".'
    },
    affiliate: [
      'Affiliation of {jid} in {room} set to {type}.',
      'Affiliation of {user} in {room} set to {type}.'
    ],
    affiliations: {
      'outcast': 'Banned users in this room:\n{raw:users}',
      'member': 'Members of this room:\n{raw:users}',
      'admin': 'Administrators of this room:\n{raw:users}',
      'owner': 'Owners of this room:\n{raw:users}',
    },
    affiliationsEmpty: 'No users have the affiliation "{type}" in this room.',
    aliasAdd: 'Alias /{cmd} added.',
    aliasDelete: 'Alias /{cmd} deleted.',
    aliasReplace: 'Alias /{cmd} replaced.',
    creating: 'Creating {room} as {user} ...',
    destroyed: [
      [
        '{room} has been destroyed!',
        '{room} has been destroyed ({reason})!',
      ],
      [
        '{room} has been destroyed in favor of {room:alternate}!',
        '{room} has been destroyed in favor of {room:alternate} ({reason})!',
      ]
    ],
    destroySuccess: 'Successfully destroyed room {room}.',
    evicted: {
      kick: {
        me: [
          'You have been kicked!',
          'You have been been kicked ({reason})!',
          'You have been kicked by {user:actor}!',
          'You have been kicked by {user:actor} ({reason})!'
        ],
        other: [
          '{user} has been kicked.',
          '{user} has been kicked ({reason}).',
          '{user:actor} has kicked {user}.',
          '{user:actor} has kicked {user} ({reason}).'
        ],
      },
      ban: {
        me: [
          'You have been banned from {room}!',
          'You have been been banned from {room} ({reason})!',
          'You have been banned from {room} by {user:actor}!',
          'You have been banned from {room} by {user:actor} ({reason})!'
        ],
        other: [
          '{user} has been banned from {room}.',
          '{user} has been banned from {room} ({reason}).',
          '{user:actor} has banned {user} from {room}.',
          '{user:actor} has banned {user} from room ({reason}).'
        ],
      },
    },
    inviteReceived: [
      '{user} has invited you to {room}.',
      '{user} has invited you to {room} ({reason}).'
    ],
    inviteSent: 'Inviting {jid} to {room}.',
    joined: 'Now talking in {room}.',
    joining: 'Joining {room} as {user} ...',
    joinPassword: 'This room requires a password.',
    leave: 'Leaving {room} ...',
    leavePage: 'Leaving this page will delete the chat history.',
    macros: 'Macros:<br /><code>{macros}</code>',
    motd: 'Announcement from {domain}: {raw:text}',
    nickConflictResolve: 'This nickname is in user; enter another one.',
    nickPrejoin: 'Your preferred nickname is now {nick}',
    nickRegistered: 'Switching to registered nick {nick}.',
    noUsers: 'No users are online in {room}.',
    pong: 'Ping to {target}: Pong ({delay} ms).',
    pongError: 'Ping to {target}: Target does not support ping ({delay} ms).',
    rejoinNick: 'Rejoining as {nick} ...',
    roomConf: 'Room configuration of {room} has been altered.',
    roomsAvailable: 'Available rooms: {raw:rooms}',
    sessionAuth: 'Automatically logging in as {username}',
    userIn: '{user} has joined the room.',
    userNick: '{user:from} is now known as {user:to}.',
    userOut: '{user} has left the room.',
    unbanSuccess: 'Unbanned {jid} from this room.',
    usersInRoom: 'Users in {room}: {raw:users}.',
    usersInThisRoom: 'Users in this room: {raw:users}.',
    versionClient: 'Cadence version: {raw:version}',
    versionServer: 'Server version: {name} {version} running on {os}',
    whisper: '(whispers)',
    whisperTo: '(whispers to {user})',
    whois: 'Information for {user}: {jid}, Role: {privilege}, Status: {status}'
  },

  error: {
    admin: {
      forbidden: 'You are not authorized to execute "{command}" on this server.',
      badCommand: 'Unrecognized server command "{command}".',
      generic: 'Error while executing "{command}": {text}',
      unknown: 'Unknown error while executing "{command}".'
    },
    affiliate: {
      anon: 'You cannot access the JID of {user} in this room.',
      conflict: 'You cannot change your own affiliation in this way.',
      'default': 'Unknown error while attempting to set affiliation.',
      notAllowed: 'You lack the authority to do this.',
      type: 'Affiliation "{type}" must be one of "owner", "admin", "member", "none", "outcast".',
      unknown: 'There is no user named {nick} in this room.',
    },
    affiliations: {
      'default': 'Unknown error while getting the list of {type} affiliations.',
      forbidden: 'You are not authorized to get the {type} list for this room.',
    },
    aliasFormat: 'Usage: /alias &lt;cmd&gt; /&lt;...&gt;[; /&lt;...&gt;]*',
    aliasConflict: '/alias: Can\'t overwrite command /{cmd}.',
    aliasRecursion: 'Failed to define {cmd}; recursion detected via {path}.',
    noMacros: 'No macros are defined.',
    badNick: 'The nickname {nick} is invalid.',
    cmdStatus: {
      online: '/{cmd}: You are already online.',
      offline: '/{cmd}: You are offline.',
      prejoin: '/{cmd}: You need to join a room first.',
    },
    destroyDenied: 'You lack the authority to destroy {room}.',
    destroy: 'Failed to destroy {room}.',
    kick: {
      405: 'You lack the authority to kick {nick}.',
      406: 'You can\'t kick {nick} because they\'re not in the room.',
    },
    cmdUnknown: 'Unknown command: /{cmd}. Type "/say /{cmd}" or "//{cmd}" to say this in chat.',
    jidInvalid: '{jid} is not a valid JID.',
    joinBanned: 'You are banned from {room}.',
    joinConflict: 'Unable to join; username {nick} already in use.',
    joinPassword: 'A password is required to enter {room}.',
    joinSame: 'You are already in {room}.',
    nickConflict: 'Username {nick} already in use.',
    noArgument: 'This command requires more arguments.',
    noCreate: 'You are not allowed to create rooms.',
    noRoom: 'You are not in a room and did not specify one.',
    pingTimeout: 'Ping to {target} timed out ({delay}).',
    roomConf: 'Failed to configure {room}.',
    roomConfDenied: 'You lack the authority to configure {room}.',
    roomConfFields: 'The following fields could not be set on {name}: {fields}',
    roomConfOptions: 'The allowed values for {field} are: {options}',
    roomExists: 'Could not create {room}; it already exists.',
    roomCreateName: 'Could not create a room without a name.',
    saveEmpty: 'There are no messages to save.',
    unban: 'Could not unban {jid} from this room.',
    unbanNone: 'No banned user matched your query.',
    userpass: 'User and password are required.',
    unknownJid: 'User {user} is anonymous.',
    unknownRoom: 'Room {name} does not exist.',
    unknownRoomAuto: 'Cannot rejoin {name}; it doesn\'t exist.',
    unknownUser: 'User {nick} not found.',
    noRoomsAvailable: 'There are no rooms available.',
  },

  help: {
    configure: 'Configuration arguments:\
  <dl><dt><code>--title &lt;...&gt;</code></dt><dd>Set human-readable room title.</dd>\
  <dt><code>--desc &lt;...&gt;</code></dt><dd>Set the room description.</dd>\
  <dt><code>--log, --log 0</code></dt><dd>Toggle logging.</dd>\
  <dt><code>--persistent, --persistent 0</code></dt><dd>Toggle room persistence.</dd>\
  <dt><code>--public, --public 0</code></dt><dd>Make the room public or private (unlisted).</dd>\
  <dt><code>--anonymous, --anonymous 0</code></dt><dd>Toggle anonymity. This determines whether non-moderators can see participants\' full JID.</dd>\
  <dt><code>--password &lt;...&gt;, --password 0</code></dt><dd>Set or remove a room password.</dd>\
  <dt><code>--max-users &lt;...&gt;</code></dt><dd>Set the user limit.</dd>\
  <dt><code>--members-only, --members-only 0</code></dt><dd>Toggle the members-only status.</dd>\
  <dt><code>--moderation [closed|open|none]</code></dt><dd>An open or closed room allows participants to be muted; in a closed room participants are muted by default.</dd>\
  <dt><code>--msg, --msg 0</code></dt><dd>Toggle private messaging.</dd></dl>'
  },

  labels: {
    commands: {
      ban: 'Ban',
      dmsg: 'Direct message',
      invite: 'Invite',
      kick: 'Kick',
      msg: 'Private message',
      ping: 'Ping',
      whois: 'User info'
    }
  }
};
