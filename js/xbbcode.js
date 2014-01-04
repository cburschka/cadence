/************************************************************
 * This is a JavaScript implementation of xbbcode,          *
 * originally a PHP module written for Drupal.              *
 * xbbcode is an Ermarian Network production by Arancaytar, *
 * and available under the GNU General Public License v2+   *
 ************************************************************/

xbbcode = {
  /* tagEngine ::= { tagname : <renderer> | <extended> }
   * renderer ::= string | function
   * extended ::= | { body: <renderer>, selfclosing: bool, nocode: bool }
   *
   * the render function will receive a tag object with the keys
   * "content", "option", "attrs" (keyed by attribute name) and "name".
   * the render string may contain the placeholders {content}, {option}, {name},
   * or any attribute key.
   */
  init: function(tagEngine) {
    // Match a quote, optionally.
    var quote = '"|\'|&(?:quot|#039);|';
    // Match an attribute (key=value pair).
    // The attribute value concludes after the same quote (if any) is
    // re-encountered followed by a white-space character, ], or the string end.
    // (string end cannot occur when matching a full tag).
    var filter = {
      RE_ATTR: '\\s+(\\w+)=(' + quote + ')(.*?)\\2(?=\\s|\\]|$)',
      RE_TAG: '\\[(\\/?)' + // Match the [ and an optional /.
                  '(\\w+)' +      // The tag name has no white space.
                  '(?:' +
                    '=(' + quote + ')(.*?)\\3(?=\\])' + // =option
                    '|(\\s+(\\w+)=(' + quote + ')(.*?)\\7(?=\\s|\\]|$)+)' + // attributes
                  '(?=\\1))?' + // reject closing tags with attributes.
                  '\\]', // match the final ].
      tagEngine: tagEngine
    };

    // Pseudo-prototype, because real prototyping apparently doesn't work.
    for (x in this) {
      filter[x] = this[x];
    }
    return filter;
  },

  render: function(text) {
    return this.processTags(text, this.findTags(text));
  },

  findTags: function(text) {
    var tags = [];
    var re = new RegExp(this.RE_TAG, 'gi');
    var m;
    while ((m = re.exec(text)) !== null) {
      tags[tags.length] = {
        open: m[1] === '',
        name: m[2],
        option: m[4],
        attrs: this.parseAttributes(m[5]),
        tag: m[0],
        start: m.index,
        end: m.index + m[0].length,
        offset: m.index + m[0].length,
        content: ''
      };
    }
    return tags;
  },

  parseAttributes: function(text) {
    var attrs = {};
    var re = new RegExp(this.RE_ATTR, 'gi');
    var m;
    while ((m = re.exec(text)) !== null) {
      attrs[m[1]] = m[3];
    }
    return attrs;
  },

  processTags: function(text, tags) {
    // Initialize tag counter.
    var openByName = {};
    for (var i in tags) {
      openByName[tags[i].name] = 0;
    }

    var root = {content: '', start: 0, offset: 0};
    var stack = [root];
    var parent;

    for (var i in tags) {
      parent = stack[stack.length-1];
      var tag = tags[i];
      if (!this.tagEngine[tag.name]) continue;

      // Append everything before this tag to the last open one.
      parent.content += text.substring(parent.offset, tag.start);
      parent.offset = tag.start;

      // Found a new opening tag.
      if (tag.open) {
        // If the tag is self-closing, render and append.
        if (this.tagEngine[tag.name].selfclosing) {
          var rendered = this.renderTag(tag);
          if (typeof rendered != 'string') rendered = tag.tag;
          parent.content += rendered;
          parent.offset = tag.end;
        }
        else {
          stack.push(tag);
          openByName[tag.name]++;
        }
      }
      // Found a closing tag that matches an opening one.
      else if (openByName[tag.name] > 0) {
        parent.offset = tag.end; // Skip past the closing tag.
        // Break open tags until we get to the right one.
        var current = stack.pop();
        openByName[current]--;
        parent = stack[stack.length-1];

        while (stack && current.name != tag.name) {
          // Break a tag by appending its element and content to its parent.
          parent.content += current.tag + current.content;
          parent.offset = current.offset;

          current = stack.pop();
          openByName[current]--;
          parent = stack[stack.length-1];
        }

        // If the tag forbids rendering its content, revert to unrendered.
        if (this.tagEngine[tag.name].nocode)
          current.content = text.substring(current.end, current.offset);
        var rendered = this.renderTag(current);
        if (typeof rendered != 'string')
          rendered = current.tag + current.content + tag.tag;
        parent.content += rendered;
        parent.offset = tag.end;
      }
    }
    // Append the remainder of the text to the last open tag.
    parent = stack[stack.length-1];
    parent.content += text.substring(parent.offset);

    // Break the dangling open tags.
    while (stack.length > 1) {
      console.log("Breaking", JSON.stringify(stack));
      var current = stack.pop();
      parent = stack[stack.length-1];
      parent.content += current.tag + current.content;
      console.log("Broken",JSON.stringify(stack));
    }
    return root.content;
  },

  renderTag: function(tag) {
    var renderer = this.tagEngine[tag.name];
    if (typeof renderer === 'object') {
      renderer = renderer.body;
    }
    if (typeof renderer === 'function') {
      return renderer({
        name: tag.name,
        option: tag.option,
        attrs: tag.attrs,
        content: tag.content
      });
    }
    else if (typeof renderer === 'string') {
      // Replace placeholders of the form {x}, but allow escaping
      // literal braces with {{x}}.
      return renderer.replace(/\{(?:(attr:)?(\w+)|(\{\w+\}))\}/g, function(_, attr, key, esc) {
        if (esc) return esc;
        else if (attr) {
          if (tag.attrs && tag.attrs[key]) return tag.attrs[key];
        }
        else {
          if (key == 'content') return tag.content;
          if (key == 'name') return tag.name;
          if (tag.option && key == 'option') return tag.option;
        }
        return '';
      });
    }
  }
};
