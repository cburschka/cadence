/**
 * This plugin is distributed under the terms of the MIT licence.
 *
 * Copyright Christoph Burschka
 */

/**
 * File: strophe.time.js
 * A Strophe plugin for Entity Time (http://xmpp.org/extensions/xep-0202.html)
 */

Strophe.addNamespace('TIME', 'urn:xmpp:time');
Strophe.addConnectionPlugin('time', {
  _c: null,

  // called by the Strophe.Connection constructor
  init: function(conn) {
    this._c = conn;
  },

  /**
   * Function: getTime
   *
   * Parameters:
   * (String) to - The recipient JID
   * (Integer) timeout - Timeout in milliseconds
   *
   * Returns:
   * A promise that will resolve to the response stanza.
   */
  getTime: function(to, timeout) {
    return new Promise((resolve, reject) => {
      const id = this._c.getUniqueId('time');
      const iq = $iq({type: 'get', to, id})
        .c('time', {xmlns: Strophe.NS.TIME});
      this._c.sendIQ(iq, resolve, reject, timeout);
    });
  },

  /**
   * Function: sendTime
   *
   * Parameters:
   * (Object) request - The incoming request stanza
   */
  sendTime: function(request) {
    const iq = $iq({
      type: 'result',
      to: request.getAttribute('from'),
      id: request.getAttribute('id')
    })
      .c('time', {xmlns: Strophe.NS.TIME})
      .c('utc', {}, moment().toISOString())
      .c('tzo', {}, moment().format('Z'));
    this._c.sendIQ(iq);
  },

  /**
   * Function: addTimeHandler
   *
   * Parameters:
   * (Function) handler - Time handler
   *
   * Returns:
   * A reference to the handler that can be used to remove it.
   */
  addTimeHandler: function(handler) {
    return this._c.addHandler(handler, Strophe.NS.TIME, 'iq', 'get');
  }
});
