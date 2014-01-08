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

  formatMessage: function(message) {
    message.time = message.time ? new Date(message.time) : new Date();
    var userPrefix = '<span class="user">';
    var userSuffix = '</span> ';
    var bodySuffix = '';

    if (message.body.substring(0,4) == '/me ') {
      userPrefix = '<span class="action">* ' + userPrefix;
      bodySuffix += '</span>';
      message.body = message.body.substring(4);
    }
    else userSuffix = ':' + userSuffix;
    // First, generate the DIV element from the above markup pieces.
    var node = $('<div class="row">'
               + '<span class="dateTime">' + this.formatTime(message.time) + '</span> '
               + userPrefix + this.formatUser(message.user) + userSuffix
               + '<div id="message-body"></div>' + bodySuffix + '</div>');
    // Then, fill in the rendered message (which is rendered in DOM form).
    node.find('#message-body').replaceWith(
      this.formatBody($('<span class="body">' + message.body + '</span>'))
    );
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
    return '<span class="user-role-' + user.role +
           ' user-affiliation-' + user.affiliation + '" ' +
             (user.jid ? ('title="' + user.jid + '">') : '>') +
              this.textPlain(user.nick) + '</span>';
  },

  formatBody: function(jq) {
    if (!config.settings.markup.html)
      return $('<span>' + jq.text() + '</span>');
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
  }
};
