/**
 *
 * @param str
 */
function capitalizeName(str) {
  return str
    .replace(/_/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

module.exports = capitalizeName;
