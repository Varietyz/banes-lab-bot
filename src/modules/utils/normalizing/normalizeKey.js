async function normalizeKey(name, type, db) {
  const tableMapping = {
    emoji: { table: 'guild_emojis', keyColumn: 'emoji_key' },
    channel: { table: 'guild_channels', keyColumn: 'channel_key' },
    role: { table: 'guild_roles', keyColumn: 'role_key' },
    webhook: { table: 'guild_webhooks', keyColumn: 'webhook_key' }
  };
  if (!tableMapping[type]) {
    throw new Error(`🚨 normalizeKey Error: Unsupported type '${type}'`);
  }
  const { table, keyColumn } = tableMapping[type];
  const existingKeys = new Set(
    (await db.guild.getAll(`SELECT ${keyColumn} FROM ${table}`))?.map(row => row[keyColumn]) || []
  );
  const cleanName = name
    .toLowerCase()
    .replace(/[^a-z0-9\s_]/gi, '')
    .replace(/[-\s]+/g, '_')
    .replace(/^_+|_+$/g, '');
  const baseKey = `${type}_${cleanName}`;
  if (!existingKeys.has(baseKey)) {
    existingKeys.add(baseKey);
    return baseKey;
  }
  let suffix = 1;
  let uniqueKey = baseKey;
  while (existingKeys.has(uniqueKey)) {
    uniqueKey = `${baseKey}_${suffix}`;
    suffix++;
    if (uniqueKey.length > 32) {
      uniqueKey = `${baseKey.slice(0, 29)}_${suffix}`;
    }
  }
  existingKeys.add(uniqueKey);
  return uniqueKey;
}
module.exports = { normalizeKey };
