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
  if (!fn(this[this.length-1])) return -1;
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
  if (a.constructor != Object) return b;
  // Shallow copy of a:
  const c = Object.assign({}, a);
  Object.keys(b).forEach(
    key => c[key] = (c[key] !== undefined ? Object.merge(c[key], b[key]) : b[key])
  );
  return c;
};
Object.values = Object.values ||
  (obj => Object.keys(obj).map(key => obj[key]));
Object.entries = Object.entries ||
  (obj => Object.keys(obj).map(key => [key, obj[key]]));
