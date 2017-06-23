/**
 * Created by chrisftophburschka on 2017.06.20.
 */

define(['./core', 'strophe.js', 'jquery'], (Cadenza, {Strophe}, $) => {
  const {Jid, StanzaError, TimeoutError} = Cadenza;
  const MUC_OWNER = Strophe.NS.MUC + '#owner';
  const MUC_ADMIN = Strophe.NS.MUC = '#admin';
  const MUC_USER = Strophe.NS.MUC + '#user';

  const getStatus = stanza => Array.from(stanza.querySelectorAll('status'))
    .map(x => parseInt(x.getAttribute('code')));
  
  const Server = class {
    /**
     * @param {Cadenza.Connection} connection
     * @param {String} domain
     */
    constructor({connection, domain}) {
      this.connection = connection;
      this.domain = Jid.parse(domain);
    }

    /**
     * Query the server for public rooms.
     *
     * @return {Promise} A promise that resolves to the list of rooms.
     */
    async getRooms() {
      const response = await this.roomQuery({type: 'get', xmlns: Strophe.NS.DISCO_ITEMS}).send();
      const rooms = {};
      Array.from(response.querySelectorAll('item')).forEach(item => {
        const id = Jid.parse(item.getAttribute('jid')).node;
        // Strip off the parenthesized number of participants in the name:
        const name = item.getAttribute('name');
        const title = name ? name.replace(/\((\d+)\)$/, '').trim() : id;
        rooms[id] = new Room({id, server: this, data: {title}});
      });

      return rooms;
    }

    /**
     * Query the server for extended room information.
     *
     * Resolves to a room object or FALSE if the room does not exist.
     */
    async getRoom({room}) {
      try {
        const response = await this.roomQuery({room, type: 'get', xmlns: Strophe.NS.DISCO_INFO}).send();
      }
      catch (error) {
        if (error instanceof StanzaError && error.condition === 'item-not-found') {
          return false;
        }
        throw error;
      }

      const query = response.querySelector('query');
      const identity = query.querySelector('identity[type=conference]');
      const features = Array.from(query.querySelectorAll('query > feature')).map(
        e => e.getAttribute('var')
      );
      const extended = {};
      Array.from(query.querySelectorAll('x > field')).forEach(e => {
        const name = e.getAttribute('var').replace(/^muc#roominfo_/, '');
        extended[name] = e.querySelector('value').textContent;
      });

      return new Room({
        id: room,
        server: this,
        data: {title, features, extended},
      });
    }

    /**
     * Create a Jid from a room and nickname.
     * @param room
     * @param nick
     * @returns {Jid}
     */
    jidFromRoomNick({room, nick}) {
      return new Jid({node: room, domain: this.domain, resource: nick});
    }

    /**
     * Join a specific room.
     *
     * @param room
     * @param nick
     */
    joinRoom({room, nick}) {
      const to = String(this.jidFromRoomNick({room, nick}));

      const result = new Promise((resolve, reject) => {
        let resolved = false;
        const timeout = setTimeout(() => resolved || reject(new TimeoutError()), 10000);
        this.connection.addHandler({
          handler: stanza => {
            const status = getStatus(stanza);
            if (stanza.getAttribute('type') === 'error') {
              reject(new StanzaError(stanza));
            }
            else if (status.includes(110)) {
              resolved = true;
              clearTimeout(timeout);
              resolve(true);
            }
          },
          name: 'presence',
          from: to,
        });

        this.connection.pres({to}).send();
      });
    }

    /**
     * Leave a room.
     *
     * Returns a promise that resolves when the server acknowledges the departure.
     *
     * @param room
     * @param nick
     * @returns {Promise}
     */
    leaveRoom({room, nick}) {
      const to = this.jidFromRoomNick({room, nick});
      const result = new Promise((resolve, reject) => {
        let resolved = false;
        this.connection.addHandler({
          handler: stanza => {
            resolved = true;
            resolve(true);
          },
          from: to,
          type: 'unavailable',
        });
        setTimeout(
          () => resolved || reject(new TimeoutError()),
          10000
        );
      });
      this.connection.pres({to, type: 'unavailable'}).send();
      return result;
    }

    /**
     * Set a handler for listening to a particular room.
     *
     * @param room
     * @param handler
     * @param name (usually either presence or message)
     * @returns {*}
     */
    addRoomHandler({room, handler, name}) {
      return this.connection.addHandler({
        name,
        handler: stanza => {
          handler(stanza);
          return true;
        },
        from: String(this.jidFromRoomNick({room})),
        options: {matchBareFromJid: true},
      });
    }

    /**
     * Delete any number of previously set handlers.
     *
     * @param handlers
     */
    deleteHandlers(...handlers) {
      for (let ref of handlers) {
        this.connection.deleteHandler(ref);
      }
    }

    roomIq({room, type}) {
      return this.connection.iq({type, to: this.jidFromRoomNick({room})});
    }

    /**
     * Build a room-admin IQ stanza.
     */
    roomQuery({room, type, xmlns}) {
      return this.roomIq({room, type}).c('query', {xmlns});
    }

    /**
     * Request a room configuration form.
     *
     * See http://xmpp.org/registrar/formtypes.html#http:--jabber.org-protocol-mucroomconfig
     * for a reference on supported room configuration fields.
     *
     * @param {string} room The room name.
     *
     * @return {Promise} A promise that resolves to the <x> element of the form,
     *                   or rejects with an <error> element.
     */
    roomConfig({room}) {
      return this.roomQuery({room, type: 'get', xmlns: MUC_OWNER}).send();
    }

    /**
     * Send a room configuration form to the server.
     *
     * @param {string} room The room name.
     * @param {Object} data A dictionary of form fields to send.
     *
     * @return {Promise} A promise that resolves when the form is acknowledged.
     */
    roomConfigSubmit({room, data}) {
      const form = this.roomQuery({room, type: 'set', xmlns: MUC_OWNER});
      form.c('x', {xmlns: 'jabber:x:data', type: 'submit'});
      Object.forEach(data, (name, values) => {
        if (values !== undefined) {
          form.c('field', {'var': name});
          if (!(values instanceof Array)) values = [values];
          values.forEach(value => form.c('value', {}, String(value)));
          form.up();
        }
      });

      return form.send();
    }

    /**
     * Cancel a room configuration.
     * This is important when creating a room, because the server
     * must destroy the room if the initial configuration is canceled.
     * (Subsequent configuration requests are usually stateless.)
     *
     * @param {string} room The room.
     *
     * @return {Promise}
     */
    roomConfigCancel({room}) {
      return this.roomQuery({room, type: 'set', xmlns: MUC_OWNER})
        .c('x', {xmlns: 'jabber:x:data', type: 'cancel'})
        .send();
    }

    /**
     * Send a mediated invitation.
     * @param room The room to invite someone to.
     * @param to The recipient.
     * @param text An optional message.
     */
    roomInvite({room, to, text}) {
      return this.connection.message({to: this.jidFromRoomNick({room})})
        .c('x', {xmlns: MUC_USER})
        .c('invite', {to})
        .c('reason', text)
        .send();
    }

    /**
     * Order the server to destroy a room.
     *
     * @param {string} room The room ID.
     * @param {string} alternate An alternate room ID (optional).
     * @param {string} text A text message (optional).
     *
     * @return {Promise} A promise that resolves to the response.
     */
    roomDestroy({room, alternate, text}) {
      const iq = this.roomQuery({room, type: 'set', xmlns: MUC_OWNER})
        .c('destroy');

      if (alternate) iq.attrs({jid: this.jidFromRoomNick({room: alternate})});
      if (reason) iq.c('reason', text);
      return iq.send();
    }

    async roomOccupants({room}) {
      const response = await this.roomQuery({room, type: 'get', xmlns: Strophe.NS.DISCO_ITEMS}).send();
      return Array.from(response.querySelectorAll('item')).map(
        e => e.getAttribute('name')
      );
    }

    roomMessage({room, nick, body}) {
      return this.connection.createMessage({to: this.jidFromRoomNick({room, nick}), body});
    }
  };

  const Room = class {
    constructor({id, server, data}) {
      this.id = id;
      this.server = server;
      this.data = data;
      this.status = false;
      this.roster = {};
      this.handlers = [];
    }

    addHandler({events, handler}) {
      return this.handlers.push({events, handler: handler.bind(this)}) - 1;
    }

    removeHandler(index) {
      delete this.handlers[index];
    }

    triggerEvent({event, data}) {
      this.handlers
        .filter(({events}) => events.includes(type))
        .forEach(({handler}) => handler({type, data}));
    }

    async join({nick}) {
      if (this.status) {
        throw new Error('Already joined');
      }
      this.nick = nick;
      this._pres = this.server.addRoomHandler({
        room: this.id,
        name: 'presence',
        handler: stanza => this.onPresence(stanza),
      });
      this._msg = this.server.addRoomHandler({
        room: this.id,
        name: 'message',
        handler: stanza => this.onMessage(stanza)
      });

      await this.server.joinRoom({nick, room: this.id});
      this.status = true;
    }

    onPresence(stanza) {
      const nick = Jid.parse(stanza.getAttribute('from')).resource;
      const type = stanza.getAttribute(nick);
      const status = getStatus(stanza);
      const self = status.includes(101);
      const item = $('x > item', stanza);
      let user = this.roster.nick;

      if (type === 'unavailable' && user) {
        const leaveType = status.find(x => Math.floor(x/100) === 3);
        if (leaveType === 303) {
          const newNick = item.getAttribute('nick');
          user.nick = newNick;
          this.roster.newNick = user;
          this.triggerEvent({event: 'user-nick', data: {stanza, self, user, nick, newNick}});
        }
        else if (leaveType) {
          this.triggerEvent({event: 'user-evict', data: {stanza, self, status, user}});
        }
        else {
          this.triggerEvent({event: 'user-leave', data: {stanza, self, user}});
        }
        return delete this.roster.nick;
      }

      if (!type) {
        if (!user) {
          user = this.roster.nick = Occupant.fromPresence(stanza, item);
          if (this.status) {
            this.triggerEvent({event: 'user-join', data: {stanza, user}});
          }
        }
        else {
          const show = $('show', stanza).text();
          const status = $('status', stanza).text();
          const old = user.availability;
          if (user.setAvailability({show, status})) {
            this.triggerEvent({event: 'user-status', data: {user, old, show, status, stanza}});
          }
        }
      }
    }

    async details(update=false) {
      if (update || !this.data) {
        const room = await this.server.getRoom(room);
        this.data = room.data;
      }
      return this.data;
    }

    /**
     * Leave the room.
     *
     * @returns {Promise}
     */
    async leave() {
      if (!this.status) return;
      await this.server.leaveRoom({room: this.id, nick: this.nick});
      this.hasLeft();
    }

    hasLeft() {
      this.server.deleteHandlers(this._pres, this._msg);
      this.triggerEvent({event: 'exit'});
      this.roster = [];
      this.status = false;
    }

    async changeNick({nick}) {
      if (this.status) {
        // Simply join the room under the new nick.
        await this.server.joinRoom({nick, room: this.id});
      }
      this.nick = nick;
    }

    async rejoin() {
      if (!this.status) return;
      if (!this.nick) {
        throw new Error('No nick set.');
      }
      await this.server.join();
    }

    config() {
      return this.server.roomConfig({room: this.id});
    }

    configSubmit({data}) {
      return this.server.roomConfigSubmit({room: this.id, data});
    }

    configCancel() {
      return this.server.roomConfigCancel({room: this.id});
    }

    destroy({alternate, text}) {
      return this.server.roomDestroy({room: this.id, alternate, text});
    }

    invite({to, text}) {
      return this.server.roomInvite({room: this.id, to, text});
    }

    createMessage({nick, body}={}) {
      return this.server.roomCreateMessage({nick, body, room: this.id});
    }

    async setUser({nick, jid, role, affiliation}) {
      const iq = this.server.roomAdmin({room: this.id, type: 'set'});
      if (role && nick) {
        iq.c('item', {role, nick});
      }
      else if (jid && affiliation) {
        iq.c('item', {jid, affiliation});
      }
      else {
        throw new Error('Invalid');
      }
      return await iq.send();
    }

    /**
     * Get user list (by affiliation or role).
     *
     * @param affiliation
     * @param role
     */
    async queryUsers({affiliation, role}) {
      const response = await this.server.roomAdmin({room: this.id})
        .c('item', {affiliation, role})
        .send();
      return Array.from(response.querySelectorAll('item')).map(e => ({
        jid: e.getAttribute('jid'),
        nick: e.getAttribute('nick'),
        affiliation: e.getAttribute('affiliation'),
        role: e.getAttribute('role'),
      }));
    }

    /**
     * Get the occupants from a room.
     *
     * (This returns only a list of names. More detailed information is in the roster.)
     *
     * @return {Promise} A promise that resolves to a user list.
     */
    getOccupants() {
      return this.server.roomOccupants({room: this.id});
    }

    /**
     * Set the room subject.
     *
     * @param {String} text The new room subject.
     */
    set subject(text) {
      this.createMessage().c('subject', {}, text).send();
    }
  };

  const Occupant = class {
    constructor({jid, nick, show, status}) {
      this.jid = jid;
      this.nick = nick;
      this.availability = {show, status};
    }

    setAvailability({show, status}) {
      changed = this.availability.show !== show || this.availability.status !== status;
      this.availability = {show, status};
      return changed;
    }
  };

  return {
    Server,
    Room,
    Occupant
  };
});
