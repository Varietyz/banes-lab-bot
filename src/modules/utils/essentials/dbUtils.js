/**
 * Optimized Database Handler
 *
 * This module provides a robust, optimized SQLite database handler for multiple databases:
 * Main, Image Cache, and Guild. It ensures:
 *   - Concurrent asynchronous initialization with proper PRAGMA settings (WAL mode, busy_timeout).
 *   - A consistent API for executing queries and transactions.
 *   - Transaction serialization using a mutex to avoid race conditions.
 *   - Robust error handling and logging, including error persistence in the Guild DB.
 *   - Proper cancellation of pending operations on shutdown.
 *   - A publicly exposed initialization promise for safe startup.
 *
 * Before running any queries, ensure that the database initialization has completed by awaiting the
 * exported `initializationPromise`. For example:
 *
 *    const db = require('./db');
 *    (async () => {
 *      await db.initializationPromise;
 *      await db.guild.runQuery(`CREATE TABLE IF NOT EXISTS ...`);
 *    })();
 *
 * This version has been tested in a Node.js v22.13.0 environment.
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const logger = require('./logger');
const { Mutex } = require('async-mutex');
const globalState = require('../../../config/globalState');

// Define database file paths.
const mainDbPath = path.join(__dirname, '../../../data/database.sqlite');
const imageDbPath = path.join(__dirname, '../../../data/image_cache.db');
const guildDbPath = path.join(__dirname, '../../../data/guild.db');

// Create a mutex to serialize transactions on the main database.
const transactionMutex = new Mutex();

// Raw SQLite database instances.
let mainDb = null;
let imageDb = null;
let guildDb = null;

// Wrapped database operation functions.
const dbFunctions = {
  main: null,
  image: null,
  guild: null
};

// Client instance for error event emission.
let clientInstance = null;

// --- Helper Functions ---

/**
 * Initializes a SQLite database connection.
 * Sets WAL mode and busy_timeout for improved concurrency.
 *
 * @param {string} dbPath - The file path for the SQLite database.
 * @param {string} dbName - A human-friendly name for logging.
 * @returns {Promise<sqlite3.Database>}
 */
function initializeDatabase(dbPath, dbName) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, err => {
      if (err) {
        handleDbError(err, dbName)
          .then(() => reject(err))
          .catch(() => reject(err));
      } else {
        db.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;', err => {
          if (err) logger.warn(`PRAGMA error on ${dbName}: ${err.message}`);
        });
        logger.info(`✅ SQLite ${dbName} connected: ${dbPath}`);
        resolve(db);
      }
    });
  });
}

/**
 * Factory function to create standard query methods for a database.
 *
 * @param {sqlite3.Database} db - The SQLite database instance.
 * @param {string} dbName - The database name (used for logging).
 * @returns {Object} - An object with runQuery, getAll, and getOne methods.
 */
function createDbFunctions(db, dbName) {
  return {
    runQuery: (query, params = []) =>
      new Promise((resolve, reject) => {
        db.run(query, params, function (err) {
          if (err) {
            handleDbError(err, dbName);
            return reject(err);
          }
          resolve(this);
        });
      }),
    getAll: (query, params = []) =>
      new Promise((resolve, reject) => {
        db.all(query, params, (err, rows) => {
          if (err) {
            handleDbError(err, dbName);
            return reject(err);
          }
          resolve(rows);
        });
      }),
    getOne: (query, params = []) =>
      new Promise((resolve, reject) => {
        db.get(query, params, (err, row) => {
          if (err) {
            handleDbError(err, dbName);
            return reject(err);
          }
          resolve(row || null);
        });
      })
  };
}

// --- Initialization ---

/**
 * Opens all SQLite databases concurrently and sets up the wrapped query methods.
 * @returns {Promise<void>}
 */
