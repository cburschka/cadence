$(document).ready(function() {
  $.cookie.json = true;
  init.loadSettings();
  strings.init();
  ui.init();
  visual.init();
  xmpp.initialize();
  bbcode = xbbcode.init(config.markup.bbcode);
  $(window).on({beforeunload : function() {
    if (config.settings.notifications.leavePage) return strings.info.leavePage;
  }});
  $(window).unload(function() { init.shutDown(); });
  if (config.settings.xmpp.sessionAuth && config.xmpp.sessionAuthURL) {
    chat.sessionAuth(config.xmpp.sessionAuthURL);
  }
  else ui.setStatus('offline');
});

init = {
  loadSettings: function() {
    var cookie = $.cookie(config.sessionName + '_settings');
    config.settings = config.defaultSettings;
    if (cookie) {
      config.settings = objMerge(config.settings, cookie);
    }
  },

  shutDown: function() {
    xmpp.disconnect();
  }
}

function objMerge(a, b) {
  if (b === undefined) return a;
  if (typeof a != 'object' || typeof b != 'object') return b;
  if (a.constructor != Object || b.constructor != Object) return b;
  var c = {}
  for (var key in b) c[key] = b[key];
  for (var key in a) {
    c[key] = (b[key] != undefined) ? objMerge(a[key], b[key]) : a[key];
  }
  return c;
}
