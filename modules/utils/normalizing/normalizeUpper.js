/**
 *
 * @param target
 */
function normalizeUpper(target) {
  if (!target) return '';
  return target
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

module.exports = normalizeUpper;