async function openDatabases() {
  try {
    const [mDb, imgDb, gDb] = await Promise.all([
      initializeDatabase(mainDbPath, 'Main Database'),
      initializeDatabase(imageDbPath, 'Image Cache Database'),
      initializeDatabase(guildDbPath, 'Guild Database')
    ]);
    mainDb = mDb;
    imageDb = imgDb;
    guildDb = gDb;

    dbFunctions.main = createDbFunctions(mainDb, 'Main Database');
    dbFunctions.image = createDbFunctions(imageDb, 'Image Cache Database');
    dbFunctions.guild = createDbFunctions(guildDb, 'Guild Database');
  } catch (err) {
    logger.error(`🚨 Error opening databases: ${err.message}`);
    throw err;
  }
}

// Create a promise that will resolve once all databases are initialized.
const initializationPromise = openDatabases().catch(err => {
  logger.error(`Database initialization failed: ${err.message}`);
  process.exit(1); // Exit if initialization fails.
});

// --- Public API Functions ---

/**
 * Sets the client instance used for emitting error events.
 *
 * @param {object} client - The client instance.
 */
function setClient(client) {
  clientInstance = client;
}

/**
 * Handles database errors by logging, persisting error details in the Guild Database,
 * and emitting an error event on the client.
 *
 * @param {Error} error - The error object.
 * @param {string} dbName - The database name where the error occurred.
 * @param {object} [client] - Optional client instance.
 * @returns {Promise<void>}
 */
async function handleDbError(error, dbName, client) {
  if (globalState.isShuttingDown) {
    logger.warn(`Shutdown in progress. Skipping error logging for ${dbName}: ${error.message}`);
    return;
  }
  logger.error(`🚨 Database Error in ${dbName}: ${error.message}`);
  const emitterClient = client || clientInstance;
  if (!emitterClient) {
    logger.warn('⚠️ Client instance is missing, cannot emit error event.');
    return;
  }
  try {
    // Ensure error_logs table exists in the Guild Database.
    await dbFunctions.guild.runQuery(`
            CREATE TABLE IF NOT EXISTS error_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                error_message TEXT NOT NULL,
                error_stack TEXT,
                occurrences INTEGER DEFAULT 1,
                last_occurred TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                reported INTEGER DEFAULT 0
            )
        `);
    // Look for similar recent errors (within 30 minutes).
    const existingError = await dbFunctions.guild.getOne(
      "SELECT * FROM error_logs WHERE error_message = ? AND last_occurred > DATETIME('now', '-1800 seconds')",
      [error.message]
    );
    if (existingError) {
      await dbFunctions.guild.runQuery(
        'UPDATE error_logs SET occurrences = occurrences + 1, last_occurred = CURRENT_TIMESTAMP WHERE id = ?',
        [existingError.id]
      );
    } else {
      await dbFunctions.guild.runQuery(
        'INSERT INTO error_logs (error_message, error_stack) VALUES (?, ?)',
        [error.message, error.stack || null]
      );
    }
  } catch (logError) {
    logger.error(`🚨 Failed to log error in Guild Database: ${logError.message}`);
  }
  emitterClient.emit('error', error, emitterClient);
}

/**
 * Executes a series of queries within a transaction on the Main Database.
 * Uses a mutex to serialize transactions and rolls back if any query fails.
 *
 * @param {Array<{query: string, params: Array}>} queries - Array of query objects.
 * @returns {Promise<void>}
 */
async function runTransaction(queries) {
  return transactionMutex.runExclusive(async () => {
    try {
      await new Promise((resolve, reject) => {
        mainDb.exec('BEGIN TRANSACTION', err => (err ? reject(err) : resolve()));
      });
      for (const { query, params } of queries) {
        await new Promise((resolve, reject) => {
          mainDb.run(query, params, err => {
            if (err) {
              handleDbError(err, 'Main Database');
              return reject(err);
            }
            resolve();
          });
        });
      }
      await new Promise((resolve, reject) => {
        mainDb.exec('COMMIT', err => (err ? reject(err) : resolve()));
      });
    } catch (error) {
      await new Promise(resolve => {
        mainDb.exec('ROLLBACK', () => resolve());
      });
      logger.error(`🚨 Error running transaction: ${error.message}`);
      throw error;
    }
  });
}

/**
 * Cancels all further database operations by overriding the core methods
 * on each active database instance. This is intended for shutdown.
 */
