/**
 * util.js adds a few polyfills and utility functions.
 */

/**
 * Run a binary search on a given array. The only assumption
 * is that for two indices a < b, fn(a) implies fn(b).
 *
 * @param {function} fn
 *
 * @return the index of the first element satisfying fn(), or -1.
 */
Array.prototype.findIndexBinary = function(fn) {
  // Check that the last element satisfies fn.
  if (this.length < 1 || !fn(this[this.length-1])) return -1;
  const rec = (a, b) => {
    if (fn(this[a])) return a;
    const c = Math.floor((a + b) / 2);
    if (fn(this[c])) return rec(a, c);
    else return rec(c+1, b);
  };
  return rec(0, this.length-1);
};
Array.prototype.findBinary = function(fn) {
  return this[this.findIndexBinary(fn)];
};
Array.prototype.indexOfBinary = function(val) {
  const index = this.findIndexBinary(x => x >= val);
  return this[index] === val ? index : -1;
};

/**
 * Make a merged copy of objects a and b, whose structure is exactly that of
 * a, using b's values for common keys.
 */
Object.merge = (a, b) => {
  if (typeof a != typeof b) return a;
  if (a === null || a === undefined) return b;
  if (a.constructor != Object) return b;
  // Shallow copy of a:
  const c = Object.assign({}, a);
  Object.keys(b).forEach(
    key => c[key] = (c[key] !== undefined ? Object.merge(c[key], b[key]) : b[key])
  );
  return c;
};
Object.forEach = Object.forEach ||
  ((obj, fn) => Object.keys(obj).forEach(key => fn(key, obj[key])));
Object.values = Object.values ||
  (obj => Object.keys(obj).map(key => obj[key]));
Object.entries = Object.entries ||
  (obj => Object.keys(obj).map(key => [key, obj[key]]));
Object.fromEntries = Object.fromEntries ||
  (entries => {
    const obj = {};
    entries.forEach(([key, value]) => obj[key] = value);
    return obj;
  });

/**
 * _.debounce adapted from Underscore, extending the Function prototype.
 *
 * A debounced function clusters repeated calls into intervals, using a given
 * time resolution, and runs only once for every such interval.
 *
 * It may run at the beginning (ie. immediately after the first call) or the
 * end (ie. after sufficient time has passed without a call) of the interval.
 *
 * It will always run with the context and arguments of the most recent call,
 * and calls will always return the most recent return value.
 *
 * (This means that the cached return value may be stale, and not match the
 * value that would have been returned from the current call!)
 *
 * @param {int} delay The delay in milliseconds.
 * @param {boolean} immediate Whether to run the function immediately.
 */
Function.prototype.debounce = function(delay, immediate) {
  const last = {};
  let expire = 0, blocked = false;

  const run = () => last.return = this.apply(last.this, last.args);
  const edge = () => (blocked == !!immediate) && run();
  const check = () => {
    const now = Date.now();
    if (now >= expire) {
      blocked = false;
      edge();
    }
    else setTimeout(check, expire - now);
  };

  return function(...args) {
    last.this = this;
    last.args = args;

    // If there is no block, trigger rising edge and begin checking.
    // (wait for the block to explicitly expire to avoid racing conditions)
    if (!blocked) {
      blocked = true;
      edge();
      setTimeout(check, delay);
    }
    expire = Date.now() + delay;
    return last.result;
  };
};

/**
 * Polyfill for the KeyEvent constants.
 */
