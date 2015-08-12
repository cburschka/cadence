$(document).ready(function() {
  Cookies.json = true;
  Cookies.defaults.expires = 365;
  init.loadSettings();
  init.loadEmoticons();
  strings.init();
  ui.init();
  visual.init();
  xmpp.initialize();
  bbcode = XBBCode(config.markup.bbcode);
  bbcodeMD = XBBCode(config.markup.bbcodeMD);
  $(window).on({beforeunload : function() {
    if (xmpp.status != 'offline' && config.settings.notifications.leavePage)
      return strings.info.leavePage;
  }});
  $(window).unload(function() { init.shutDown(); });
  if (config.settings.xmpp.sessionAuth && config.xmpp.sessionAuthURL) {
    chat.sessionAuth(config.xmpp.sessionAuthURL);
  }
  else ui.setStatus('offline');
});

init = {
  loadSettings: function() {
    config.settings = config.defaultSettings;

    var stored;
    if (window.localStorage && localStorage.settings) {
      stored = JSON.parse(localStorage.settings);
    }
    else stored = Cookies.get(config.clientName + '_settings');
    if (stored) {
      if (stored.version == config.version) config.settings = stored;
      else config.settings = objMerge(config.settings, stored);
      // After merging, update the version.
      config.settings.version = config.defaultSettings.version;
    }
  },

  loadEmoticons: function() {
    var flatten = function(pack, parent) {
      var p = {};
      for (var code in pack) {
        if (typeof pack[code] == 'object') {
          var c = flatten(pack[code][1], code);
          p[code] = {image: pack[code][0], parent: parent};
          for (var c2 in c) {
            p[c2] = c[c2];
          }
        }
        else p[code] = {image: pack[code], parent: parent};
      }
      return p;
    };
  
    for (pack in emoticons.packages) {
      config.markup.emoticons[pack] = emoticons.packages[pack];
      config.markup.emoticons[pack].codes = flatten(emoticons.packages[pack].codes);
    }
    config.ui.emoticonSidebars = {};
    for (pack in emoticons.sidebars) {
      config.ui.emoticonSidebars[pack] = emoticons.sidebars[pack];
    }
  },

  shutDown: function() {
    xmpp.disconnect();
  }
}

/**
 * Make a merged copy of objects a and b, whose structure is exactly that of
 * a, using b's values for common keys.
 */
function objMerge(a, b) {
  if (typeof a != typeof b) return a;
  if (a.constructor != Object) return b;
  var c = {}
  for (var key in b) c[key] = b[key];
  for (var key in a) {
    c[key] = (b[key] != undefined) ? objMerge(a[key], b[key]) : a[key];
  }
  return c;
}
