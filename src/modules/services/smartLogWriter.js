const db = require('../utils/essentials/dbUtils');
const logger = require('../utils/essentials/logger');

async function saveSmartLogToDb(entry) {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS smart_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      temperature REAL,
      power_on_hours INTEGER,
      percentage_used INTEGER,
      data_read_gb REAL,
      data_written_gb REAL
    )
  `;

  const insertQuery = `
    INSERT INTO smart_metrics (
      timestamp, temperature, power_on_hours,
      percentage_used, data_read_gb, data_written_gb
    )
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  try {
    await db.runQuery(createTableQuery);
    await db.runQuery(insertQuery, [
      entry.timestamp.toISOString(),
      entry.temperature,
      entry.power_on_hours,
      entry.percentage_used,
      entry.data_read_gb,
      entry.data_written_gb
    ]);
  } catch (err) {
    logger.error("❌ Failed to insert SMART log into DB:", err.message);
  }
}

module.exports = { saveSmartLogToDb };
