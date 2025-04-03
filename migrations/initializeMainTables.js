const db = require("../modules/utils/essentials/dbUtils");
const logger = require("../modules/utils/essentials/logger");

/**
 * Initializes the main database tables for user authentication and profiles.
 */
const initializeMainTables = async () => {
  try {
    logger.info("🔄 Ensuring all necessary main tables exist...");

    // Ensure the database is fully initialized
    await db.initializationPromise;

    const tables = {
      // Users table: use a UUID or custom-generated string for user_id
      users: `
        user_id TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at INTEGER DEFAULT (strftime('%s','now'))
      `,
      // Sessions table: tracks active login sessions
      user_sessions: `
        session_id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        token TEXT NOT NULL UNIQUE,
        created_at INTEGER DEFAULT (strftime('%s','now')),
        expires_at INTEGER,
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
      `,
      // Profiles table: PLACEHOLDER, storing additional profile data.
      user_profiles: `
        user_id TEXT PRIMARY KEY,
        display_name TEXT,
        bio TEXT,
        avatar_url TEXT,
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
      `,
      user_channels: `
        user_id TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      `,
      messages_queue: `
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  content TEXT NOT NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  delivered BOOLEAN DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(user_id)
      `,
    };

    for (const [table, schema] of Object.entries(tables)) {
      await db.runQuery(`CREATE TABLE IF NOT EXISTS ${table} (${schema});`);
      logger.info(`✅ Ensured "${table}" table exists.`);
    }

    logger.info("✅ All main tables have been successfully initialized.");
  } catch (error) {
    logger.error(`❌ Error initializing main tables: ${error.message}`);
  }
};

module.exports = initializeMainTables;
