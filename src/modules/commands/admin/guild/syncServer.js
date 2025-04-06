const { SlashCommandBuilder } = require('@discordjs/builders');
const { PermissionsBitField, EmbedBuilder } = require('discord.js');
const logger = require('../../../utils/essentials/logger');
const {
  guild: { runQuery, getAll }
} = require('../../../utils/essentials/dbUtils');
const { formatCustomEmoji } = require('../../../utils/helpers/formatCustomEmoji');
function getUniqueKey(name, type, existingKeys) {
  const cleanName = name
    .toLowerCase()
    .replace(/[^a-z0-9\s_]/gi, '')
    .replace(/[-\s]+/g, '_')
    .replace(/^_+|_+$/g, '');
  const baseKey = `${type}_${cleanName}`;
  let uniqueKey = baseKey;
  let suffix = 1;
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
async function cleanupDeletedItems(existingIds, table, idColumn) {
  const storedItems = await getAll(`SELECT ${idColumn} FROM ${table}`);
  for (const item of storedItems) {
    if (!existingIds.has(item[idColumn])) {
      await runQuery(`DELETE FROM ${table} WHERE ${idColumn} = ?`, [item[idColumn]]);
      logger.info(
        `🗑️ Removed ${idColumn} ${item[idColumn]} from ${table} (no longer exists in Discord).`
      );
    }
  }
}
module.exports = {
  data: new SlashCommandBuilder()
    .setName('sync_server')
    .setDescription('ADMIN: Fetch, store, and clean up all relevant server data for the bot.')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
  async execute(interaction) {
    try {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ flags: 64 });
      }
      const startTime = Date.now();
      const guild = interaction.guild;
      if (!guild) {
        return await interaction.reply({
          content: '❌ **Error:** This command must be run in a server.',
          flags: 64
        });
      }
      logger.info(`🔄 Fetching and cleaning server data for guild: ${guild.name} (${guild.id})`);
      const existingChannels = await getAll('SELECT channel_id, channel_key FROM guild_channels');
      const channelIdToKey = new Map();
      const usedChannelKeys = new Set();
      for (const row of existingChannels) {
        channelIdToKey.set(row.channel_id, row.channel_key);
        usedChannelKeys.add(row.channel_key);
      }
      const channelsToSave = [];
      for (const channel of guild.channels.cache.values()) {
        let channelKey = channelIdToKey.get(channel.id);
        if (!channelKey) {
          channelKey = getUniqueKey(channel.name, 'channel', usedChannelKeys);
          channelIdToKey.set(channel.id, channelKey);
        }
        channelsToSave.push({
          id: channel.id,
          key: channelKey,
          name: channel.name,
          type: channel.type,
          category: channel.parent?.name || 'uncategorized',
          permissions: channel.permissionsFor(guild.roles.everyone)?.bitfield.toString() || '0'
        });
      }
      for (const ch of channelsToSave) {
        await runQuery(
          `INSERT INTO guild_channels (channel_id, channel_key, name, type, category, permissions)
                     VALUES (?, ?, ?, ?, ?, ?)
                     ON CONFLICT(channel_id) DO UPDATE
                         SET channel_key = excluded.channel_key,
                             name        = excluded.name,
                             type        = excluded.type,
                             category    = excluded.category,
                             permissions = excluded.permissions`,
          [ch.id, ch.key, ch.name, ch.type, ch.category, ch.permissions]
        );
      }
      logger.info(`📌 Stored/updated ${channelsToSave.length} channels.`);
      const existingRoles = await getAll('SELECT role_id, role_key FROM guild_roles');
      const roleIdToKey = new Map();
      const usedRoleKeys = new Set();
      for (const row of existingRoles) {
        roleIdToKey.set(row.role_id, row.role_key);
        usedRoleKeys.add(row.role_key);
      }
      const rolesToSave = [];
      for (const role of guild.roles.cache.values()) {
        let roleKey = roleIdToKey.get(role.id);
        if (!roleKey) {
          roleKey = getUniqueKey(role.name, 'role', usedRoleKeys);
          roleIdToKey.set(role.id, roleKey);
        }
        rolesToSave.push({
          id: role.id,
          key: roleKey,
          permissions: role.permissions.bitfield.toString()
        });
      }
      for (const r of rolesToSave) {
        await runQuery(
          `INSERT INTO guild_roles (role_id, role_key, permissions)
                     VALUES (?, ?, ?)
                     ON CONFLICT(role_id) DO UPDATE
                         SET role_key   = excluded.role_key,
                             permissions= excluded.permissions`,
          [r.id, r.key, r.permissions]
        );
      }
      logger.info(`🔑 Stored/updated ${rolesToSave.length} roles.`);
      const existingEmojis = await getAll('SELECT emoji_id, emoji_key FROM guild_emojis');
      const emojiIdToKey = new Map();
      const usedEmojiKeys = new Set();
      for (const row of existingEmojis) {
        emojiIdToKey.set(row.emoji_id, row.emoji_key);
        usedEmojiKeys.add(row.emoji_key);
      }
      const emojisToSave = [];
      for (const emoji of guild.emojis.cache.values()) {
        let emojiKey = emojiIdToKey.get(emoji.id);
        if (!emojiKey) {
          emojiKey = getUniqueKey(emoji.name, 'emoji', usedEmojiKeys);
          emojiIdToKey.set(emoji.id, emojiKey);
        }
        emojisToSave.push({
          id: emoji.id,
          key: emojiKey,
          name: emoji.name,
          format: formatCustomEmoji(emoji),
          animated: emoji.animated ? 1 : 0
        });
      }
      for (const e of emojisToSave) {
        await runQuery(
          `INSERT INTO guild_emojis (emoji_id, emoji_key, emoji_name, emoji_format, animated)
                     VALUES (?, ?, ?, ?, ?)
                     ON CONFLICT(emoji_id) DO UPDATE
                         SET emoji_key   = excluded.emoji_key,
                             emoji_name  = excluded.emoji_name,
                             emoji_format= excluded.emoji_format,
                             animated    = excluded.animated`,
          [e.id, e.key, e.name, e.format, e.animated]
        );
      }
      logger.info(`😃 Stored/updated ${emojisToSave.length} emojis.`);
      await guild.members.fetch();
      const membersToSave = Array.from(guild.members.cache.values()).map(member => ({
        id: member.id,
        username: member.user.username
      }));
      for (const m of membersToSave) {
        await runQuery(
          `INSERT INTO guild_members (user_id, username)
                     VALUES (?, ?)
                     ON CONFLICT(user_id) DO UPDATE
                         SET username = excluded.username`,
          [m.id, m.username]
        );
      }
      logger.info(`👥 Stored/updated ${membersToSave.length} members.`);
      const existingWebhooks = await getAll('SELECT webhook_id, webhook_key FROM guild_webhooks');
      const webhookIdToKey = new Map();
      const usedWebhookKeys = new Set();
      for (const row of existingWebhooks) {
        webhookIdToKey.set(row.webhook_id, row.webhook_key);
        usedWebhookKeys.add(row.webhook_key);
      }
      const webhooks = await guild.fetchWebhooks();
      const webhooksToSave = [];
      for (const webhook of webhooks.values()) {
        let key = webhookIdToKey.get(webhook.id);
        if (!key) {
          const nameToUse = webhook.name || guild.name;
          key = getUniqueKey(nameToUse, 'webhook', usedWebhookKeys);
          webhookIdToKey.set(webhook.id, key);
        }
        webhooksToSave.push({
          id: webhook.id,
          key,
          name: webhook.name || guild.name,
          url: webhook.url,
          channelId: webhook.channelId || null
        });
      }
      for (const w of webhooksToSave) {
        await runQuery(
          `INSERT INTO guild_webhooks (webhook_id, webhook_key, webhook_name, webhook_url, channel_id)
                     VALUES (?, ?, ?, ?, ?)
                     ON CONFLICT(webhook_id) DO UPDATE
                         SET webhook_key  = excluded.webhook_key,
                             webhook_name = excluded.webhook_name,
                             webhook_url  = excluded.webhook_url,
                             channel_id   = excluded.channel_id`,
          [w.id, w.key, w.name, w.url, w.channelId]
        );
      }
      logger.info(`📡 Stored/updated ${webhooksToSave.length} webhooks.`);
      await cleanupDeletedItems(
        new Set(channelsToSave.map(c => c.id)),
        'guild_channels',
        'channel_id'
      );
      await cleanupDeletedItems(new Set(rolesToSave.map(r => r.id)), 'guild_roles', 'role_id');
      await cleanupDeletedItems(new Set(emojisToSave.map(e => e.id)), 'guild_emojis', 'emoji_id');
      await cleanupDeletedItems(new Set(membersToSave.map(m => m.id)), 'guild_members', 'user_id');
      await cleanupDeletedItems(
        new Set(webhooksToSave.map(w => w.id)),
        'guild_webhooks',
        'webhook_id'
      );
      const embed = new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle('✅ Server Data Initialized & Cleaned')
        .setDescription(
          `All important server data has been successfully **collected and updated**! 🎉  

This ensures that the bot has **up-to-date information** about channels, roles, members, emojis, and webhooks.  

🔹 *If you've added or removed anything recently, it's now reflected in the bot's database.*`
        )
        .addFields(
          { name: '📌 Channels', value: `**\`${channelsToSave.length}\`**`, inline: true },
          { name: '🔑 Roles', value: `**\`${rolesToSave.length}\`**`, inline: true },
          { name: '😃 Emojis', value: `**\`${emojisToSave.length}\`**`, inline: true },
          { name: '👥 Members', value: `**\`${membersToSave.length}\`**`, inline: true },
          { name: '🔗 Webhooks', value: `**\`${webhooksToSave.length}\`**`, inline: true },
          { name: '\u200b', value: '\u200b', inline: true }
        )
        .setTimestamp();
      await interaction.editReply({ embeds: [embed] });
      const executionTime = Date.now() - startTime;
      logger.info(`✅ Execution completed in ${executionTime}ms, cleanup done.`);
    } catch (error) {
      logger.error(`❌ Error executing /admin_initialize_guild: ${error.message}`);
      await interaction.editReply({
        content: `❌ Error initializing server data: ${error.message}`
      });
    }
  }
};
