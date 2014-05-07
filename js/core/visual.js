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
      this.emoticonSets.push(set);
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
   *                    * body : {string} The message body.
   *
   * @return {jQuery} the rendered node. It has events attached and must not be
   *                  copied or transformed back into markup before insertion.
   */
  formatMessage: function(message, internal) {
    message.time = message.time ? new Date(message.time) : new Date();
    var body = message.body;
    if (internal) body = this.lengthLimit(body, config.ui.maxMessageLength);
    body = $('<span>' + body + '</span>');
    if (message.user.role != 'bot') body = this.formatBody(body);

    var node =  $('<div class="row message">'
                  + '<span class="dateTime"></span> '
                  + '<span class="authorMessageContainer">'
                  + '<span class="author"></span> '
                  + '<span class="body"></span></span></div>');

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

    if (message.type != 'groupchat') {
      $('span.' + (me ? 'body' : 'author'), node).after(
        ' <span class="privmsg">' + (message.to ?
          this.formatText(strings.info.whisperTo, {nick:message.to})
        : strings.info.whisper)
        + '</span>'
      );
    }

    return {
      timestamp: message.time.getTime(),
      html: node,
      message: message,
    };
  },

  format: {
    /**
     * Render a time-stamp for output.
     *
     * @param {Date} time The timestamp or null for the current time.
     * @return {string} A timestamp formatted according to config.settings.dateFormat.
     */
    time: function(time) {
      time = time || (new Date());
      return moment(time).format(config.settings.dateFormat);
    },

    /**
     * Render a user object for output.
     *
     * @param {Object} user The user object to render. It must have these keys:
     *                 * nick: {string} The user's nickname.
     *                 * jid: {string} The user's jid, or null.
     *                 * role: {string} The XEP-0045 room role of the user.
     *                 * affiliation: {string} The XEP-0045 room affiliation.
     *                 * [show]: The <show/> (mostly away or null) of the user.
     * @return {string} The rendered user markup. It will have classes for role,
     *                  affiliation and status. Guests and people whose real nodes
     *                  don't match their nickname will be parenthesized.
     */
    user: function(user) {
      var nick = visual.format.nick(user.nick);
      var jid = visual.format.plain(user.jid || '');
      if (user.role == 'visitor' || (user.jid &&
        user.nick.toLowerCase() != Strophe.getNodeFromJid(user.jid).toLowerCase()))
        nick = '(' + nick + ')';
      return  '<span class="user user-role-' + user.role
            + ' user-affiliation-' + user.affiliation
            + ' user-show-' + (user.show || 'default') + '"'
            + (jid ? (' title="' + jid + '"') : '')
            + ' onclick="chat.prefixMsg(\''
            + encodeURIComponent(user.nick.replace(/\s/g, '\\$&'))
              .replace(/\'/g, "\\\'")
            + '\')"' + '>' + nick + '</span>';
    },

    /**
     * Format a room object.
     * Currently only returns the room title.
     */
    room: function(room) {
      return room.title;
    },

    /**
     * Format a nick.
     */
    nick: function(nick) {
      return visual.lengthLimit(visual.format.plain(nick), config.ui.maxNickLength);
    },

    /**
     * Escape < and > in a text.
     *
     * Wherever possible, this function should be avoided in favor of DOM
     * and jQuery methods like $.text() and Text().
     * Only use it when working on strings.
     */
    plain: function(text) {
      var replacers = {'<': '&lt;', '>': '&gt;', '&':'&amp;'};
      return text.replace(/[<>&]/g, function(x) { return replacers[x]; });
    },

    raw: function(text) {
      return text;
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
      function() { return $('<span></span>').text(this.outerHTML) }
    );
    // If markup is disabled, replace the entire node with its text content.
    if (!config.settings.markup.html)
      jq.text(jq.text());
    if (config.settings.markup.colors)
      this.addColor(jq);
    if (config.settings.markup.links)
      this.addLinks(jq);
    // Handle images - either make them auto-scale, or remove them entirely.
    this.processImages(jq);
    if (config.settings.markup.emoticons)
      this.addEmoticons(jq);
    // Make links open in new tabs.
    this.linkOnClick(jq);
    return jq;
  },


  /**
   * Poor man's sprintf, with some features from Drupal's t().
   * Splice variables into a template, optionally escaping them.
   *
   * @param {string} text A format string with placeholders like {a} and [b].
   * @param {Object} variables A hash keyed by variable name.
   *
   * Any placeholder with a corresponding variable will be replaced.
   * If the placeholder is in curly brackets, the variable will be HTML-escaped.
   * @return {string} The rendered text.
   */
  formatText: function(text, variables) {
    for (var key in variables) if (!variables[key]) delete variables[key];
    for (var key in variables) {
      var m = /([a-z]+)\.[a-z]+/.exec(key);
      var type = m ? m[1] : key;
      type = this.format[type] ? type : 'plain';
      variables[key] = this.format[type](variables[key]);
    }
    text = text.replace(/\{([a-z\.]+)\}/g, function(rep, key) {
      return typeof variables[key] == 'string' ? variables[key] : rep;
    });
    return text;
  },

  /**
   * Find span.color elements with a class named "color-{x}" and set their
   * CSS color property to {x}.
   */
  addColor: function(jq) {
    jq.find('span.color').css('color', function() {
      for (var i in this.classList)
        if (this.classList[i].substring(0,6) == 'color-')
          return '#' + this.classList[i].substring(6);
    });
  },

  /**
   * Find emoticon codes in the node's text and replace them with images.
   */
  addEmoticons: function(jq) {
    var emoticonSets = this.emoticonSets;
    var emoticonImg = function(set, code) {
      return  '<img class="emoticon" src="' + config.markup.emoticons[set].baseURL
            + config.markup.emoticons[set].codes[code]
            + '" title="' + code + '" alt="' + code + '" />';
    }
    jq.add('*', jq).replaceText(this.emoticonRegex, function() {
      for (var i = 1; i < Math.min(arguments.length-2, emoticonSets.length+1); i++) {
        if (arguments[i]) {
          return emoticonImg(emoticonSets[i-1], arguments[i]);
        }
      }
    });
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
      /(^|[^"'])((https?|s?ftp|mailto):\/\/[^\s"']+[_\-=\wd\/])/g,
      function(all, pre, url) {
        return  pre + '<a href="' + url + '">' + url + '</a>';
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
      return '<a href="' + this.src + '"></a>';
    });

    if (config.settings.markup.images)
      jq.find('img').addClass('rescale').css({display:'none'}).load(function() {
        visual.rescale($(this), maxWidth, maxHeight);
        $(this).css({display:'block'});
      });
    else
      jq.find('img').replaceWith(function() {
        return '[image:' + visual.ellipsis(this.src, 64) + ']'
      });
  },

  /**
   * Make links open in a new tab.
   */
  linkOnClick: function(jq) {
    $('a[href]', jq).click(function(event) {
      event.preventDefault();
      window.open(this.href);
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

  ellipsis: function(str, len) {
    return (len && str.length > len) ? str.substring(0, (len-3)/2) + '...' + str.substring(str.length - (len-3)/2) : str;
  },

  messagesToText: function(messages) {
    var x = [];
    $(messages).each(function() {
      var jQ = this.html.clone();
      jQ.find('a').replaceWith(function() { return '[url=' + this.href + ']' + $(this).html() + '[/url]'; });
      jQ.find('img.emoticon').replaceWith(function() { return $(this).attr('alt'); });
      jQ.find('img').replaceWith(function() { return '[img]' + this.src + '[/img]'; });
      jQ.find('q').replaceWith(function() { return '"' + $(this).html() + '"'; });
      x.push(jQ.text());
    });
    return x.join("\n");
  }
};
