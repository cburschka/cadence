/*
 * This plugin is distributed under the terms of the MIT licence.
 * Please see the LICENCE file for details.
 *
 * Copyright (c) Markus Kohlhase, 2010
 * Refactored by Pavel Lang, 2011
 * Revised for ES2015 by Christoph Burschka, 2016
 */

/**
 * File: strophe.ping.js
 * A Strophe plugin for XMPP Ping ( http://xmpp.org/extensions/xep-0199.html )
 */

Strophe.addNamespace('PING', "urn:xmpp:ping");
Strophe.addConnectionPlugin('ping', {
  _c: null,

  // called by the Strophe.Connection constructor
  init: function(conn) {
    this._c = conn;
  },

  /**
   * Function: ping
   *
   * @param {String} jid - The JID you want to ping
   * @param {int} timeout - Timeout in milliseconds
   *
   * @return {Promise} A promise that will resolve to the response stanza.
   */
  ping: function(jid, timeout) {
    return new Promise((resolve, reject) => {
      const id = this._c.getUniqueId('ping');
      const iq = $iq({type: 'get', to: jid, id: id}).c(
        'ping', {xmlns: Strophe.NS.PING});
      this._c.sendIQ(iq, resolve, reject, timeout);
    });
  },

  /**
   * Function: pong
   *
   * @param {Stanza} ping - The ping stanza from the server
   */
  pong: function(ping) {
    const from = ping.getAttribute('from');
    const id = ping.getAttribute('id');
    const iq = $iq({type: 'result', to: from,  id: id});
    this._c.sendIQ(iq);
  },

  /**
   * Function: addPingHandler
   *
   * @param {function} handler - Ping handler
   *
   * @return {int} A reference to the handler that can be used to remove it.
   */
  addPingHandler: function(handler) {
    return this._c.addHandler(handler, Strophe.NS.PING, "iq", "get");
  }
});
