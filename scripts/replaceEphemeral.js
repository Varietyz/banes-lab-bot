import { readdir, stat, readFile, writeFile } from 'fs';
import { resolve, join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Properly resolving the current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Correct the path to your bot folder - Adjust this path to match your actual structure
const baseFolder = resolve(__dirname, '../../banes-lab.com/banes-lab-bot'); // Adjust if needed

/**
 * Recursively search through a folder and replace content in .js files.
 * @param folder
 */
function replaceInFiles(folder) {
  readdir(folder, (err, files) => {
    if (err) {
      console.error(`Error reading folder: ${folder}`, err);
      return;
    }

    files.forEach(file => {
      const filePath = join(folder, file);

      stat(filePath, (err, stats) => {
        if (err) {
          console.error(`Error reading file: ${filePath}`, err);
          return;
        }

        if (stats.isDirectory()) {
          replaceInFiles(filePath);
        } else if (stats.isFile() && file.endsWith('.js')) {
          readFile(filePath, 'utf8', (err, data) => {
            if (err) {
              console.error(`Error reading file: ${filePath}`, err);
              return;
            }

            const updatedData = data.replace(/ephemeral: true/g, 'flags: 64');

            if (data !== updatedData) {
              writeFile(filePath, updatedData, 'utf8', err => {
                if (err) {
                  console.error(`Error writing file: ${filePath}`, err);
                } else {
                  console.log(`Updated: ${filePath}`);
                }
              });
            }
          });
        }
      });
    });
  });
}

replaceInFiles(baseFolder);
