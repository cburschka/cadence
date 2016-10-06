/**
 * visual.js contains all the functions that render output for
 * display on the local client.
 */
const visual = {
  /**
   * Initialize the emoticon regular expression.
   */
  init() {
    const emoticons = config.markup.emoticons;

    this.emoticonSets = Object.keys(emoticons).map((set) => {
      return emoticons[set];
    });

    const groups = this.emoticonSets.map((set) => {
      const codes = Object.keys(set.codes).map((code) => {
        // Escape all meta-characters for regular expressions: ^$*+?.|()[]{}.
        return code.replace(/[\^\$\*\+\?\.\|\/\(\)\[\]\{\}\\]/g, '\\$&')
      });

      // The sub-expression for the set matches any single emoticon in it.
      return '(' + codes.join('|') + ')';
    });

    // The complete expression matches any single emoticon from any set.
    this.emoticonRegex = new RegExp(groups.join('|'), 'g');
  },

  /**
   * Traverse a DOM node to find a text node prefixed by "/me ".
   * The text node must be in a direct line of first descendants of the root.
   *
   * @param {DOM} node The node to search through.
   *
   * @return {Text} The text node, or false.
   */
  findMe(node) {
    if (!node) return false;
    if (node instanceof Text) return node.nodeValue.substring(0,4) == '/me ' && node;
    return this.findMe(node.firstChild);
  },

  /**
   * Format a message for output.
   *
   * @param {object} message The message to render. It must have these
   *                    keys:
   *                    * user : {Object} The author.
   *                    * time : {Date} the message timestamp or null.
   *                    * body : {jQuery} The message body.
   *
   * @return {jQuery} the rendered node. It has events attached and must not be
   *                  copied or transformed back into markup before insertion.
   */
  formatMessage(message) {
    const {body, meta, time, to, type, user} = message;
    const local = type == 'local';
    const {color} = meta || {};
    const me = !local && this.findMe(body.html[0]);
    const html = $('<span class="body-html">').append(body.html);
    const text = !local ? $('<span class="body-text">').text(body.text) : '';
    const subject = message.subject && $('<span class="subject">').text(message.subject + ': ');
    const {markup} = config.settings;

    if (!local) {
      this.formatBody(html);
      this.formatBody(text);
      (markup.html ? text : html).hide();
    }
    else html.removeClass('body-html');

    const template =  $('<div class="row message"><span class="hide-message"></span>'
                  + '<span class="dateTime">{time}</span> '
                  + '<span class="authorMessageContainer">'
                  + (user ? '<span class="author">{user}</span> ' : '')
                  + '<span class="body">{subject}{text}{html}</span>'
                  + '<span class="hidden"></span></span>'
                  + '</div>');
    template.addClass('message-type-' + message.type);
    if (color) {
      $('span.body', template).addClass('color').attr('data-color', color);
    }
    if (markup.colors) this.addColor(template);
    const output = this.formatText(template, {subject, time, user, html, text});

    $('span.hide-message, span.hidden', output).click(() => {
      $('span.body, span.hidden', output).toggle('slow');
      ui.updateHeights();
    });

    if (user) {
      if (user.jid) output.addClass(this.jidClass(user.jid));
      if (me) {
        me.nodeValue = me.nodeValue.substring(4);
        text.text(body.text.substring(4));
        $('span.authorMessageContainer', output).prepend('* ')
        .wrap('<span class="action"></span>');
      }
      else $('span.author', output).append(':');
    }

    if (['normal', 'chat'].includes(message.type)) {
      $('span.' + (me ? 'body' : 'author'), output).after([' ',
        $('<span class="privmsg">').append(this.formatText(
          strings.info[to ? 'whisperTo' : 'whisper'],
          {user: to}
        ))
      ]);
    }

    // Make users clickable.
    this.msgOnClick(output);

    // Make links open in new tabs.
    this.linkOnClick(output);

    return {message, timestamp: time.getTime(), html: output};
  },

  format: {
    /**
     * Render a button.
     * @param {object} button An object with a "label" string, a "click" function
     *                        and an optional "attributes" object.
     * @returns {jQuery} the rendered button.
     */
    button({label, click, attributes}) {
      return $('<button>').text(label).click(click).attr(attributes || {});
    },

    code(text) {
      return $('<code>').text(text);
    },

    dl(list) {
      const dl = $('<dl>');
      list.forEach(([key, val]) => dl.append(
        visual.formatText($('<dt>{key}</dt><dd>{val}</dd>'), {key, val})
      ));
      return dl;
    },

    /**
     * Format a JID.
     *
     * This is a shortcut to formatting a non-occupant user.
     */
    jid(jid) {
      return visual.format.user({jid});
    },

    /**
     * Convert an iterable object to a sorted, comma-separated list.
     *
     * @param {iterable} An object or array with values that are either strings
     *                   or jQuery objects.
     */
    list(list) {
      const {type} = list;
      const [first,...rest] = list.map(visual.format[type] || (x => x));
      return [first].concat($.map(rest, e => [', ', e]));
    },

    /**
     * Format a nick.
     */
    nick(nick) {
      return visual.lengthLimit(nick, config.ui.maxNickLength);
    },

    /**
     * Format a room object.
     * Currently only returns the room title.
     */
    room({id, title}) {
      return $('<a class="xmpp-room">')
        .attr({
          title: id,
          href: '#' + id,
          'data-room': id,
        })
        .text(title || id)
        .addClass((id == xmpp.room.current) && 'xmpp-room-current');
    },

    /**
     * Render a time-stamp for output.
     *
     * @param {Date} time The timestamp or null for the current time.
     * @return {jQuery} A timestamp formatted according to config.settings.dateFormat.
     */
    time(time) {
      return $('<span class="time">')
        // Store locale-aware ISO8601 string in the attribute.
        .attr('data-time', moment(time).format("YYYY-MM-DDTHH:mm:ss.SSSZ"))
        .text(moment(time).format(config.settings.dateFormat));
    },

    /**
     * Render a user object for output.
     *
     * @param {Object} user The user object to render. It must have one or more of these keys:
     *                 * nick: {string} The user's nickname.
     *                 * jid: {string} The user's jid, or null.
     *                 It can have these keys:
     *                 * role: {string} The XEP-0045 room role of the user.
     *                 * affiliation: {string} The XEP-0045 room affiliation.
     *                 * show: The <show/> ("away", "xa", "dnd", "chat" or null) of the user.
     * @return {jQuery} The rendered user markup. It will have classes for role,
     *                  affiliation and status. Guests and people whose real nodes
     *                  don't match their nickname will be parenthesized.
     */
    user({nick, jid, role, affiliation, show}) {
      let pdn = visual.format.nick(nick || jid.userString());

      if (role == 'visitor' || (nick && jid && nick.toLowerCase() != jid.node.toLowerCase())) {
        pdn = '(' + pdn + ')';
      }

      return $('<span class="user">')
        .addClass(`user-affiliation-${affiliation} user-role-${role}`)
        .addClass(jid && visual.jidClass(jid))
        .attr({
          'data-affiliation': affiliation,
          'data-jid': jid,
          'data-nick': nick,
          'data-role': role,
          'data-show': show,
          'title': jid,
        })
        .text(pdn);
    }
  },

  /**
   * Filter a message body for output, according to settings.
   *
   * This function acts on the node in-place.
   */
  formatBody(jq) {
    // Security: Replace all but the following whitelisted tags with their content.
    $('br', jq).replaceWith('\n');
    $(':not(a,img,span,q,code,strong,em,blockquote)', jq).replaceWith(function() {
      return this.childNodes;
    });
    this.addLinks(jq);
    this.processImages(jq);
    this.addEmoticons(jq);
  },


  /**
   * Splice variables into a template with format identifiers.
   *
   * @param {string|object} text A template, either a string or jQuery content.
   * @param {Object} variables A hash keyed by variable name.
   *
   * Any placeholder with a corresponding variable will be replaced.
   * The variable will be processed either by the specified format, or the one
   * matching its name, or the "plaintext" formatter by default.
   * @return {string} The rendered text.
   */
  formatText(text='', variables={}) {
    if (!(text instanceof jQuery)) text = $('<span>').text(String(text));

    text.find('*').addBack() // include all descendants and the top element.
      .replaceText(/({(?:(\w+):)?(\w+)})/g, (rep, format, key) => {
        if (variables[key] !== undefined) {
          if ((format || key) in visual.format) {
            return visual.format[format || key](variables[key]);
          }
          return variables[key];
        }
        return '';
      });
    return text;
  },

  /**
   * Find span.color elements with a data-color attribute and set their
   * CSS color property to the attribute value.
   */
  addColor(jq) {
    $('span.body.color', jq).css('color', function() {
      return this.getAttribute('data-color');
    });
  },

  removeColor(jq) {
    $('span.body.color', jq).css('color', '');
  },

  /**
   * Find emoticon codes in the node's text and replace them with images.
   */
  addEmoticons(jq) {
    const sets = this.emoticonSets;
    const regex = this.emoticonRegex;
    if (!regex) return;

    const image = (...groups) => {
      const i = groups.findIndex(x => !!x);
      const code = groups[i];
      const {baseURL, codes} = sets[i];
      return  [
        $('<img class="emoticon">').attr({
          src: baseURL + codes[code],
          title: code,
          alt: code
        }),
        $('<span class="emote-alt">').text(code)
      ]
    };

    jq.add('*', jq).not('code, code *, a, a *').replaceText(regex, image);

    if (!config.settings.markup.emoticons) {
      jq.find('img.emoticon').css('display', 'none').next().css('display', 'inline');
    }
  },

  /**
   * Turn URLs into links.
   */
  addLinks(jq) {
    const enabled = config.settings.markup.links;

    const linkRegex = /\b((?:https?|s?ftp):\/\/[^\s"']+[^\s.,;:()"'>])(\)*)/g;
    const link = (url, closeParens) => {
      // Allow URLs to finish with a parenthesized part.
      const open = Array.from(url).reduce((open, c) => {
        if (c == '(') return open + 1;
        else if (c == ')') return Math.max(0, open - 1);
        else return open;
      }, 0);

      url += closeParens.substring(0, open);
      closeParens = closeParens.substring(open);

      const link = enabled ?
          $('<a class="url-link"></a>').attr('href', url)
        : $('<span class="url-link"></span>');

      return [link.text(url), closeParens];
    }

    // First discard the whole thing if it's a link,
    // then add all elements that are not links,
    // then discard all of those that have a link as a parent.
    const contexts = jq.not('a').add(':not(a)', jq).filter(function() {
      return $(this).parents('a').length < 1;
    });
    contexts.replaceText(linkRegex, link);
  },

  /**
   * Remove images, or add auto-scaling listeners to them
   */
  processImages(jq) {
    const maxWidth = ui.dom.messagePane.width() - 30;
    const maxHeight = ui.dom.messagePane.height() - 20;

    jq.find('img').wrap(function() {
      return $('<a></a>').attr('href', this.src);
    }).after(function() {
      return $('<span class="image-alt"></span>')
        .text('[image:' + visual.ellipsis(this.src, 64) + ']');
    });

    jq.find('img').addClass('rescale').load(function() {
      visual.rescale($(this), maxWidth, maxHeight);
    });

    if (!config.settings.markup.images) {
      jq.find('img').css('display', 'none').next().css('display', 'inline');
    }
  },

  /**
   * Make links open in a new tab.
   */
  linkOnClick(jq) {
    $('a[href]:not([href^="#"]):not([href^="javascript\\:"])', jq).click(function(event) {
      event.preventDefault();
      window.open(this.href);
    });
  },

  msgOnClick(jq) {
    $('span.user', jq).click(function() {
      // Disabled when the context menu overrides it.
      if (config.settings.contextmenu == 'left') return;
      const nick = $(this).attr('data-nick');
      const jid = $(this).attr('data-jid');
      Cadence.prefixMsg({nick, jid});
    });
  },

  /**
   * Rescale an image proportionally, to fit inside a rectangle.
   *
   * @param {jQuery} img The image node.
   * @param {int} maxWidth The maximum width.
   * @param {int} maxHeight The maximum height.
   */
  rescale(img, maxWidth, maxHeight) {
    const width = img.prop('naturalWidth');
    const height = img.prop('naturalHeight');
    // If rescaling doesn't work, just hide it.
    if (width * height == 0) return img.remove();

    const scale = Math.min(maxWidth/width, maxHeight/height);
    if (scale < 1) {
      img.width(width*scale);
      img.height(height*scale);
    }
  },

  /**
   * Convert a hex color into an RGBa color with an alpha channel.
   *
   * @param {string} hex The hex code of the color, prefixed with #.
   * @param {float} alpha The alpha value to set, a number between 0 and 1.
   *
   * @return {string} an rgba() value.
   */
  hex2rgba(hex, alpha) {
    const [,...rgb] = hex.match(/#([\da-f]{2})([\da-f]{2})([\da-f]{2})/);
    const [R,G,B] = rgb.map(e => parseInt(e, 16));
    return `rgba(${R},${G},${B},${alpha})`;
  },

  /**
   * Truncate a string if necessary, appending "...".
   *
   * @param {string} text The text to truncate.
   * @param {int} len The maximum length, or 0.
   *
   * @return {string} Either the string, or its first (len-3) characters and "...".
   */
  lengthLimit(str, len) {
    return (str && len && str.length > len) ? str.substring(0, len-3) + '...' : str;
  },

  /**
   * Truncate a string in the middle, leaving the beginning and end.
   *
   * @param {string} text The text to truncate.
   * @param {int} len The maximum length, or 0.
   *
   * @return {string} Either the string, or (len) characters consisting of its
   * prefix, followed by an ellipsis, followed by its suffix.
   */
  ellipsis(str, len) {
    if (len && str.length > len)
      return str.substring(0, (len-3)/2) + '...' + str.substring(str.length - (len-3)/2);
    else return str;
  },

  /**
   * Export messages to plaintext.
   *
   * @param {array} an array of rendered message objects (such as ui.messages).
   *
   * @return {string} a string containing all messages.
   */
  messagesToText(messages) {
    return messages.map(({message, html}) => {
      // Non-local messages have a plaintext body. Remove the HTML body.
      if (message.type != 'local') {
        html = html.clone();
        html.find('span.body-html').remove();
      }
      return html.text();
    }).join("\n");
  },

  /**
   * Export messages to HTML code, stripping hidden utility markup.
   *
   * @param {array} an array of rendered message objects (such as ui.messages).
   *
   * @return {string} an HTML string containing all messages.
   */
  messagesToHTML(messages) {
    return Array.from($(messages).map(function() {
      const jQ = this.html.clone();
      jQ.find('.emote-alt, .hide-message, .hidden').remove();
      return jQ;
    }));
  },

  /**
   * Turn a JID into three valid, distinct, single class names:
   *
   * - jid-node-<user>
   * - jid-domain-<domain>
   * - jid-resource-<resource>
   *
   * for <user@domain/resource>.
   *
   * Whitespace characters, NUL and "\" will be replaced with "\HEX", where HEX
   * is the hexadecimal representation of the character value, eg. 20.
   * This needs to be further escaped in CSS selectors, eg. \\20.
   *
   * All other characters will be left alone. Some of these may need
   * to be escaped in CSS selectors, eg. ":" and ".".
   *
   * Note: The jid-resource-* class is only useful for selecting particular
   * prefixes such as [class*=jid-resource-cadence\/] since the full value
   * is effectively random and unique.
   *
   * @param {string} jid The JID to convert.
   * @return {string} The space-separated class names.
   */
  jidClass(jid) {
    return ['node', 'domain', 'resource'].map((e) => {
      return this.escapeClass('jid-' + e + '-' + jid[e]);
    }).join(' ');
  },

  escapeClass(text) {
    return String(text || '').replace(/[\s\0\\]/g, (x) => {
      return '\\' + x.charCodeAt(0).toString(16);
    });
  },

  /**
   * Escape < and > in a text.
   *
   * Wherever possible, this function should be avoided in favor of using DOM
   * and jQuery methods like $.text() and Text().
   * Only use it when working on strings.
   */
  escapeHTML(text) {
    const replacers = {'<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;'};
    return String(text || '').replace(/[<>&"]/g, (x) => { return replacers[x]; });
  }
};
