/**
 * This plugin is distributed under the terms of the MIT licence.
 *
 * Copyright Christoph Burschka
 */

/**
 * File: strophe.attention.js
 * A Strophe plugin for Attention (http://xmpp.org/extensions/xep-0224.html)
 */
Strophe.addNamespace('ATTENTION', 'urn:xmpp:attention:0');
Strophe.addConnectionPlugin('attention', {
  _c: null,

  init: function(conn) {
    this._c = conn;
  },

  /**
   * Generate a message stanza with an <attention> element.
   *
   * The stanza must still be sent by the caller.
   *
   * Parameters:
   * (String) to - The recipient JID
   * (
   *
   * Returns:    * A message stanza
   */
  attention: function(to) {
    const msg = $msg({type: 'headline', from: this._c.jid, to})
    msg.c('attention', {xmlns: Strophe.NS.ATTENTION}, '');
    return msg;
  },

  /**
   * Function: addAttentionHandler
   *
   * Parameters:
   * (Function) handler
   *
   * Returns:
   * A reference to the handler that can be used to remove it.
   */
  addAttentionHandler: function(handler) {
    return this._c.addHandler(handler, Strophe.NS.ATTENTION, 'message');
  }
});
