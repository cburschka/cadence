$(document).ready(function() {
  $.cookie.json = true;
  init.loadSettings();
  ui.init();
  visual.init();
  xmpp.initialize();
  bbcode = xbbcode.init(config.bbcode);
  $(window).unload(function() { init.shutDown(); });
});

init = {
  loadSettings: function() {
    var cookie = $.cookie(config.sessionName + '_settings');
    config.settings = config.defaultSettings;
    // Disable this for now.
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
  for (var key in a) {
    c[key] = (b[key] != undefined) ? objMerge(a[key], b[key]) : a[key];
  }
  return c;
}
