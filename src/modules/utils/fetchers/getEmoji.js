// /modules/utils/fetchers/getEmoji.js
const db = require('../essentials/dbUtils');
const logger = require('../essentials/logger');

const emojiCache = {};

/**
 * Retrieves the emoji format for a given emoji key from the database.
 * Uses caching to minimize database queries.
 *
 * @param {string} emojiKey - The key to lookup (e.g., 'emoji_clan_loading').
 * @returns {Promise<string>} - The emoji format string or an empty string if not found.
 */
async function getEmoji(emojiKey) {
  // Check cache first
  if (emojiCache[emojiKey]) {
    return emojiCache[emojiKey];
  }

  try {
    // Query the database for the emoji format.
    const rows = await db.guild.getAll(
      'SELECT emoji_format FROM guild_emojis WHERE emoji_key = ?',
      [emojiKey]
    );
    const emoji = rows.length > 0 ? rows[0].emoji_format : '';
    // Cache the result for subsequent lookups.
    emojiCache[emojiKey] = emoji;
    return emoji;
  } catch (err) {
    logger.error(`Failed to fetch emoji for key "${emojiKey}": ${err.message}`);
    return '';
  }
}

module.exports = getEmoji;

// EXAMPLE USAGES
//
// IMPORT:
// const getEmoji = require('../../utils/helpers/getEmoji');
//

// const loadingEmoji = await getEmoji('emoji_clan_loading');

// Use `loadingEmoji` in your embed or message formatting.
