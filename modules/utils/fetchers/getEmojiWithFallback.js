// /modules/utils/fetchers/getEmojiWithFallback.js

const getEmoji = require('./getEmoji');

/**
 * Retrieves an emoji by key, with an optional fallback.
 * If no fallback is provided, it uses '❌' as the default.
 * @param {string} key - The emoji key to look up.
 * @param {string} [fallback] - (Optional) The fallback emoji.
 * @returns {Promise<string>} The found emoji or the fallback.
 */
async function getEmojiWithFallback(key, fallback) {
  const emoji = await getEmoji(key);

  // ✅ If an emoji is found, return it
  if (emoji) return emoji;

  // ✅ If fallback is explicitly provided, use it; otherwise, default to '❌'
  return fallback !== undefined ? fallback : '❌';
}

module.exports = getEmojiWithFallback;

// EXAMPLE USAGES
//
// IMPORT:
// const getEmojiWithFallback = require('../../utils/helpers/getEmojiWithFallback');
//

// const exampleEmoji = await getEmojiWithFallback('emoji_throphy', '🏆');
