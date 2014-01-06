visual = {
  init: function() {
    var i = 1;
    this.emoticonSets = [];
    var emoticonRegs = []
    for (var set in config.emoticons) {
      var keys = []
      for (var code in config.emoticons[set].codes) {
        keys.push(code.replace(/[\^\$\*\+\?\.\|\/\(\)\[\]\{\}\\]/g, '\\$&'));
      }
      emoticonRegs.push('(' + keys.join('|') + ')'),
      this.emoticonSets.push(set);
    }
    this.emoticonRegex = new RegExp(emoticonRegs.join('|'), 'g');
  },

  renderText: function(jq) {
    if (!config.settings.html)
      return $('<span>' + jq.text() + '</span>');
    if (config.settings.hyperlinks)
      this.addLinks(jq);
    this.processImages(jq);
    if (config.settings.emoticons)
      this.addEmoticons(jq);
    return jq;
  },

  addEmoticons: function(jq) {
    var emoticonSets = this.emoticonSets;
    var emoticonImg = function(set, code) {
      return '<img class="emoticon" src="' + config.emoticons[set].baseURL +
             config.emoticons[set].codes[code] + '" />';
    }
    jq.replaceText(this.emoticonRegex, function() {
      for (var i = 1; i < Math.min(arguments.length-2, emoticonSets.length+1); i++) {
        if (arguments[i]) {
          return emoticonImg(emoticonSets[i-1], arguments[i]);
        }
      }
    });
    return jq;
  },

  addLinks: function(jq) {
    jq.replaceText(
      /[a-z0-9+\.\-]{1,16}:\/\/[^\s"']+[_\-=\wd]/,
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

    if (config.settings.images)
      jq.find('img').addClass('rescale').css({display:'none'}).load(function() {
        visual.rescale($(this), maxWidth, maxHeight);
        $(this).css({display:'block'});
      });
    else
      jq.find('img').replaceWith(function() {
        return '[image:' + $(this).attr('src') + ']'
      });
  },

  formatUser: function(user) {
    return '<span class="user-role-' + user.role +
           ' user-affiliation-' + user.affiliation + '" ' +
             (user.jid ? ('title="' + user.jid + '">') : '>') +
              this.textPlain(user.nick) + '</span>';
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
  }
};
