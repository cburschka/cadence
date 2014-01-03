/*
 * @package AJAX_Chat
 * @author Sebastian Tschan
 * @copyright (c) Sebastian Tschan
 * @license Modified MIT License
 * @link https://blueimp.net/ajax/
 */

// Ajax Chat config parameters:
var config = {

  // The channelID of the channel to enter on login (the loginChannelName is used if set to null):
  loginChannelID: null,
  // The channelName of the channel to enter on login (the default channel is used if set to null):
  loginChannelName: null,

  chatDesignator: 'crf',

  // The time in ms between update calls to retrieve new chat messages:
  timerRate: 3500,

  // The URL to retrieve the XML chat messages (must at least contain one parameter):
  ajaxURL: './?ajax=true',
  // The base URL of the chat directory, used to retrieve media files (images, sound files, etc.):
  baseURL: './',

  // A regular expression for allowed source URL's for media content (e.g. images displayed inline);
  regExpMediaUrl: '^((http)|(https)):\\/\\/',

  // If set to false the chat update is delayed until the event defined in ajaxChat.setStartChatHandler():
  startChatOnLoad: true,

  // Defines the IDs of DOM nodes accessed by the chat:
  domIDs: {
    // The ID of the chat messages list:
    chatList: 'chatList',
    // The ID of the online users list:
    onlineList: 'onlineList',
    // The ID of the message text input field:
    inputField: 'inputField',
    // The ID of the message text length counter:
    messageLengthCounter: 'messageLengthCounter',
    // The ID of the channel selection:
    channelSelection: 'channelSelection',
    // The ID of the style selection:
    styleSelection: 'styleSelection',
    // The ID of the emoticons container:
    emoticonsContainer: 'emoticonsContainer',
    // The ID of the color codes container:
    colorCodesContainer: 'colorCodesContainer',
    // The ID of the flash interface container:
    flashInterfaceContainer: 'flashInterfaceContainer',
    poniconList: 'poniconList'
  },

  // Defines the settings which can be modified by users:
  settings: {
    // Defines if BBCode tags are replaced with the associated HTML code tags:
    bbCode: true,
    // Defines if image BBCode is replaced with the associated image HTML code:
    bbCodeImages: true,
    // Defines if color BBCode is replaced with the associated color HTML code:
    bbCodeColors: true,
    // Defines if hyperlinks are made clickable:
    hyperLinks: true,
    // Defines if line breaks are enabled:
    lineBreaks: true,
    // Defines if emoticon codes are replaced with their associated images:
    emoticons: true,

    // Defines if the focus is automatically set to the input field on chat load or channel switch:
    autoFocus: true,
    // Defines if the chat list scrolls automatically to display the latest messages:
    autoScroll: true,
    // The maximum count of messages displayed in the chat list (will be ignored if set to 0):
    maxMessages: 0,

    // Defines if long words are wrapped to avoid vertical scrolling:
    wordWrap: true,
    // Defines the maximum length before a word gets wrapped:
    maxWordLength: 32,

    // Defines the format of the date and time displayed for each chat message:
    dateFormat: '(HH:mm:ss)',

    // Defines if font colors persist without the need to assign them to each message:
    persistFontColor: false,
    // The default font color, uses the page default font color if set to null:
    fontColor: null,

    // Defines if sounds are played:
    audio: true,
    // Defines the sound volume (0.0 = mute, 1.0 = max):
    audioVolume: 1.0,

    // Defines the sound that is played when normal messages are reveived:
    soundReceive: 'sound_1',
    // Defines the sound that is played on sending normal messages:
    soundSend: 'sound_2',
    // Defines the sound that is played on channel enter or login:
    soundEnter: 'sound_3',
    // Defines the sound that is played on channel leave or logout:
    soundLeave: 'sound_4',
    // Defines the sound that is played on chatBot messages:
    soundChatBot: 'sound_5',
    // Defines the sound that is played on error messages:
    soundError: 'sound_6',

    // Defines if the document title blinks on new messages:
    blink: true,
    // Defines the blink interval in ms:
    blinkInterval: 500,
    // Defines the number of blink intervals:
    blinkIntervalNumber: 10
  },

  // Defines a list of settings which are not to be stored in a session cookie:
  nonPersistentSettings: [],

  // Defines the list of allowed BBCodes:
  bbCodeTags:[
    'b',
    'i',
    'u',
    's',
    'quote',
    'code',
    'color',
    'url',
    'img',
    'IMG',
    'URL',
    'COLOR',
    'table',
    'tr',
    'td'
  ],

  // Defines the list of allowed color codes:
  colorCodes: ['#CD5C5C', '#F08080', '#FA8072', '#E9967A', '#FFA07A', '#FF0000', '#DC143C', '#B22222', '#8B0000', '#FFC0CB', '#FFB6C1', '#FF69B4', '#FF1493', '#C71585', '#DB7093', '#FFA07A', '#FF7F50', '#FF6347', '#FF4500', '#FF8C00', '#FFA500', '#FFD700', '#FFFF00', '#FFFFE0', '#FFFACD', '#FAFAD2', '#FFEFD5', '#FFE4B5', '#FFDAB9', '#EEE8AA', '#F0E68C', '#BDB76B', '#E6E6FA', '#D8BFD8', '#DDA0DD', '#EE82EE', '#DA70D6', '#FF00FF', '#FF00FF', '#BA55D3', '#9370DB', '#8A2BE2', '#9400D3', '#9932CC', '#8B008B', '#800080', '#4B0082', '#483D8B', '#6A5ACD', '#7B68EE', '#ADFF2F', '#7FFF00', '#7CFC00', '#00FF00', '#32CD32', '#98FB98', '#90EE90', '#00FA9A', '#00FF7F', '#3CB371', '#2E8B57', '#228B22', '#008000', '#006400', '#9ACD32', '#6B8E23', '#808000', '#556B2F', '#66CDAA', '#8FBC8F', '#20B2AA', '#008B8B', '#008080', '#00FFFF', '#00FFFF', '#E0FFFF', '#AFEEEE', '#7FFFD4', '#40E0D0', '#48D1CC', '#00CED1', '#5F9EA0', '#4682B4', '#B0C4DE', '#B0E0E6', '#ADD8E6', '#87CEEB', '#87CEFA', '#00BFFF', '#1E90FF', '#6495ED', '#4169E1', '#0000FF', '#0000CD', '#00008B', '#000080', '#191970', '#FFF8DC', '#FFEBCD', '#FFE4C4', '#FFDEAD', '#F5DEB3', '#DEB887', '#D2B48C', '#BC8F8F', '#F4A460', '#DAA520', '#B8860B', '#CD853F', '#D2691E', '#8B4513', '#A0522D', '#A52A2A', '#800000', '#FFFFFF', '#DCDCDC', '#D3D3D3', '#C0C0C0', '#A9A9A9', '#808080', '#696969', '#778899', '#708090', '#2F4F4F', '#000000'],

  // Defines the list of allowed emoticon codes:
  emoticonCodes: [
   ':)',
   ':(',
   ';)',
   ':P',
   ':D',
   ':|',
   ':O',
   ':?',
   '8o',
   ':-(',
   ':-*',
   'O:-D',
   '>:-D',
   ':favorite:'
  ],

  // Defines the list of emoticon files associated with the emoticon codes:
  emoticonFiles: [
   'smile.png',
   'sad.png',
   'wink.png',
   'razz.png',
   'grin.png',
   'plain.png',
   'surprise.png',
   'confused.png',
   'eek.png',
   'crying.png',
   'kiss.png',
   'angel.png',
   'devilish.png',
   'favorite.png'
  ],

  // Defines the list of allowed ponicon codes:
  poniconCodes: [
   //':ponicon-null:',
   ':angel:',
   ':abbored:',
   ':abhuh:',
   ':absmile:',
   ':abwut:',
   ':abmeh:',
   ':ajbaffle:',
   ':ajcower:',
   ':ajfrown:',
   ':ajhappy:',
   ':ajlie:',
   ':ajsly:',
   ':ajsup:',
   ':ajugh:',
   ':ajwut:',
   ':hmmm:',
   ':squintyjack:',
   ':applederp:',
   ':aran:',
   ':bonbon:',
   ':punchdrunk:',
   ':thehorror:',
   ':eeyup:',
   ':macintears:',
   ':swagintosh:',
   ':cadence:',
   ':celestia:',
   ':celestiamad:',
   ':celestiawut:',
   ':cheerilee:',
   ':chrysalis:',
   ':cockatrice:',
   ':colgate:',
   ':crackle:',
   ':derp:',
   ':derpwizard:',
   ':derpyhappy:',
   ':derpyshock:',
   ':priceless:',
   ':whooves:',
   ':flutterblush:',
   ':flutterfear:',
   ':flutterjerk:',
   ':fluttershh:',
   ':fluttershy:',
   ':fluttersrs:',
   ':flutterwhoa:',
   ':flutterwink:',
   ':flutteryay:',
   ':yay:',
   ':loveme:',
   ':flutterroll:',
   ':gilda:',
   ':gin:',
   ':grannysmith:',
   ':lunagasp:',
   ':lunasad:',
   ':lunateehee:',
   ':nmm:',
   ':lunawait:',
   ':happyluna:',
   ':lyra:',
   ':lyracup:',
   ':nebponder:',
   ':octavia:',
   ':photofinish:',
   ':ppboring:',
   ':hahaha:',
   ':huhhuh:',
   ':ppcute:',
   ':ppseesyou:',
   ':ohhi:',
   ':party:',
   ':joy:',
   ':pinkamina:',
   ':pinkiefear:',
   ':ppshrug:',
   ':pinkieawe:',
   ':rdannoyed:',
   ':rdcool:',
   ':rdeyebrow:',
   ':rdhappy:',
   ':louder:',
   ':rdhuh:',
   ':gross:',
   ':wingboner:',
   ':awwyeah:',
   ':rdsad:',
   ':soawesome:',
   ':rdsalute:',
   ':rdsitting:',
   ':rdsmile:',
   ':rdwut:',
   ':rarityannoyed:',
   ':raritydaww:',
   ':raritydress:',
   ':rarityjudge:',
   ':raritynews:',
   ':rarityprimp:',
   ':raritysad:',
   ':fabulous:',
   ':wahaha:',
   ':raritywhine:',
   ':raritywhy:',
   ':raritywut:',
   ':rarityyell:',
   ':rarishock:',
   ':aaaaa:',
   ':scootacheer:',
   ':scootaloo:',
   ':cutealoo:',
   ':scootaplease:',
   ':scootaderp:',
   ':shiningarmor:',
   ':silverspoon:',
   ':snails:',
   ':snowflake:',
   ':yeah:',
   ':manspike:',
   ':spikenervous:',
   ':allmybits:',
   ':spikepushy:',
   ':noooo:',
   ':spikewtf:',
   ':takealetter:',
   ':spikemeh:',
   ':spikeohshit:',
   ':spitfire:',
   ':sotrue:',
   ':sbstare:',
   ':sbbook:',
   ':dumbfabric:',
   ':ohcomeon:',
   ':sybeam:',
   ':syblush:',
   ':syfear:',
   ':syrape:',
   ':sydrunk:',
   ':sysad:',
   ':sywtf:',
   ':sywut:',
   ':sycastic:',
   ':trixiesmug:',
   ':fillytgap:',
   ':twiponder:',
   ':twipride:',
   ':twibeam:',
   ':twicrazy:',
   ':facehoof:',
   ':twirage:',
   ':twiright:',
   ':twismile:',
   ':twismug:',
   ':twisquint:',
   ':twistare:',
   ':rapidash:',
   ':dj:',
   ':vsbass:',
   ':vscurious:',
   ':vsdeal:',
   ':vsderp:',
   ':vsfilly:',
   ':vshair:',
   ':vshappy:',
   ':vshey:',
   ':vshooves:',
   ':vsjuice:',
   ':vslook:',
   ':vslying:',
   ':vsmine:',
   ':vsmog:',
   ':vssquint:',
   ':vsnope:',
   ':vsohyou:',
   ':vsomg:',
   ':vsoooo:',
   ':vssad:',
   ':vssup:',
   ':vstear:',
   ':vswink:',
   ':vswtf:',
   ':zecora:',
   ':yes:',
   ':no:',
   ':ponywarn:'
  ],

  // Defines the list of ponicon files associated with the ponicon codes:
  poniconFiles: [
   //'null.png',
   'angel.png',
   'abbored.png',
   'abhuh.png',
   'absmile.png',
   'abwut.png',
   'abmeh.png',
   'ajbaffle.png',
   'ajcower.png',
   'ajfrown.png',
   'ajhappy.png',
   'ajlie.png',
   'ajsly.png',
   'ajsup.png',
   'ajugh.png',
   'ajwut.png',
   'hmmm.png',
   'squintyjack.png',
   'applederp.png',
   'aran.png',
   'bonbon.png',
   'punchdrunk.png',
   'thehorror.png',
   'eeyup.png',
   'macintears.png',
   'swagintosh.png',
   'cadence.png',
   'celestia.png',
   'celestiamad.png',
   'celestiawut.png',
   'cheerilee.png',
   'chrysalis.png',
   'cockatrice.png',
   'colgate.png',
   'crackle.png',
   'derp.png',
   'derpwizard.png',
   'derpyhappy.png',
   'derpyshock.png',
   'priceless.png',
   'whooves.png',
   'flutterblush.png',
   'flutterfear.png',
   'flutterjerk.png',
   'fluttershh.png',
   'fluttershy.png',
   'fluttersrs.png',
   'flutterwhoa.png',
   'flutterwink.png',
   'flutteryay.png',
   'flutteryay.png',
   'loveme.png',
   'flutterroll.png',
   'gilda.png',
   'gin.png',
   'grannysmith.png',
   'lunagasp.png',
   'lunasad.png',
   'lunateehee.png',
   'nmm.png',
   'lunawait.png',
   'happyluna.png',
   'lyra.png',
   'lyracup.png',
   'nebponder.png',
   'octavia.png',
   'photofinish.png',
   'ppboring.png',
   'hahaha.png',
   'huhhuh.png',
   'ppcute.png',
   'ppseesyou.png',
   'ohhi.png',
   'party.png',
   'joy.png',
   'pinkamina.png',
   'pinkiefear.png',
   'ppshrug.png',
   'pinkieawe.png',
   'rdannoyed.png',
   'rdcool.png',
   'rdeyebrow.png',
   'rdhappy.png',
   'louder.png',
   'rdhuh.png',
   'gross.png',
   'rdsitting.png',
   'awwyeah.png',
   'rdsad.png',
   'soawesome.png',
   'rdsalute.png',
   'rdsitting.png',
   'rdsmile.png',
   'rdwut.png',
   'rarityannoyed.png',
   'raritydaww.png',
   'raritydress.png',
   'rarityjudge.png',
   'raritynews.png',
   'rarityprimp.png',
   'raritysad.png',
   'fabulous.png',
   'wahaha.png',
   'raritywhine.png',
   'raritywhy.png',
   'raritywut.png',
   'rarityyell.png',
   'rarishock.png',
   'rarishock.png',
   'scootacheer.png',
   'scootaloo.png',
   'cutealoo.png',
   'scootaplease.png',
   'scootaderp.png',
   'shiningarmor.png',
   'silverspoon.png',
   'snails.png',
   'snowflake.png',
   'snowflake.png',
   'manspike.png',
   'spikenervous.png',
   'allmybits.png',
   'spikepushy.png',
   'noooo.png',
   'spikewtf.png',
   'takealetter.png',
   'spikemeh.png',
   'spikeohshit.png',
   'spitfire.png',
   'sotrue.png',
   'sbstare.png',
   'sbbook.png',
   'dumbfabric.png',
   'ohcomeon.png',
   'sybeam.png',
   'syblush.png',
   'syfear.png',
   'syrape.png',
   'sydrunk.png',
   'sysad.png',
   'sywtf.png',
   'sywut.png',
   'sycastic.png',
   'trixiesmug.png',
   'fillytgap.png',
   'twiponder.png',
   'twipride.png',
   'twibeam.png',
   'twicrazy.png',
   'facehoof.png',
   'twirage.png',
   'twiright.png',
   'twismile.png',
   'twismug.png',
   'twisquint.png',
   'twistare.png',
   'twirage.png',
   'dj.png',
   'vsbass.png',
   'vscurious.png',
   'vsdeal.png',
   'vsderp.png',
   'vsfilly.png',
   'vshair.png',
   'vshappy.png',
   'vshey.png',
   'vshooves.png',
   'vsjuice.png',
   'vslook.png',
   'vslying.png',
   'vsmine.png',
   'vsmog.png',
   'vssquint.png',
   'vsnope.png',
   'vsohyou.png',
   'vsomg.png',
   'vsoooo.png',
   'vssad.png',
   'vssup.png',
   'vstear.png',
   'vswink.png',
   'vswtf.png',
   'zecora.png',
   'yesberry.png',
   'noberry.png',
   'ponywarn.png'
  ],
  poniconVersion: "v1.13",

  // Defines the available sounds loaded on chat start:
  soundFiles: {
    sound_1: 'sound_1',
    sound_2: 'sound_2',
    sound_3: 'sound_3',
    sound_4: 'sound_4',
    sound_5: 'sound_5',
    sound_6: 'sound_6',
    yay:     'yay',
    droneriots: 'droneriots'
  },


  // Once users have been logged in, the following values are overridden by those in config.php.
  // You should set these to be the same as the ones in config.php to avoid confusion.

  // Session identification, used for style and setting cookies:
  sessionName: 'ajax_chat',

  // The time in days until the style and setting cookies expire:
  cookieExpiration: 365,
  // The path of the cookies, '/' allows to read the cookies from all directories:
  cookiePath: '/',
  // The domain of the cookies, defaults to the hostname of the server if set to null:
  cookieDomain: null,
  // If enabled, cookies must be sent over secure (SSL/TLS encrypted) connections:
  cookieSecure: null,

  // The name of the chat bot:
  chatBotName: 'ChatBot',
  // The userID of the chat bot:
  chatBotID: 2147483647,

  // Allow/Disallow registered users to delete their own messages:
  allowUserMessageDelete: true,

  // Minutes until a user is declared inactive (last status update) - the minimum is 2 minutes:
  inactiveTimeout: 2,

  // UserID plus this value are private channels (this is also the max userID and max channelID):
  privateChannelDiff: 500000000,
  // UserID plus this value are used for private messages:
  privateMessageDiff: 1000000000,

  // Defines if login/logout and channel enter/leave are displayed:
  showChannelMessages: true,

  // Max messageText length:
  messageTextMaxLength: 1040,

  // Defines if the socket server is enabled:
  socketServerEnabled: false,
  // Defines the hostname of the socket server used to connect from client side:
  socketServerHost: 'localhost',
  // Defines the port of the socket server:
  socketServerPort: 1935,
  // This ID can be used to distinguish between different chat installations using the same socket server:
  socketServerChatID: 0,

  xmpp: {
    // This is NOT the server, but the domain portion of the JID.
    domain: 'eris.ermarian.net',
    boshURL: 'http://eris.ermarian.net:5280/http-bind/',
    muc_service: 'conference.ermarian.net',
    default_room: 'lounge',
    strings: {
      status: {
        'ERROR' : 'An error has occurred',
        'CONNECTING' : 'Connecting to the server...',
        'CONNFAIL' : 'The connection attempt failed',
        'AUTHENTICATING' : 'Authenticating...',
        'AUTHFAIL' : 'Authentication failed.',
        'CONNECTED' : 'You are now connected.',
        'DISCONNECTED' : 'You are now disconnected.',
        'DISCONNECTING' : 'Disconnecting from the server...',
        'ATTACHED' : 'Session resumed.',
      }
    }
  },

  ui: {
    css: ['dash', 'omg', 'Sulfur', 'Mercury', 'Carbon', 'Technetium'],
    userStatus: {
      'out': '%s leaves the channel.',
      'in': '%s enters the channel.',
      'online': '%s logs into the chat.',
      'offline': '%s logs out of the chat.',
      'away': '%s is away.',
      'available': '%s has returned.',
    },
    chatBotName: 'Ligrev',
  }
}
