/*
 * @package AJAX_Chat
 * @author Sebastian Tschan
 * @copyright (c) Sebastian Tschan
 * @license Modified MIT License
 * @link https://blueimp.net/ajax/
 */

// Overriding client side functionality:

/*
// Example - Overriding the replaceCustomCommands method:
ajaxChat.replaceCustomCommands = function(text, textParts) {
  return text;
}
 */

ajaxChat.customInitialize = function() {
  // ajaxChat.addChatBotMessageToChatList('[b]Attention[/b]: There will be an upgrade and maintenance session for vanadium on Mon 17 July. Expect lag and possible downtime.');
}
