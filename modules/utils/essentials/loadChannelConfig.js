// 📁 utils/essentials/loadChannelConfig.js
const fs = require('fs');
const path = require('path');

function listAvailablePresets() {
  const presetDir = path.join(__dirname, '../../../config/channels');
  return fs
    .readdirSync(presetDir)
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace('.json', ''));
}

function loadChannelConfigFromFile(presetName) {
  if (!presetName || typeof presetName !== 'string') {
    throw new Error('❌ Preset name must be provided and must be a string.');
  }

  const filePath = path.join(__dirname, '../../../config/channels', presetName);
  if (!fs.existsSync(filePath)) {
    throw new Error(`❌ Config not found: ${filePath}`);
  }

  const raw = fs.readFileSync(filePath, 'utf-8');
  try {
    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed.categories) || !Array.isArray(parsed.noCategory)) {
      throw new Error('Invalid structure. Expected `categories` and `noCategory` arrays.');
    }

    return parsed;
  } catch (err) {
    throw new Error(`❌ Failed to parse config: ${err.message}`);
  }
}

module.exports = {
  loadChannelConfigFromFile,
  listAvailablePresets
};
