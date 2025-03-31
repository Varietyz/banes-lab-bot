// 📂 scripts/updateGraphicsData.js
import { readdirSync, writeFileSync } from 'fs';
import { join, relative } from 'path';

// Folder mapping
const graphicsFolders = {
  osrsVarietyz: 'varietyz',
  enigmaRoot: 'enigma_esports',
  logos: 'logos',
  osrsAvatars: 'osrs/avatars',
  osrsBingo: 'osrs/bingo',
  runeliteTheme: 'osrs/theme_packs/runelite_theme',
  varietyzDeluxe: 'osrs/theme_packs/varietyz_deluxe',
  osrsRoseyrs: 'roseyrs',
  runeliteUI: 'runelite_ui',
  droptrackerFiles: 'droptracker_io_ui',
  elements: 'elements'
};

import { fileURLToPath } from 'url';

const dirname = fileURLToPath(new URL('.', import.meta.url));
const assetsDir = join(dirname, '..', 'public', 'assets', 'images');
const outputFile = join(dirname, '..', 'src', 'data', 'graphicsData.js');

const extPriority = { gif: 1, png: 2, jpg: 3, jpeg: 3, webp: 4 };
const specialDroptrackerPrefixes = ['Varietyz', 'RuneLite', 'OSRS', 'Rosey'];

/**
 * Recursively gathers relative paths of all image files, sorted by type priority.
 */
function getOrderedImageFiles(dir, baseDir, key = '') {
  const results = [];

  const walk = current => {
    const entries = readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (/\.(gif|png|jpe?g|webp)$/i.test(entry.name)) {
        results.push(relative(baseDir, full).replace(/\\/g, '/'));
      }
    }
  };

  walk(dir);

  if (key === 'droptrackerFiles') {
    return results.sort((a, b) => {
      const nameA = a.split('/').pop();
      const nameB = b.split('/').pop();
      const isSpecialA = specialDroptrackerPrefixes.some(prefix => nameA.startsWith(prefix));
      const isSpecialB = specialDroptrackerPrefixes.some(prefix => nameB.startsWith(prefix));

      if (isSpecialA && !isSpecialB) return -1;
      if (!isSpecialA && isSpecialB) return 1;

      // If same type, apply extension priority then name sort
      const extA = nameA.split('.').pop().toLowerCase();
      const extB = nameB.split('.').pop().toLowerCase();
      const pA = extPriority[extA] || 99;
      const pB = extPriority[extB] || 99;

      return pA - pB || nameA.localeCompare(nameB);
    });
  }

  // Normal sort for others
  return results.sort((a, b) => {
    const extA = a.split('.').pop().toLowerCase();
    const extB = b.split('.').pop().toLowerCase();
    const pA = extPriority[extA] || 99;
    const pB = extPriority[extB] || 99;
    return pA - pB || a.localeCompare(b);
  });
}

// 🔄 Build output file
let output = `// ⚙️ Auto-generated graphics data\n\n`;

for (const [key, folder] of Object.entries(graphicsFolders)) {
  const folderPath = join(assetsDir, folder);
  const files = getOrderedImageFiles(folderPath, folderPath, key);

  const formatted = files.map(f => `'${f}'`).join(',\n    ');
  output += `export const ${key} = {\n`;
  output += `  basePath: '/assets/images/${folder}',\n`;
  output += `  files: [\n    ${formatted}\n  ],\n};\n\n`;
}

writeFileSync(outputFile, output, 'utf-8');
console.log('✅ graphicsData.js updated with custom format order and Droptracker logic!');
