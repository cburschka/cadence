/**
 * This plugin is distributed under the terms of the MIT licence.
 *
 * Copyright Christoph Burschka
 */

/**
 * File: strophe.version.js
 * A Strophe plugin for Software Version (http://xmpp.org/extensions/xep-0092.html)
 */
Strophe.addNamespace('VERSION', 'jabber:iq:version');
Strophe.addConnectionPlugin('version', {
  _c: null,

  // called by the Strophe.Connection constructor
  init: function(conn) {
    this._c = conn;
  },

  /**
   * Function: getVersion
   *
   * Parameters:
   * (String) to - The recipient JID
   * (Integer) timeout - Timeout in milliseconds
   *
   * Returns:
   * A promise that will resolve to the response stanza.
   */
  getVersion: function(to, timeout) {
    return new Promise((resolve, reject) => {
      const id = this._c.getUniqueId('version');
      const iq = $iq({type: 'get', to, id})
        .c('query', {xmlns: Strophe.NS.VERSION});
      this._c.sendIQ(iq, resolve, reject, timeout);
    });
  },

  /**
   * Function: sendVersion
   *
   * Parameters:
   * (Object) request - The incoming request stanza
   * (String) name - The client name.
   * (String) version - The version string
   * (String) os (optional) - The operating system or platform.
   */
  sendVersion: function(request, name, version, os) {
    const iq = $iq({
      type: 'result',
      to: request.getAttribute('from'),
      id: request.getAttribute('id')
    }).c('query', {xmlns: Strophe.NS.VERSION})
      .c('name', {}, name)
      .c('version', {}, version);
    if (os) iq.c('os', {}, os);
    this._c.sendIQ(iq);
  },

  /**
   * Function: addVersionHandler
   *
   * Parameters:
   * (Function) handler - Version handler
   *
   * Returns:
   * A reference to the handler that can be used to remove it.
   */
  addVersionHandler: function(handler) {
    return this._c.addHandler(handler, Strophe.NS.VERSION, 'iq', 'get');
  }
});
