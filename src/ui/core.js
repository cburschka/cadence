define(['jquery'], jquery => (root=document) => {
  const doc = jquery(root);
  const $ = selector => doc.find(selector);
  const dom = {
    main: $('#main'),
    footer: $('#footer'),
  };

  const onKeyMap = map => {
    // Compile a lookup table from KeyEvent.DOM_VK_* constants or charcodes.
    const callbacks = {};
    Object.keys(map).forEach(key => {
      const index = KeyboardEvent["DOM_VK_" + key] || key.charCodeAt(0);
      callbacks[index] = map[key];
    });

    return function(event) {
      const char = event.which || event.keyCode;
      if (callbacks[char] && callbacks[char](event, this)) {
        try {
          event.preventDefault();
        } catch(ex) {
          event.returnValue = false;
        }
        return false;
      }
      return true;
    };
  };

  dom.footer.on({
    keypress: onKeyMap({
      RETURN: (e,x) => {
        const text = $(x).val();
        if (!e.shiftKey) {
          Cadence.executeInput(text);
          $(x).val('');
          return true;
        }
      },
    }),
    // after any keystroke, update the message length counter.
    keyup: () => this.updateMessageLength(),
  });
});