const KeyEvent = (() => {
  try {
    if (KeyEvent) return KeyEvent;
  }
  catch (e) {}
  return {
    DOM_VK_CANCEL: 3,
    DOM_VK_HELP: 6,
    DOM_VK_BACK_SPACE: 8,
    DOM_VK_TAB: 9,
    DOM_VK_CLEAR: 12,
    DOM_VK_RETURN: 13,
    DOM_VK_ENTER: 14,
    DOM_VK_SHIFT: 16,
    DOM_VK_CONTROL: 17,
    DOM_VK_ALT: 18,
    DOM_VK_PAUSE: 19,
    DOM_VK_CAPS_LOCK: 20,
    DOM_VK_ESCAPE: 27,
    DOM_VK_SPACE: 32,
    DOM_VK_PAGE_UP: 33,
    DOM_VK_PAGE_DOWN: 34,
    DOM_VK_END: 35,
    DOM_VK_HOME: 36,
    DOM_VK_LEFT: 37,
    DOM_VK_UP: 38,
    DOM_VK_RIGHT: 39,
    DOM_VK_DOWN: 40,
    DOM_VK_PRINTSCREEN: 44,
    DOM_VK_INSERT: 45,
    DOM_VK_DELETE: 46,
    DOM_VK_0: 48,
    DOM_VK_1: 49,
    DOM_VK_2: 50,
    DOM_VK_3: 51,
    DOM_VK_4: 52,
    DOM_VK_5: 53,
    DOM_VK_6: 54,
    DOM_VK_7: 55,
    DOM_VK_8: 56,
    DOM_VK_9: 57,
    DOM_VK_SEMICOLON: 59,
    DOM_VK_EQUALS: 61,
    DOM_VK_A: 65,
    DOM_VK_B: 66,
    DOM_VK_C: 67,
    DOM_VK_D: 68,
    DOM_VK_E: 69,
    DOM_VK_F: 70,
    DOM_VK_G: 71,
    DOM_VK_H: 72,
    DOM_VK_I: 73,
    DOM_VK_J: 74,
    DOM_VK_K: 75,
    DOM_VK_L: 76,
    DOM_VK_M: 77,
    DOM_VK_N: 78,
    DOM_VK_O: 79,
    DOM_VK_P: 80,
    DOM_VK_Q: 81,
    DOM_VK_R: 82,
    DOM_VK_S: 83,
    DOM_VK_T: 84,
    DOM_VK_U: 85,
    DOM_VK_V: 86,
    DOM_VK_W: 87,
    DOM_VK_X: 88,
    DOM_VK_Y: 89,
    DOM_VK_Z: 90,
    DOM_VK_CONTEXT_MENU: 93,
    DOM_VK_NUMPAD0: 96,
    DOM_VK_NUMPAD1: 97,
    DOM_VK_NUMPAD2: 98,
    DOM_VK_NUMPAD3: 99,
    DOM_VK_NUMPAD4: 100,
    DOM_VK_NUMPAD5: 101,
    DOM_VK_NUMPAD6: 102,
    DOM_VK_NUMPAD7: 103,
    DOM_VK_NUMPAD8: 104,
    DOM_VK_NUMPAD9: 105,
    DOM_VK_MULTIPLY: 106,
    DOM_VK_ADD: 107,
    DOM_VK_SEPARATOR: 108,
    DOM_VK_SUBTRACT: 109,
    DOM_VK_DECIMAL: 110,
    DOM_VK_DIVIDE: 111,
    DOM_VK_F1: 112,
    DOM_VK_F2: 113,
    DOM_VK_F3: 114,
    DOM_VK_F4: 115,
    DOM_VK_F5: 116,
    DOM_VK_F6: 117,
    DOM_VK_F7: 118,
    DOM_VK_F8: 119,
    DOM_VK_F9: 120,
    DOM_VK_F10: 121,
    DOM_VK_F11: 122,
    DOM_VK_F12: 123,
    DOM_VK_F13: 124,
    DOM_VK_F14: 125,
    DOM_VK_F15: 126,
    DOM_VK_F16: 127,
    DOM_VK_F17: 128,
    DOM_VK_F18: 129,
    DOM_VK_F19: 130,
    DOM_VK_F20: 131,
    DOM_VK_F21: 132,
    DOM_VK_F22: 133,
    DOM_VK_F23: 134,
    DOM_VK_F24: 135,
    DOM_VK_NUM_LOCK: 144,
    DOM_VK_SCROLL_LOCK: 145,
    DOM_VK_COMMA: 188,
    DOM_VK_PERIOD: 190,
    DOM_VK_SLASH: 191,
    DOM_VK_BACK_QUOTE: 192,
    DOM_VK_OPEN_BRACKET: 219,
    DOM_VK_BACK_SLASH: 220,
    DOM_VK_CLOSE_BRACKET: 221,
    DOM_VK_QUOTE: 222,
    DOM_VK_META: 224,
  };
})();
