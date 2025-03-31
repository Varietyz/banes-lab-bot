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
      // Users table: stores user credentials and basic info.
      users: `
        user_id TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at INTEGER DEFAULT (strftime('%s','now'))
      `,
      // Sessions table: stores session tokens for user login sessions.
      user_sessions: `
        session_id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        token TEXT NOT NULL UNIQUE,
        created_at INTEGER DEFAULT (strftime('%s','now')),
        expires_at INTEGER,
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
      `,
      // Profiles table: optional, storing additional profile data.
      user_profiles: `
        user_id TEXT PRIMARY KEY,
        display_name TEXT,
        bio TEXT,
        avatar_url TEXT,
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
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
