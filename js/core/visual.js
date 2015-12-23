/**
 * visual.js contains all the functions that render output for
 * display on the local client.
 *
 * @author Christoph Burschka <christoph@burschka.de>
 * @year 2014
 * @license GPL3+
 */
visual = {
  /**
   * Initialize the emoticon regular expression.
   */
  init: function() {
    var i = 1;
    this.emoticonSets = [];
    var emoticonRegs = []
    for (var set in config.markup.emoticons) {
      var keys = []
      for (var code in config.markup.emoticons[set].codes) {
        // Escape all meta-characters for regular expressions: ^$*+?.|()[]{}.
        keys.push(code.replace(/[\^\$\*\+\?\.\|\/\(\)\[\]\{\}\\]/g, '\\$&'));
      }
      // The sub-expression for the set matches any single emoticon in it.
      emoticonRegs.push('(' + keys.join('|') + ')'),
      this.emoticonSets.push(config.markup.emoticons[set]);
    }
    // The complete expression matches any single emoticon from any set.
    this.emoticonRegex = new RegExp(emoticonRegs.join('|'), 'g');
  },

  /**
   * Traverse a jQuery set to find a text node prefixed by "/me ".
   * The text node must be in a direct line of first descendants of the root.
   *
   * @param {jQuery} jq The jquery node to search through.
   * @return {Text} The text node, or false.
   */
  findMe: function(jq) {
    while (jq.length) {
      if (jq[0].constructor == Text && jq[0].nodeValue.substring(0,4) == '/me ')
        return jq[0];
      jq = jq.contents().first();
    }
    return false;
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
  formatMessage: function(message, internal) {
    message.time = message.time ? new Date(message.time) : new Date();

    var body = $('<span>').append(message.body);
    if (message.user.role != 'bot') body = this.formatBody(body);

    var node =  $('<div class="row message"><span class="hide-message"></span>'
                  + '<span class="dateTime"></span> '
                  + '<span class="authorMessageContainer">'
                  + '<span class="author"></span> '
                  + '<span class="body"></span>'
                  + '<span class="hidden"></span></span>'
                  + '</div>');

    if (message.user.jid)
      node.addClass(this.jidClass(message.user.jid));

    $('span.hide-message, span.hidden', node).click(function() {
      $('span.body, span.hidden', node).toggle('slow', function() {
        // TODO: jquery issue #2071 is fixed; remove this after updating jquery.
        if ($(this).css('display') == 'inline-block') {
          $(this).css('display', 'inline');
        }
      });
      ui.updateHeights();
    });

    $('span.dateTime', node).append(this.format.time(message.time));
    $('span.author', node).append(this.format.user(message.user));
    $('span.body', node).append(body);
    var me = message.user.role != 'bot' && this.findMe(body);

    if (me) {
      $('span.authorMessageContainer', node)
        .prepend('* ').wrap('<span class="action"></span>');
      me.nodeValue = me.nodeValue.substring(4);
    }
    else $('span.author', node).append(':');

    if (message.type != 'groupchat' && message.type != 'local') {
      $('span.' + (me ? 'body' : 'author'), node).after(
        $('<span class="privmsg">').append(message.to ?
          this.formatText(strings.info.whisperTo, {user:message.to})
        : strings.info.whisper)
      );
    }

    // Make users clickable.
    this.msgOnClick(node);

    return {
      timestamp: message.time.getTime(),
      html: node,
      message: message,
    };
  },

  format: {
    /**
     * Format a JID.
     *
     * This is a shortcut to formatting a non-occupant user.
     */
    jid: function(jid) {
      return visual.format.user({jid: jid});
    },

    /**
     * Convert an iterable object to a sorted, comma-separated list.
     *
     * @param {iterable} An object or array with values that are either strings
     *                   or jQuery objects.
     */
    list: function(list) {
      var keys = Object.keys(list).sort();
      var output = [list[keys[0]]];
      for (var i = 1; i < keys.length; i++) output.push(', ', list[keys[i]]);
      return output;
    },

    /**
     * Format a nick.
     */
    nick: function(nick) {
      return visual.lengthLimit(nick, config.ui.maxNickLength);
    },

    /**
     * Format a room object.
     * Currently only returns the room title.
     */
    room: function(room) {
      return $('<a class="xmpp-room">')
        .attr({
          title: room.id,
          href: '#' + room.id,
          'data-room': room.id,
        })
        .text(room.title || room.id)
        .addClass((room.id == xmpp.room.current) && 'xmpp-room-current');
    },

    /**
     * Render a time-stamp for output.
     *
     * @param {Date} time The timestamp or null for the current time.
     * @return {jQuery} A timestamp formatted according to config.settings.dateFormat.
     */
    time: function(time) {
      return $('<span class="time">')
        .attr('data-time', time.toISOString())
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
    user: function(user) {
      var pdn = visual.format.nick(user.nick || Strophe.getBareJidFromJid(user.jid));

      if (user.role == 'visitor' || (user.nick && user.jid &&
        user.nick.toLowerCase() != Strophe.unescapeNode(Strophe.getNodeFromJid(user.jid).toLowerCase())))
        pdn = '(' + pdn + ')';

      return $('<span class="user">')
        .addClass('user-role-' + user.role)
        .addClass('user-affiliation-' + user.affiliation)
        .addClass(user.jid && visual.jidClass(user.jid))
        .addClass('user-show-' + (visual.escapeClass(user.show) || 'default'))
        .attr({
          'data-affiliation': user.affiliation,
          'data-jid': user.jid,
          'data-nick': user.nick,
          'title': user.jid,
        })
        .text(pdn);
    }
  },

  /**
   * Filter a message body for output, according to settings.
   *
   * This function acts on the node in-place. Its return value will be identical
   * to its argument.
   */
  formatBody: function(jq) {
    // Security: Replace all but the following whitelisted tags with their content.
    $('br', jq).replaceWith('\n');
    $(':not(a,img,span,q,code,strong,em,blockquote)', jq).replaceWith(
      function() { return new Text(this.outerHTML); }
    );
    // If markup is disabled, replace the entire node with its text content.
    if (!config.settings.markup.html)
      jq.text(jq.text());
    if (config.settings.markup.colors)
      this.addColor(jq);
    this.addLinks(jq);
    // Handle images - either make them auto-scale, or remove them entirely.
    this.processImages(jq);
    this.addEmoticons(jq);
    // Make links open in new tabs.
    this.linkOnClick(jq);
    return jq;
  },


  /**
   * Splice variables into a template with format identifiers.
   *
   * @param {string} text A format string with placeholders like {name1} and {format:name2}.
   * @param {Object} variables A hash keyed by variable name.
   * @param {bool} html Optional flag that causes text to be evaluated as HTML.
   *
   * Any placeholder with a corresponding variable will be replaced.
   * The variable will be processed either by the specified format, or the one
   * matching its name, or the "plaintext" formatter by default.
   * @return {string} The rendered text.
   */
  formatText: function(text, variables, html) {
    return $('<span>')[html ? 'html' : 'text'](text)
      .replaceText(/({(?:(\w+):)?(\w+)})/g, function(rep, format, key) {
        if (key in variables) {
          if ((format || key) in visual.format) {
            return visual.format[format || key](variables[key]);
          }
          return variables[key];
        }
        return rep;
      });
  },

  /**
   * Find span.color elements with a data-color attribute and set their
   * CSS color property to the attribute value.
   */
  addColor: function(jq) {
    jq.find('span.color[data-color]').css('color', function() {
      return $(this).attr('data-color');
    });
  },

  removeColor: function(jq) {
    jq.find('span.color[data-color]').css('color', '');
  },

  /**
   * Find emoticon codes in the node's text and replace them with images.
   */
  addEmoticons: function(jq) {
    var codes = this.emoticonSets;
    var regex = this.emoticonRegex;
    if (!regex) return;
    var image = function() {
      for (var i in arguments) {
        if (arguments[i]) {
          return  [$('<img class="emoticon" />').attr({
            src: codes[i].baseURL + codes[i].codes[arguments[i]],
            title: arguments[i],
            alt: arguments[i]
          }), $('<span class="emote-alt"></span>').text(arguments[i])]
        }
      }
    };

    jq.add('*', jq).not('code, code *, a, a *').replaceText(regex, image);

    if (!config.settings.markup.emoticons) {
      jq.find('img.emoticon').css('display', 'none').next().css('display', 'inline');
    }
    return jq;
  },

  /**
   * Turn URLs into links.
   */
  addLinks: function(jq) {
    // First discard the whole thing if it's a link,
    // then add all elements that are not links,
    // then discard all of those that have a link as a parent.
    jq.not('a').add(':not(a)', jq).filter(function() {
      return $(this).parents('a').length < 1;
    }).replaceText(
      /\b((?:https?|s?ftp|mailto):\/\/[^\s"']+[\-=\w\/])(\)*)/g,
      function(url, paren) {
        // Allow URLs to finish with a parenthesized part.
        var open = 0;
        for (var i in url) {
          if (url[i] == '(') open++;
          else if (open && url[i] == ')') open--;
        }

        url += paren.substring(0, open);
        paren = paren.substring(open);
        return [
          config.settings.markup.links ?
            $('<a class="url-link"></a>').attr('href', url).text(url) :
            $('<span class="url-link"></span>').text(url),
          paren
        ];
      }
    );
  },

  /**
   * Remove images, or add auto-scaling listeners to them
   */
  processImages: function(jq) {
    var maxWidth = ui.dom.chatList.width() - 30;
    var maxHeight = ui.dom.chatList.height() - 20;

    jq.find('img').wrap(function() {
      return $('<a></a>').attr('href', this.src);
    }).after(function() {
      return $('<span class="image-alt"></span>').text('[image:' + visual.ellipsis(this.src, 64) + ']');
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
  linkOnClick: function(jq) {
    $('a[href]:not([href^=#]):not([href^=javascript\\:])', jq).click(function(event) {
      event.preventDefault();
      window.open(this.href);
    });
  },

  msgOnClick: function(jq) {
    $('span.user', jq).click(function() {
      // Disabled when the context menu overrides it.
      if (config.settings.contextmenu == 'left') return;
      var nick = $(this).attr('data-nick');
      var jid = $(this).attr('data-jid');
      chat.prefixMsg(nick || jid, !nick);
    });
  },

  /**
   * Rescale an image proportionally, to fit inside a rectangle.
   *
   * @param {jQuery} img The image node.
   * @param {int} maxWidth The maximum width.
   * @param {int} maxHeight The maximum height.
   */
  rescale: function(img, maxWidth, maxHeight) {
    var width = img.prop('naturalWidth');
    var height = img.prop('naturalHeight');
    // If rescaling doesn't work, just hide it.
    if (width * height == 0) {
      return img.remove();
    }
    var scale = Math.min(maxWidth/width, maxHeight/height);
    if (scale < 1) {
      img.width(width*scale);
      img.height(height*scale);
    }
  },

  /**
   * Convert a hex color into an RGBa color with an alpha channel.
   *
   * @param {string} hex The hex code of the color, short or long, prefixed with #.
   * @param {float} alpha The alpha value to set, a number between 0 and 1.
   *
   * @return {string} an rgba() value.
   */
  hex2rgba: function(hex, alpha) {
    hex = hex.substring(1);
    if (hex.length == 3) hex = [hex[0], hex[1], hex[2]];
    else hex = [hex.substring(0,2), hex.substring(2,4), hex.substring(4,6)];
    dec = [parseInt(hex[0], 16), parseInt(hex[1], 16), parseInt(hex[1], 16)];
    return 'rgba(' + dec.join(',') + ',' + alpha + ')';
  },

  /**
   * Truncate a string if necessary, appending "...".
   *
   * @param {string} text The text to truncate.
   * @param {int} len The maximum length, or 0.
   *
   * @return {string} Either the string, or its first (len-3) characters and "...".
   */
  lengthLimit: function(str, len) {
    return (len && str.length > len) ? str.substring(0, len-3) + '...' : str;
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
  ellipsis: function(str, len) {
    return (len && str.length > len) ? str.substring(0, (len-3)/2) + '...' + str.substring(str.length - (len-3)/2) : str;
  },

  /**
   * Export messages to plaintext.
   *
   * @param {array} an array of rendered message objects (such as ui.messages).
   *
   * @return {string} a string containing all messages.
   */
  messagesToText: function(messages) {
    var x = [];
    $(messages).each(function() {
      var jQ = this.html.clone();
      jQ.find('a').replaceWith(function() { return '[url=' + this.href + ']' + $(this).html() + '[/url]'; });
      jQ.find('img.emoticon').remove(); // The alt text is already in a hidden <span>.
      jQ.find('img').replaceWith(function() { return '[img]' + this.src + '[/img]'; });
      jQ.find('q').replaceWith(function() { return '"' + $(this).html() + '"'; });
      x.push(jQ.text());
    });
    return x.join("\n");
  },

  /**
   * Export messages to HTML code, stripping hidden utility markup.
   *
   * @param {array} an array of rendered message objects (such as ui.messages).
   *
   * @return {string} an HTML string containing all messages.
   */
  messagesToHTML: function(messages) {
    var x = [];
    $(messages).each(function() {
      var jQ = this.html.clone();
      jQ.find('.emote-alt, .hide-message, .hidden').remove();
      x.push(jQ.html());
    });
    return x.join("<br />\n");
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
   * Whitespace characters, NUL and "\" will be replaced with "\DEC", where DEC
   * is the decimal representation of the character value, eg. \32.
   * This needs to be further escaped in CSS selectors, eg. \\32.
   *
   * All others characters will be left alone. Some of these may need
   * to be escaped in CSS selectors with \ or as "\DEC" (see above).
   *
   * Note: The jid-resource-* class is only useful for selecting particular
   * prefixes such as [class*=jid-resource-cadence\/] since the full value
   * is effectively random and unique.
   *
   * @param {string} jid The JID to convert.
   * @return {string} The space-separated class names.
   */
  jidClass: function(jid) {
    return 'jid-node-' + visual.escapeClass(Strophe.unescapeNode(Strophe.getNodeFromJid(jid)).toLowerCase()) + ' '
         + 'jid-domain-' + visual.escapeClass(Strophe.getDomainFromJid(jid)) + ' '
         + 'jid-resource-' + visual.escapeClass(Strophe.getResourceFromJid(jid));
  },

  escapeClass: function(text) {
    return text ? text.replace(/[\s\0\\]/g, function(x) {
      return '\\' + x.charCodeAt(0);
    }) : '';
  },

  /**
   * Escape < and > in a text.
   *
   * Wherever possible, this function should be avoided in favor of using DOM
   * and jQuery methods like $.text() and Text().
   * Only use it when working on strings.
   */
  escapeHTML: function(text) {
    var replacers = {'<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;'};
    return text && text.replace(/[<>&"]/g, function(x) { return replacers[x]; });
  }
};
