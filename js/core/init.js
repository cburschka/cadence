(() => {
  Strophe.addNamespace('CONFERENCE', 'jabber:x:conference');

  $(document).ready(function() {
    initSettings();
    loadEmoticons();

    Cadence.bbcode = XBBCode(config.markup.bbcode);
    Cadence.bbcodeMD = XBBCode(config.markup.bbcodeMD);

    ui.init();
    visual.init();
    xmpp.init();

    $(window).on({beforeunload : () =>
      xmpp.connection.connected &&
      config.settings.notifications.leavePage &&
      strings.info.leavePage
    });
    $(window).unload(() => xmpp.connection.disconnect());

    Cadence.execute('connect').catch(() => {
      if (config.ui.welcome) ui.messageInfo(config.ui.welcome);
    });
  });

  const initSettings = () => {
    config.settings = config.defaultSettings;
    if (localStorage && localStorage.settings) {
      Cadence.loadSettings(JSON.parse(localStorage.settings))
    }
    else {
      Cadence.loadSettings(Cookies.getJSON(config.clientName + '_settings'));
    }
  }

  const loadEmoticons = () => {
    for (let pack in emoticons.packages) {
      config.markup.emoticons[pack] = emoticons.packages[pack];
    }
    config.ui.emoticonSidebars = {};
    for (let pack in emoticons.sidebars) {
      config.ui.emoticonSidebars[pack] = emoticons.sidebars[pack];
    }
  };



})();
