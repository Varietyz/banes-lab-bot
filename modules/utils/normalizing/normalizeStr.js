/**
 *
 * @param str
 */
function normalizeStr(str) {
  if (typeof str !== 'string') {
    return '';
  }
  return str
    .replace(/[-\s]+/g, '_') // ✅ Replace ALL hyphens & spaces with a SINGLE `_`
    .toLowerCase(); // ✅ Convert to lowercase
}

module.exports = normalizeStr;
