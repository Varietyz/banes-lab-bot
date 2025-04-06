const db = require('../modules/utils/essentials/dbUtils');
const logger = require('../modules/utils/essentials/logger');

const initializeGuildTables = async () => {
  try {
    logger.info('🔄 Ensuring all necessary guild tables exist...');

    // ✅ Ensure DB is fully initialized
    await db.initializationPromise;

    const tables = {
      ensured_channels: `
        channel_key TEXT PRIMARY KEY,
        channel_id TEXT NOT NULL UNIQUE
      `,
      guild_channels: `
        channel_id TEXT PRIMARY KEY,
        channel_key TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        type INTEGER NOT NULL,
        category TEXT DEFAULT 'general',
        permissions INTEGER DEFAULT 0
      `,
      guild_roles: `
        role_id TEXT PRIMARY KEY,
        role_key TEXT UNIQUE,
        permissions INTEGER DEFAULT 0
      `,
      guild_webhooks: `
        webhook_id TEXT PRIMARY KEY,
        webhook_key TEXT UNIQUE,
        webhook_url TEXT NOT NULL,
        channel_id TEXT DEFAULT NULL,
        webhook_name TEXT DEFAULT 'Unnamed Webhook',
        FOREIGN KEY (channel_id) REFERENCES guild_channels(channel_id) ON DELETE SET NULL
      `,
      guild_emojis: `
        emoji_id TEXT PRIMARY KEY,
        emoji_key TEXT,
        emoji_name TEXT NOT NULL,
        emoji_format TEXT NOT NULL,
        animated INTEGER DEFAULT 0
      `,
      guild_members: `
        user_id TEXT PRIMARY KEY,
        username TEXT NOT NULL
      `,
      guild_events: `
        event_id TEXT PRIMARY KEY,
        guild_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT DEFAULT 'No description',
        creator_id TEXT DEFAULT 'Unknown',
        event_type INTEGER NOT NULL,
        privacy INTEGER NOT NULL,
        start_time INTEGER NOT NULL,
        channel_id TEXT DEFAULT NULL,
        banner_url TEXT DEFAULT NULL
      `
    };

    for (const [table, schema] of Object.entries(tables)) {
      await db.guild.runQuery(`CREATE TABLE IF NOT EXISTS ${table} (${schema});`);
      logger.info(`✅ Ensured "${table}" table exists.`);
    }

    logger.info('✅ All main guild tables have been successfully initialized.');
  } catch (error) {
    logger.error(`❌ Error initializing guild tables: ${error.message}`);
  }
};

module.exports = initializeGuildTables;
