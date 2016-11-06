var config, emoticons, strings;

(() => {
  Strophe.addNamespace('CONFERENCE', 'jabber:x:conference');

  $(document).ready(() => {
    try {
      const variables = loadJSON();
      config = variables.config;
      emoticons = variables.emoticons;
      strings = variables.strings;

      initSettings();
      loadEmoticons();

      Cadence.bbcode = XBBCode.create(config.markup.bbcode);
      Cadence.bbcodeMD = XBBCode.create(config.markup.bbcodeMD);

      ui.init();
      visual.init();
      xmpp.init();

      $(window).on({beforeunload : () =>
        // Warn if there is history or a connection at stake.
        (xmpp.connection.authenticated || ui.messages) &&
        config.settings.notifications.leavePage &&
        strings.info.leavePage
        || undefined
      });
      $(window).unload(() => xmpp.connection.disconnect());

      Cadence.execute('connect').catch(() => {
        if (config.ui.welcome) ui.messageInfo(config.ui.welcome);
      });
    }
    catch(e) {
      Cadence.handleError(e);
    }
  });

  const initSettings = () => {
    config.settings.version = config.version;

    if (localStorage.settings) {
      Cadence.loadSettings(JSON.parse(localStorage.settings))
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

  const loadJSON = () => Object.fromEntries(
    $('script.json-data').get().map(e => [
      e.getAttribute('data-var'),
      JSON.parse(e.innerText)
    ])
  );

})();
