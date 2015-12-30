/**
 * strings.js contains all user-facing strings that the client will generate.
 *
 * Guide to translators:
 *  - Make a copy of this file and alter the string values accordingly.
 *  - Note that markup is only supported in strings that already contain it.
 *
 * @author Christoph Burschka <christoph@burschka.de>
 * @year 2014
 * @license GPL3+
 */
var strings = {
  connection: {
    ERROR : 'An error has occurred.',
    CONNECTING : 'Connecting ...',
    CONNFAIL : 'Connection failed.',
    AUTHENTICATING : 'Authenticating...',
    AUTHFAIL : 'Authentication failed.',
    CONNECTED : 'You are now connected.',
    DISCONNECTED : 'You are now disconnected.',
    DISCONNECTING : 'Disconnecting ...',
    ATTACHED : 'Session resumed.',
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
      result: 'Completed command "{command}":\n{result}',
      completed: 'Completed command "{command}".'
    },
    affiliate: 'Affiliation of {user} in {room} set to {type}.',
    affiliations: {
      'outcast': 'Banned users in this room:\n{list}',
      'member': 'Members of this room:\n{list}',
      'admin': 'Administrators of this room:\n{list}',
      'owner': 'Owners of this room:\n{list}',
    },
    affiliationsEmpty: 'No users have the affiliation "{type}" in this room.',
    aliasAdd: 'Alias /{cmd} added.',
    aliasDelete: 'Alias /{cmd} deleted.',
    aliasReplace: 'Alias /{cmd} replaced.',
    attention: '{user} has buzzed you!',
    creating: 'Creating {room} as {user} ...',
    destroyConfirm: 'Do you really want to destroy the room {name}?',
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
      [
        '{jid} has invited you to {room}.',
        '{jid} has invited you to {room} ({reason}).'
      ],
      [
        '{jid} has invited you to {room}. The password is "{password}".',
        '{jid} has invited you to {room} ({reason}). The password is "{password}".'
      ]
    ],
    inviteSent: 'Inviting {jid} to {room}.',
    joined: 'Now talking in {room}.',
    joining: 'Joining {room} as {user} ...',
    joinPassword: 'This room requires a password.',
    leave: 'Leaving {room} ...',
    leavePage: 'Leaving this page will delete the chat history.',
    macros: 'Macros:<br /><code>{macros}</code>',
    motd: 'Announcement from {domain}: {text}',
    nickConflictResolve: 'This nickname is in user; enter another one.',
    nickPrejoin: 'Your preferred nickname is now {nick}',
    nickRegistered: 'Switching to registered nick {nick}.',
    noUsers: 'No users are online in {room}.',
    pong: [
      'Ping: Pong ({delay} ms).',
      'Ping to {user}: Pong ({delay} ms).'
    ],
    rejoinNick: 'Rejoining as {nick} ...',
    roomConf: 'Room configuration of {room} has been altered.',
    roomsAvailable: 'Available rooms: {list}',
    sessionAuth: 'Automatically logging in as {username}',
    userAffiliation: 'The affiliation of {user} has been set to {affiliation}.',
    userIn: '{user} has joined the room.',
    userNick: '{user:from} is now known as {user:to}.',
    userOut: '{user} has left the room.',
    userRole: 'The role of {user} has been set to {role}.',
    unbanSuccess: 'Unbanned {jid} from this room.',
    usersInRoom: 'Users in {room}: {list}.',
    usersInThisRoom: 'Users in this room: {list}.',
    versionClient: 'Cadence version: {version}',
    versionServer: 'Server version: {name} {version} running on {os}',
    versionUser: '{user} is using: {name} {version} running on {os}',
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
      notAllowed: 'You lack the authority to set the affiliation of {user} to {type}.',
      type: 'Affiliation "{type}" must be one of "owner", "admin", "member", "none", "outcast".',
      unknown: 'There is no user named {nick} in this room.',
    },
    affiliations: {
      'default': 'Unknown error while getting the list of {type} affiliations.',
      forbidden: 'You are not authorized to get the {type} list for this room.',
    },
    aliasFormat: 'Usage: /alias <cmd> /<...>[; /<...>]*',
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
    dmsg: {
      domain: 'The remote server {domain} was not found.',
      node: 'User {node} on {domain} is not available.'
    },
    formFields: 'The following fields could not be set: {fields}',
    kick: {
      405: 'You lack the authority to kick {nick}.',
      406: 'You can\'t kick {nick} because they\'re not in the room.',
    },
    cmdUnknown: 'Unknown command: /{cmd}. Type "/say /{cmd}" or "//{cmd}" to say this in chat.',
    jidInvalid: '{arg} is not a valid JID.',
    joinBanned: 'You are banned from {room}.',
    joinConflict: 'Unable to join; username {nick} already in use.',
    joinPassword: 'A password is required to enter {room}.',
    joinSame: 'You are already in {room}.',
    messageDenied: 'You lack the authority to send this message ({text}).',
    muc: {
      404: 'The conference server {domain} is not available.',
      'default': 'Unknown error while connecting to the conference server {domain}.',
    },
    nickConflict: 'Username {nick} already in use.',
    noArgument: 'This command requires more arguments.',
    noCreate: 'You are not allowed to create rooms.',
    noRoom: 'You are not in a room and did not specify one.',
    pingError: 'Ping: Target does not support ping.',
    pingTimeout: [
      'Ping timed out ({delay} ms).',
      'Ping to {user} timed out ({delay} ms).'
    ],
    roomConf: 'Failed to configure {room}.',
    roomConfDenied: 'You lack the authority to configure {room}.',
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

  label: {
    command: {
      ban: 'Ban',
      configure: 'Configure',
      destroy: 'Destroy',
      dmsg: 'Direct message',
      invite: 'Invite',
      join: 'Join',
      kick: 'Kick',
      msg: 'Private message',
      part: 'Leave',
      ping: 'Ping',
      whois: 'User info'
    },
    tip: {
      multiline: 'Enter one item per line.',
    },
    button: {
      advanced: 'Advanced',
      save: 'Save',
      close: 'Close',
      apply: 'Apply',
      login: 'Log in',
      logout: 'Log out',
      help: 'Help',
      settings: 'Settings',
      roster: 'Users',
      sound: 'Sound',
    },
    page: {
      style: 'Style:',
      room: 'Room:',
      user: 'User:',
      password: 'Password:',
      navigation: 'Navigation:',
      roster: 'Online users',
      help: 'Help',
      settings: {
        main: 'Settings',
        general: 'General',
        display: 'Display',
        notifications: 'Notifications'
      },
      none: '---',
      offline: 'Offline'
    },
    tooltip: {
       input: 'Press SHIFT+ENTER to input a line break',
       bold: 'Bold text: [b]text[/b]',
       italic: 'Italic text: [i]text[/i]',
       underline: 'Underline text: [u]text[/u]',
       strike: 'Strike out text: [s]text[/s]',
       quote: 'Quote text: [quote]text[/quote] or [quote=author]text[/quote]',
       code: 'Code display: [code]code[/code]',
       url: 'Insert URL: [url]http://example.org[/url] or [url=http://example.org]text[/url]',
       img: 'Insert image: [img]http://example.org/image.jpg[/img]',
       color: 'Text color: [color=red]text[/color]',
       help: 'Show/hide help',
       settings: 'Show/hide settings',
       roster: 'Show/hide online list',
       sound: 'Sound on/off',
    },
    settings: {
      xmpp: {
        sessionAuth: 'Log in with forum session',
        autoJoin: 'Join room on login'
      },
      contextmenu: {
        label: 'Open context menu with',
        hover: 'Hover',
        left: 'Left click',
        right: 'Right click'
      },
      textColor: {
        label: 'Text color',
        clear: 'Clear',
        none: 'None'
      },
      dateFormat: 'Date format (<a href="http://momentjs.com/docs/#/displaying/format/">help</a>)',
      markup: {
        html: 'Show HTML markup',
        images: 'Show images in-line',
        links: 'Make URLs clickable',
        colors: 'Show persistent colors',
        emoticons: 'Show emoticons as images'
      },
      verbose: 'Display verbose messages',
      notifications: {
        desktop: {
          label: 'Desktop notifications',
          0: 'None',
          1: 'Alerts',
          2: 'All messages',
          3: 'Everything'
        },
        triggers: 'Alert keywords',
        soundVolume: 'Sound volume',
        sounds: {
          receive: 'Receive sound',
          send: 'Send sound',
          enter: 'Enter sound',
          leave: 'Leave sound',
          info: 'Info sound',
          error: 'Error sound',
          mention: 'Mention sound',
          msg: 'Private message sound'
        },
        leavePage: 'Warn before closing',
        blinkSpeed: 'Blink speed',
        blinkLength: 'Blink length'
      }
    }
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
<dt><code>--members-only, --members-only 0</code></dt><dd>Toggle the members-only status.</dd></dl>',

    sidebar: {
      chat: {
        title: 'Chat commands',
        commands: {
          alias: [
            'Create a macro',
            '/alias <cmd> /a; /b'
          ],
          away: [
            'Set away status',
            '/away <message>'
          ],
          back: [
            'Remove away status',
            '/back'
          ],
          clear: [
            'Clear all messages',
            '/clear'
          ],
          configure: [
            'Configure an existing room',
            '/configure [--help | --interactive | <options>]'
          ],
          connect: [
            'Connect',
            '/connect [<user> <pass>]'
          ],
          create: [
            'Create a new room',
            '/create [--help | <name> [<options>]]'
          ],
          join: [
            'Join a room',
            '/join <room>'
          ],
          list: [
            'List available rooms',
            '/list'
          ],
          me: [
            'Describe action',
            '/me <text>'
          ],
          msg: [
            'Private message',
            '/msg <nick> ...'
          ],
          msgme: [
            'Describe action in private message',
            '/msg <nick> /me ...'
          ],
          nick: [
            'Change nickname',
            '/nick <nick>'
          ],
          part: [
            'Leave the room',
            '/part'
          ],
          ping: [
            'Ping',
            '/ping [<nick> | <JID>]'
          ],
          quit: [
            'Disconnect',
            '/quit'
          ],
          save: [
            'Save history as file',
            '/save [html]'
          ],
          say: [
            'Say something',
            '[/say] ...'
          ],
          version: [
            'Print version',
            '/version [<nick> | <JID>]'
          ],
          who: [
            'List users',
            '/who [<room>]'
          ]
        },
      },
      admin: {
        title: 'Administration commands',
        commands: {
          admin: [
            'Server command',
            '/admin <cmd> [...]'
          ],
          affiliate: [
            'Set or show privileges',
            '/affiliate <type> [<nick> | <JID>]'
          ],
          ban: [
            'Ban a user',
            '/ban [<nick> | <JID>]'
          ],
          bans: [
            'List active bans',
            '/bans'
          ],
          destroy: [
            'Destroy a room',
            '/destroy [<room>]'
          ],
          kick: [
            'Kick a user',
            '/kick <nick> [<reason>]'
          ],
          unban: [
            'Unban a user',
            '/unban <JID>'
          ]
        }
      }
    }
  }
};
