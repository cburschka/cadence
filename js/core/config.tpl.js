var config = {
  // Settings which can be modified by users:
  defaultSettings: {
    // Which option container is open when the page loads.
    activeMenu: 'onlineList',
    // Which stylesheet is selected when the page loads.
    activeStyle: '@@@STYLE@@@',

    // Format of the message timestamp.
    dateFormat: '(HH:mm:ss)',
    // Whether to display verbose log messages.
    verbose: true,

    // Which trigger to use for the context menu (left, right, hover, none).
    contextmenu: 'right',

    markup: {
      // Render incoming HTML Markup.
      html: true,
      // Whether images are loaded.
      images: true,
      // Links are clickable.
      links: true,
      // Show emoticons as images.
      emoticons: true,
      // Show persistent colors.
      colors: true,
    },

    notifications: {
      // Blinks per second.
      blinkSpeed: 2,
      // Minimum number of seconds to blink (rounded up to whole intervals).
      blinkLength: 5,

      // The sound files used for notifications.
      sounds: {
        receive: 'sound_1',
        send: 'sound_2',
        enter: 'sound_3',
        leave: 'sound_4',
        info: 'sound_5',
        error: 'sound_6',
        mention: '',
        privmsg: '',
      },
      soundVolume: 100,
      soundEnabled: true,

      // Whether to show desktop notifications:
      // 0 - None, 1 - Alerts, 2 - All messages, 3 - All notifications.
      desktop: 0,

      // Warn before leaving the page.
      leavePage: true,

      // Triggers for a "mention" sound.
      triggers: [],
    },

    // Persistent font color that is displayed to other cadence users.
    textColor: '',
    fullColor: false,

    xmpp: {
      room: 'lounge',
      autoJoin: true,
      sessionAuth: true,
      resource: '{client}/{version}/{timestamp}',
    },

    macros: {},
    version: '@@@VERSION@@@',
  },

  markup: {
    bbcode: {
      b: '<span style="font-weight:bold">{content}</span>',
      i: '<span style="font-style:italic">{content}</span>',
      u: '<span style="text-decoration:underline">{content}</span>',
      s: '<span style="text-decoration:line-through">{content}</span>',
      // blink: '<span style="text-decoration:blink">{content}</span>', // blink and you're dead.
      quote: '<q>{content}</q>',
      code: '<code>{content}</code>',
      url: '<a href="{option}">{content}</a>',
      img: '<img src="{content}" alt="Image({content})" />',
      color: '<span style="color:{option}">{content}</span>'
    },

    bbcodeMD: {
      b: '**{content}**',
      i: '*{content}*',
      u: '_{content}_',
      s: '~~{content}~~',
      code: '```{content}```',
      url: '[{content}]({option})',
      img: '![Image({content})]({content})',
    },

    // Colors shown in palette selector.
    colorCodes: [
      '#CD5C5C', '#F08080', '#FA8072', '#E9967A', '#FFA07A', '#FF0000', '#DC143C',
      '#B22222', '#8B0000', '#FFC0CB', '#FFB6C0', '#FF69B4', '#FF1493', '#C71585',
      '#DB7093', '#FF8050', '#FF6347', '#FF4500', '#FF8C00', '#FFA500', '#FFD700',
      '#FFFF00', '#FFFFE0', '#FAFAD2', '#FFF0D5', '#FFE4B5', '#FFDAB9', '#EEE8AA',
      '#F0E68C', '#BDB76B', '#E6E6FA', '#D8C0D8', '#DDA0DD', '#EE82EE', '#DA70D6',
      '#FF00FF', '#BA55D3', '#9370DB', '#8A2BE2', '#9400D3', '#9932CC', '#8B008B',
      '#800080', '#4B0082', '#483D8B', '#6A5ACD', '#7B68EE', '#ADFF30', '#80FF00',
      '#00FF00', '#32CD32', '#98FB98', '#90EE90', '#00FA9A', '#00FF80', '#3CB370',
      '#2E8B57', '#228B22', '#008000', '#006400', '#9ACD32', '#6B8E23', '#808000',
      '#556B30', '#66CDAA', '#90BC90', '#20B2AA', '#008B8B', '#008080', '#00FFFF',
      '#E0FFFF', '#B0EEEE', '#80FFD4', '#40E0D0', '#48D0CC', '#00CED0', '#609EA0',
      '#4682B4', '#B0C4DE', '#B0E0E6', '#ADD8E6', '#87CEEB', '#87CEFA', '#00C0FF',
      '#1E90FF', '#6495ED', '#4069E0', '#0000FF', '#0000CD', '#00008B', '#000080',
      '#191970', '#FFEBCD', '#FFE4C4', '#FFDEAD', '#F5DEB3', '#DEB887', '#D2B48C',
      '#BC9090', '#F4A460', '#DAA520', '#B8860B', '#CD8540', '#D2691E', '#8B4513',
      '#A0522D', '#A52A2A', '#800000', '#FFFFFF', '#DCDCDC', '#D3D3D3', '#C0C0C0',
      '#A9A9A9', '#808080', '#696969', '#778899', '#708090', '#305050', '#000000'
    ],

    emoticons: {
      general: {
        baseURL: '@@@CDN_URL@@@img/emoticons/general/',
        codes: {
          ':)': 'smile.png',
          ':(': 'sad.png',
          ';)': 'wink.png',
          ':P': 'razz.png',
          ':D': 'grin.png',
          ':|': 'plain.png',
          ':O': 'surprise.png',
          ':?': 'confused.png',
          '8o': 'eek.png',
          ':-(': 'crying.png',
          ':-*': 'kiss.png',
          'O:-D': 'angel.png',
          '>:-D': 'devilish.png',
          ':favorite:': 'favorite.png'
        }
      }
    }
  },

  // Defines the available sounds loaded on chat start:
  sounds: ['sound_1', 'sound_2', 'sound_3', 'sound_4', 'sound_5', 'sound_6'],
  soundURL: '@@@CDN_URL@@@sounds/',

  xmpp: {
    // This is NOT the server, but the domain portion of the JID.
    domain: '@@@XMPP_DOMAIN@@@',
    url: '@@@XMPP_URL@@@',
    mucService: '@@@XMPP_MUC@@@',
    sessionAuthURL: '@@@XMPP_SESSION_AUTH@@@',
    timeout: 5000,
  },

  ui: {
    chatBotName: '@@@CHATBOT@@@',
    title: '@@@TITLE@@@',
    maxNickLength: 48,
    maxMessageLength: 2048,
    welcome: ''
  },

  features: [
    Strophe.NS.DISCO_INFO,
    Strophe.NS.MUC,
    Strophe.NS.MUC + '#user',
    Strophe.NS.PING,
    Strophe.NS.TIME,
    Strophe.NS.XHTML_IM,
    Strophe.NS.VERSION,
    Strophe.NS.Cadence_CONFERENCE,
  ],

  clientName: "cadence",
  clientURL: "https://github.com/cburschka/cadence",
  version: '@@@VERSION@@@',
};
