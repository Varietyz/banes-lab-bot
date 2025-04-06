const fs = require('fs');
const path = require('path');
const logger = require('../modules/utils/essentials/logger');
const db = require('../modules/utils/essentials/dbUtils');
const resourcesPath = path.resolve(__dirname, '../resources');
function getAllFilesWithMetadata(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = entries
    .filter(entry => !entry.isDirectory())
    .map(entry => {
      const absolutePath = path.resolve(dir, entry.name);
      const relativeToResources = path.relative(resourcesPath, absolutePath).replace(/\\/g, '/');
      return {
        fileName: path.basename(entry.name, path.extname(entry.name)).toLowerCase(),
        filePath: `banes-lab-bot/resources/${relativeToResources}`,
        relativeToResources
      };
    });
  const folders = entries.filter(entry => entry.isDirectory());
  for (const folder of folders) {
    files.push(...getAllFilesWithMetadata(path.resolve(dir, folder.name)));
  }
  return files;
}
async function populateImageCache() {
  try {
    const files = getAllFilesWithMetadata(resourcesPath);
    const groups = {};
    for (const file of files) {
      const relative = file.relativeToResources;
      let folder = relative.includes('/') ? relative.split('/')[0] : 'resources';
      if (folder === 'src') {
        folder = 'resources';
      }
      if (!groups[folder]) {
        groups[folder] = [];
      }
      groups[folder].push(file);
    }
    for (const folderName in groups) {
      const sanitizedFolderName = folderName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const tableName = sanitizedFolderName;
      try {
        await db.image.runQuery(`
                    CREATE TABLE IF NOT EXISTS ${tableName} (
                        idx INTEGER PRIMARY KEY AUTOINCREMENT,
                        file_name TEXT NOT NULL,
                        file_path TEXT NOT NULL
                    );
                `);
        logger.info(`✅ Ensured table ${tableName} exists.`);
      } catch (tableError) {
        logger.error(`Error ensuring table "${tableName}" exists:`, tableError);
        continue;
      }
      const groupFiles = groups[folderName];
      for (const { fileName, filePath } of groupFiles) {
        try {
          const updateResult = await db.image.runQuery(
            `
                        UPDATE ${tableName}
                        SET file_path = ?
                        WHERE file_name = ?
                        `,
            [filePath, fileName]
          );
          if (updateResult.changes === 0) {
            await db.image.runQuery(
              `
                            INSERT INTO ${tableName} (file_name, file_path)
                            VALUES (?, ?)
                            `,
              [fileName, filePath]
            );
          }
        } catch (fileError) {
          logger.error(`Error processing file "${fileName}" in table "${tableName}":`, fileError);
        }
      }
      logger.info(`✅ Table ${tableName} updated successfully with ${groupFiles.length} records.`);
      try {
        const existingRecords = await db.image.getAll(`SELECT file_name FROM ${tableName}`);
        logger.debug(`Existing records for table "${tableName}":`, existingRecords);
        const currentFileNames = new Set(
          groupFiles.map(file => file.fileName.trim().toLowerCase())
        );
        for (const record of existingRecords) {
          const dbFileName = record.file_name.trim().toLowerCase();
          if (!currentFileNames.has(dbFileName)) {
            const deleteResult = await db.image.runQuery(
              `DELETE FROM ${tableName} WHERE file_name = ?`,
              [dbFileName]
            );
            logger.info(
              `❌ Removed missing file '${dbFileName}' from table ${tableName}.`,
              deleteResult
            );
          }
        }
      } catch (deleteError) {
        logger.error(`Error removing missing files from table "${tableName}":`, deleteError);
      }
    }
    logger.info('✅ Image cache populated.');
  } catch (error) {
    logger.error('Error populating image cache:', error);
    throw error;
  }
}
module.exports = { populateImageCache };
