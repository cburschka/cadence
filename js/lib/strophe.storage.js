/**
 * @file strophe.storage.js
 *   An implementation of XEP-0049 (Private XML Storage)
 */

Strophe.addNamespace('STORAGE', 'jabber:iq:private');
Strophe.addConnectionPlugin('storage', {
  init: function(conn) {
    this._c = conn;
  },

  /**
   * Retrieve data from storage.
   *
   * @param {String} root The element to retrieve.
   * @param {String} namespace The namespace of the element.
   * @param {int} timeout The (optional) timeout for the request.
   *
   * @return {Promise} A promise that resolves to the response stanza.
   */
  get: function(root, namespace, timeout) {
    const id = this._c.getUniqueId('storage');
    const iq = $iq({type: 'get', id});
    iq.c('query', {xmlns: Strophe.NS.STORAGE});
    iq.c(root, {xmlns: namespace}, '');
    return new Promise((resolve, reject) => {
      this._c.sendIQ(iq, resolve, reject, timeout);
    });
  },

  /**
   * Send data to storage.
   *
   * @param {String} root The root element to store.
   * @param {String} namespace The namespace of the element.
   *
   * @return {Object} A Builder that can be filled with data and sent with .send().
   */
  set: function(root, namespace) {
    const id = this._c.getUniqueId('storage');
    const iq = $iq({type: 'set', id});
    iq.c('query', {xmlns: Strophe.NS.STORAGE}).c(root, {xmlns: namespace});
    iq.send = (timeout) => new Promise((resolve, reject) => {
      this._c.sendIQ(iq, resolve, reject, timeout);
    });
    return iq;
  }
});
