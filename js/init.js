$(document).ready(function() {
  ui.initialize();
  xmpp.initialize();
});


/**      function toggleContainer(containerID, hideContainerIDs) {
        if(hideContainerIDs) {
          for(var i=0; i<hideContainerIDs.length; i++) {
            ajaxChat.showHide(hideContainerIDs[i], 'none');
          }
        }
        ajaxChat.showHide(containerID);
        if(typeof arguments.callee.styleProperty == 'undefined') {
          if(typeof isIElt7 != 'undefined') {
            arguments.callee.styleProperty = 'marginRight';
          } else {
            arguments.callee.styleProperty = 'right';
          }
        }
        var containerWidth = document.getElementById(containerID).offsetWidth;
        if(containerWidth) {
          $('#chatList').style[arguments.callee.styleProperty] = (containerWidth+28)+'px';
        } else {
          $('#chatList').style[arguments.callee.styleProperty] = '20px';
        }
      }

      config.loginChannelID = parseInt('8');
      config.sessionName = 'ajax_chat';
      config.cookieExpiration = parseInt('365');
      config.cookiePath = '/';
      config.cookieDomain = '';
      config.cookieSecure = '';
      config.chatBotName = 'INFO';
      config.chatBotID = '2147483647';
      config.allowUserMessageDelete = parseInt('1');
      config.inactiveTimeout = parseInt('2');
      config.privateChannelDiff = parseInt('500000000');
      config.privateMessageDiff = parseInt('1000000000');
      config.showChannelMessages = parseInt('1');
      config.messageTextMaxLength = parseInt('1040');

      ajaxChat.init(config, ajaxChatLang, true, true, true, initialize);
      var easter_egg = new Konami(function() { ajaxChat.konami(); });
*/
