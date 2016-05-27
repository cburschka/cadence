(() => {
  Strophe.addNamespace('CONFERENCE', 'jabber:x:conference');

  $(document).ready(function() {
    loadSettings();
    loadEmoticons();

    ui.init();
    visual.init();
    xmpp.init();

    bbcode = XBBCode(config.markup.bbcode);
    bbcodeMD = XBBCode(config.markup.bbcodeMD);

    $(window).on({beforeunload : () =>
      xmpp.connection.connected &&
      config.settings.notifications.leavePage &&
      strings.info.leavePage
    });
    $(window).unload(() => xmpp.connection.disconnect());

    const welcome = () => {
      if (config.ui.welcome) ui.messageInfo(config.ui.welcome);
    };

    if (config.settings.xmpp.sessionAuth && config.xmpp.sessionAuthURL) {
      chat.commands.connect().catch(welcome);
    }
    else {
      ui.setConnectionStatus(false);
      welcome();
    }
  });

  const loadSettings = () => {
    config.settings = config.defaultSettings;

    let stored = null;
    if (window.localStorage && localStorage.settings)
      stored = JSON.parse(localStorage.settings);
    else
      stored = Cookies.getJSON(config.clientName + '_settings');

    if (stored) {
      if (stored.version == config.version)
        config.settings = stored;
      else
        config.settings = objMerge(config.settings, stored);
      // After merging, update the version.
      config.settings.version = config.defaultSettings.version;
    }
  };

  const loadEmoticons = () => {
    for (let pack in emoticons.packages) {
      config.markup.emoticons[pack] = emoticons.packages[pack];
    }
    config.ui.emoticonSidebars = {};
    for (let pack in emoticons.sidebars) {
      config.ui.emoticonSidebars[pack] = emoticons.sidebars[pack];
    }
  };

  /**
   * Make a merged copy of objects a and b, whose structure is exactly that of
   * a, using b's values for common keys.
   */
  const objMerge = (a, b) => {
    if (typeof a != typeof b) return a;
    if (a.constructor != Object) return b;

    const c = {}
    for (let key in a) c[key] = a[key];
    for (let key in b)
      c[key] = c[key] !== undefined ? objMerge(a[key], b[key]) : b[key];
    return c;
  };

})();
