const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const logger = require("../modules/utils/essentials/logger"); // Import the logger
const dbPath = path.join(__dirname, "..", "data", "database.sqlite");

/**
 *
 */
function initializeDatabase() {
  // Establish a new database connection.
  const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      logger.error(`❌ Error connecting to SQLite: ${err.message}`);
      throw err; // Terminate script if connection fails.
    } else {
      logger.info(`✅ Connected to SQLite at: ${dbPath}`);
    }
  });

  return db;
}

/**
 *
 * @param db
 */
async function dropTables(db) {
  const tables = ["users", "user_sessions", "user_profiles"];
  try {
    for (const table of tables) {
      await new Promise((resolve, reject) => {
        db.run(`DROP TABLE IF EXISTS ${table};`, (err) => {
          if (err) {
            console.error(`❌ Error dropping table ${table}: ${err.message}`);
            reject(err);
          } else {
            console.log(`✅ Dropped table: ${table}`);
            resolve();
          }
        });
      });
    }
    console.log("✅ All selected tables dropped successfully!");
  } catch (error) {
    console.error(`❌ Error during table deletion: ${error.message}`);
  }
}

(async function main() {
  try {
    const db = initializeDatabase();

    await dropTables(db);

    db.close((err) => {
      if (err) {
        logger.error(`❌ Error closing the database: ${err.message}`);
      } else {
        logger.info("✅ DB closed successfully.");
      }
      throw new Error("DB closed successfully.");
    });
  } catch (error) {
    logger.error(`❌ Database initialization failed: ${error.message}`);
    throw new Error("Database initialization failed"); // Throw an error instead of exiting the process.
  }
})();
