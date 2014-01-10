visual = {
  init: function() {
    var i = 1;
    this.emoticonSets = [];
    var emoticonRegs = []
    for (var set in config.markup.emoticons) {
      var keys = []
      for (var code in config.markup.emoticons[set].codes) {
        keys.push(code.replace(/[\^\$\*\+\?\.\|\/\(\)\[\]\{\}\\]/g, '\\$&'));
      }
      emoticonRegs.push('(' + keys.join('|') + ')'),
      this.emoticonSets.push(set);
    }
    this.emoticonRegex = new RegExp(emoticonRegs.join('|'), 'g');
  },

  findMe: function(jq) {
    while (jq.length) {
      if (jq[0].constructor == Text && jq[0].nodeValue.substring(0,4) == '/me ')
        return jq[0];
      jq = jq.contents().first();
    }
    return false;
  },

  formatMessage: function(message) {
    message.time = message.time ? new Date(message.time) : new Date();
    var body = this.lengthLimit(message.body, config.ui.maxMessageLength);
    body = $('<span>' + body + '</span>');
    body = message.user.role == 'bot' ? body : this.formatBody(body);

    var node =  $('<div class="row messageContainer">'
                  + '<span class="dateTime"></span> '
                  + '<span class="authorMessageContainer">'
                  + '<span class="author"></span> '
                  + '<span class="body"></span></span></div>');

    $('span.dateTime', node).append(this.formatTime(message.time));
    $('span.author', node).append(this.formatUser(message.user));
    $('span.body', node).append(body);
    var me = this.findMe(body);
    if (me) {
      $('span.authorMessageContainer', node)
        .prepend('* ').wrap('<span class="action"></span>');
      me.nodeValue = ' ' + me.nodeValue.substring(4);
    }
    else $('span.author', node).append(':');

    return {
      timestamp: message.time.getTime(),
      hash: str_sha1(message.user.nick + ' ' + new Date(message.time).getTime() + message.body),
      html: node
    };
  },

  formatTime: function(time) {
    time = time || (new Date());
    return moment(time).format(config.settings.dateFormat);
  },

  formatUser: function(user) {
    var nick = this.textPlain(user.nick);
    var jid = this.textPlain(user.jid || '');
    nick = this.lengthLimit(nick, config.ui.maxNickLength);
    // Show guest users as guests regardless of channel status.
    if (user.jid && Strophe.getDomainFromJid(user.jid) != config.xmpp.domain) {
      user.role = 'visitor';
      user.affiliation = 'none';
    }
    if (user.role == 'visitor' ||
      (user.role != 'bot' &&
      (!user.jid || user.nick != Strophe.getNodeFromJid(user.jid))))
      nick = '(' + nick + ')';
    return  '<span class="user-role-' + user.role
          + ' user-affiliation-' + user.affiliation
          + ' user-show-' + (user.show || 'default')
          + '" ' + (jid ? ('title="' + jid + '"') : '')
          + '>' + nick + '</span>';
  },

  formatText: function(text, variables) {
    text = text.replace(/\{([a-z]+)\}|\[([a-z]+)\]/g, function(rep, plain, raw) {
      var key = plain || raw;
      return typeof variables[key] == 'string' ? (plain ? visual.textPlain(variables[key]) : variables[key]) : rep;
    });
    return text;
  },

  formatBody: function(jq) {
    // Security: Replace all but the following whitelisted tags with their content.
    $(':not(a,img,span,q,code,strong,em,blockquote)', jq).replaceWith(
      function() { return $('<span></span>').text(this.outerHTML) }
    );
    if (!config.settings.markup.html)
      jq.text(jq.text());
    if (config.settings.markup.colors)
      this.addColor(jq);
    if (config.settings.markup.links)
      this.addLinks(jq);
    this.processImages(jq);
    if (config.settings.markup.emoticons)
      this.addEmoticons(jq);
    return jq;
  },

  addColor: function(jq) {
    jq.find('span.color').css('color', function() {
      for (var i in this.classList)
        if (this.classList[i].substring(0,6) == 'color-')
          return '#' + this.classList[i].substring(6);
    });
  },

  addEmoticons: function(jq) {
    var emoticonSets = this.emoticonSets;
    var emoticonImg = function(set, code) {
      return '<img class="emoticon" src="' + config.markup.emoticons[set].baseURL +
             config.markup.emoticons[set].codes[code] + '" />';
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

  addLinks: function(jq) {
    jq.add('*', jq).not('a').replaceText(
      /[a-z0-9+\.\-]{1,16}:\/\/[^\s"']+[_\-=\wd\/]/g,
      function(url) {
        return  '<a href="' + url +
                '" onclick="window.open(this.href); return false;">' // I'm sorry. I'm so, so sorry.
                + url + '</a>';
      }
    );
  },

  processImages: function(jq) {
    var maxWidth = ui.dom.chatList.width() - 30;
    var maxHeight = ui.dom.chatList.height() - 20;

    jq.find('img').wrap(function() {
      return '<a href="' + $(this).attr('src') +
             '" onclick="window.open(this.href); return false;"></a>';
    });

    if (config.settings.markup.images)
      jq.find('img').addClass('rescale').css({display:'none'}).load(function() {
        visual.rescale($(this), maxWidth, maxHeight);
        $(this).css({display:'block'});
      });
    else
      jq.find('img').replaceWith(function() {
        return '[image:' + $(this).attr('src') + ']'
      });
  },

  textPlain: function(text) {
    var replacers = {'<': '&lt;', '>': '&gt;', '&':'&amp;'};
    return text.replace(/[<>&]/g, function(x) { return replacers[x]; });
  },

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

  hex2rgba: function(hex, alpha) {
    hex = hex.substring(1);
    if (hex.length == 3) hex = [hex[0], hex[1], hex[2]];
    else hex = [hex.substring(0,2), hex.substring(2,4), hex.substring(4,6)];
    dec = [parseInt(hex[0], 16), parseInt(hex[1], 16), parseInt(hex[1], 16)];
    return 'rgba(' + dec.join(',') + ',' + alpha + ')';
  },

  lengthLimit: function(str, len) {
    return str.length > len ? str.substring(0, len-3) + '...' : str;
  }
};
