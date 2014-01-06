visual = {
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
              user.nick + '</span>';
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