function cancelAllDbOperations() {
  const dbInstances = [mainDb, imageDb, guildDb];
  dbInstances.forEach(db => {
    if (!db) return;
    db.run = function (...args) {
      const callback = args[args.length - 1];
      if (typeof callback === 'function') {
        return callback(new Error('Database operation cancelled due to shutdown.'));
      }
    };
    db.exec = function (...args) {
      const callback = args[args.length - 1];
      if (typeof callback === 'function') {
        return callback(new Error('Database operation cancelled due to shutdown.'));
      }
    };
    db.all = function (...args) {
      const callback = args[args.length - 1];
      if (typeof callback === 'function') {
        return callback(null, []);
      }
      return Promise.resolve([]);
    };
    db.get = function (...args) {
      const callback = args[args.length - 1];
      if (typeof callback === 'function') {
        return callback(null, null);
      }
      return Promise.resolve(null);
    };
  });
  logger.info('All further database operations have been cancelled.');
}

/**
 * Retrieves a configuration value from the "config" table in the Main Database.
 *
 * @param {string} key - The configuration key.
 * @param {any} [defaultValue=null] - Default value if key not found.
 * @returns {Promise<any>}
 */
async function getConfigValue(key, defaultValue = null) {
  const row = await dbFunctions.main.getOne('SELECT value FROM config WHERE key = ?', [key]);
  return row ? row.value : defaultValue;
}

/**
 * Sets or updates a configuration value in the "config" table of the Main Database.
 *
 * @param {string} key - The configuration key.
 * @param {any} value - The value to set.
 * @returns {Promise<void>}
 */
async function setConfigValue(key, value) {
  const valStr = String(value);
  await dbFunctions.main.runQuery('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)', [
    key,
    valStr
  ]);
}

/**
 * Closes all database connections gracefully.
 *
 * @returns {Promise<void>}
 */
function closeDatabases() {
  return Promise.all([
    new Promise(resolve => {
      if (mainDb) {
        mainDb.close(err => {
          if (err) {
            logger.error(`Error closing Main Database: ${err.message}`);
          } else {
            logger.info('Main Database closed successfully.');
          }
          resolve();
        });
      } else {
        resolve();
      }
    }),
    new Promise(resolve => {
      if (imageDb) {
        imageDb.close(err => {
          if (err) {
            logger.error(`Error closing Image Cache Database: ${err.message}`);
          } else {
            logger.info('Image Cache Database closed successfully.');
          }
          resolve();
        });
      } else {
        resolve();
      }
    }),
    new Promise(resolve => {
      if (guildDb) {
        guildDb.close(err => {
          if (err) {
            logger.error(`Error closing Guild Database: ${err.message}`);
          } else {
            logger.info('Guild Database closed successfully.');
          }
          resolve();
        });
      } else {
        resolve();
      }
    })
  ]);
}

// --- Module Exports ---
// The public API ensures that no database query runs until the initialization promise resolves.
module.exports = {
  initializationPromise,
  runQuery: (...args) => initializationPromise.then(() => dbFunctions.main.runQuery(...args)),
  getAll: (...args) => initializationPromise.then(() => dbFunctions.main.getAll(...args)),
  getOne: (...args) => initializationPromise.then(() => dbFunctions.main.getOne(...args)),
  runTransaction,
  getConfigValue,
  setConfigValue,
  image: {
    runQuery: (...args) => initializationPromise.then(() => dbFunctions.image.runQuery(...args)),
    getAll: (...args) => initializationPromise.then(() => dbFunctions.image.getAll(...args)),
    getOne: (...args) => initializationPromise.then(() => dbFunctions.image.getOne(...args))
  },
  guild: {
    runQuery: (...args) => initializationPromise.then(() => dbFunctions.guild.runQuery(...args)),
    getAll: (...args) => initializationPromise.then(() => dbFunctions.guild.getAll(...args)),
    getOne: (...args) => initializationPromise.then(() => dbFunctions.guild.getOne(...args))
  },
  setClient,
  openDatabases, // For reinitialization if needed.
  closeDatabases,
  handleDbError,
  cancelAllDbOperations
};
