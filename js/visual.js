visual = {
  renderText: function(text) {
    if (config.settings.showEmoticons)
      text = visual.addEmotes(text, config.emoticons);
    if (config.settings.showPonicons)
      text = visual.addEmotes(text, config.ponicons);
    if (config.settings.showLinks)
      text = visual.addLinks(text);
    if (!config.settings.showImages)
      text = visual.removeImages(text);
    return text;
  },

  addEmotes: function(text, emotes, baseURL) {
    for (var code in emotes) text = text.replace(
      code,
      '<img src="' + baseURL + emotes[code] + '" />'
    );
    return text;
  },

  addLinks: function(text) {
    return text.replace(
      // Replace URLs if they are preceded by space, > or nothing, and not followed by </a>.
      // Hope for the best.
      /(^|\s|>)((?:(?:http)|(?:https)|(?:ftp)|(?:irc)):\/\/[^\s<>]+)(?!<\/a>)/mg,
      function(str, before, url) {
        return   before
            + '<a href="'
            + p2
            + '" onclick="window.open(this.href); return false;">' // I'm sorry. I'm so, so sorry.
            + p2
            + '</a>';
      }
    );
  },

  removeImages: function(text) {
    var text = $('<p>' + text + '</p>');
    text.find('img').replaceWith(function() {
      return '<a href="' + $(this).attr('src') + '" onclick="window.open(this.href); return false;">' +
             '[image:' + $(this).attr('src') + ']';
    });
    return text.html();
  }
};
// [img]http://stuff.ermarian.net/arancaytar/xmpp-chat.png[/img]
