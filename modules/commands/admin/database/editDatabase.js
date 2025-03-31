const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const dbUtils = require('../../../utils/essentials/dbUtils');
const logger = require('../../../utils/essentials/logger');
const IMPORTANT_KEYS = {
  ensured_channels: 'channel_key',
  guild_channels: 'channel_key',
  guild_emojis: 'emoji_key',
  guild_roles: 'role_key',
  guild_webhooks: 'webhook_key'
};
module.exports.data = new SlashCommandBuilder()
  .setName('edit_database')
  .setDescription('ADMIN: Edit a specific field in a database table.')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand(subcommand =>
    subcommand
      .setName('change')
      .setDescription('ADMIN: Edit a database row field')
      .addStringOption(option =>
        option
          .setName('database')
          .setDescription('Select the database to edit')
          .setRequired(true)
          .setAutocomplete(true)
      )
      .addStringOption(option =>
        option
          .setName('table')
          .setDescription('Select the table to edit')
          .setRequired(true)
          .setAutocomplete(true)
      )
      .addStringOption(option =>
        option
          .setName('column')
          .setDescription('Select the column to update')
          .setRequired(true)
          .setAutocomplete(true)
      )
      .addStringOption(option =>
        option
          .setName('field')
          .setDescription('Select the field value to update')
          .setRequired(true)
          .setAutocomplete(true)
      )
      .addStringOption(option =>
        option
          .setName('new_value')
          .setDescription('Enter the new value for the field')
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('change_keys')
      .setDescription('ADMIN: Quickly update important database keys.)')
      .addStringOption(option =>
        option
          .setName('table')
          .setDescription('Select the table containing the key')
          .setRequired(true)
          .setAutocomplete(true)
      )
      .addStringOption(option =>
        option
          .setName('key')
          .setDescription('Select the key to update')
          .setRequired(true)
          .setAutocomplete(true)
      )
      .addStringOption(option =>
        option
          .setName('new_value')
          .setDescription('Enter the new value for the key')
          .setRequired(true)
      )
  );
module.exports.execute = async interaction => {
  try {
    if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({
        content: '❌ You do not have permission to use this command.',
        flags: 64
      });
    }
    await interaction.deferReply({ flags: 64 });
    const subcommand = interaction.options.getSubcommand();
    let query, params;
    if (subcommand === 'change') {
      const dbChoice = interaction.options.getString('database');
      const table = interaction.options.getString('table');
      const column = interaction.options.getString('column');
      const field = interaction.options.getString('field');
      const newValue = interaction.options.getString('new_value');
      let runQueryFunc, dbHandler;
      switch (dbChoice) {
        case 'main':
          runQueryFunc = dbUtils.runQuery;
          dbHandler = dbUtils;
          break;
        case 'messages':
          runQueryFunc = dbUtils.messages.runQuery;
          dbHandler = dbUtils.messages;
          break;
        case 'images':
          runQueryFunc = dbUtils.image.runQuery;
          dbHandler = dbUtils.image;
          break;
        case 'guild':
        default:
          runQueryFunc = dbUtils.guild.runQuery;
          dbHandler = dbUtils.guild;
          break;
      }
      query = `UPDATE ${table} SET ${column} = ? WHERE ${column} = ?`;
      params = [newValue, field];
      await runQueryFunc(query, params);
      await interaction.editReply(
        `✅ Successfully updated **${column}** in table **${table}** from \`${field}\` to \`${newValue}\`.`
      );
      const logDbHandler = dbChoice === 'guild' ? dbHandler : dbUtils.guild;
      try {
        const logChannelData = await logDbHandler.getOne(
          'SELECT channel_id FROM ensured_channels WHERE channel_key = ?',
          ['database_logs']
        );
        if (!logChannelData) {
          logger.warn('⚠️ No log channel found for "database_logs" in the logging database.');
        } else {
          const logChannel = await interaction.guild.channels
            .fetch(logChannelData.channel_id)
            .catch(() => null);
          if (!logChannel) {
            logger.warn(`⚠️ Could not fetch log channel ID: ${logChannelData.channel_id}`);
          } else {
            const embed = new EmbedBuilder()
              .setColor(0x3498db)
              .setTitle('✏️ **Database Field Updated**')
              .setDescription(
                `Action performed by <@${interaction.user.id}> (${interaction.user.tag})`
              )
              .addFields(
                { name: '📂 **Database**', value: `\`${dbChoice}\``, inline: true },
                { name: '📋 **Table**', value: `\`${table}\``, inline: true },
                { name: '📝 **Column**', value: `\`${column}\``, inline: true },
                { name: '❌ **Field (Old Value)**', value: `\`\`\`${field}\`\`\``, inline: true },
                { name: '✅ **Field (New Value)**', value: `\`\`\`${newValue}\`\`\``, inline: true }
              )
              .setTimestamp();
            await logChannel.send({ embeds: [embed] });
          }
        }
      } catch (logErr) {
        logger.error(`Error logging database update: ${logErr.message}`);
      }
    } else if (subcommand === 'change_keys') {
      const table = interaction.options.getString('table');
      const keyColumn = IMPORTANT_KEYS[table];
      if (!keyColumn)
        return interaction.editReply('❌ This table does not have a predefined key column.');
      const key = interaction.options.getString('key');
      const newValue = interaction.options.getString('new_value');
      query = `UPDATE ${table} SET ${keyColumn} = ? WHERE ${keyColumn} = ?`;
      params = [newValue, key];
      await dbUtils.guild.runQuery(query, params);
      await interaction.editReply(
        `✅ Successfully updated key **${keyColumn}** in **${table}** from \`${key}\` to \`${newValue}\`.`
      );
      try {
        const logChannelData = await dbUtils.guild.getOne(
          'SELECT channel_id FROM ensured_channels WHERE channel_key = ?',
          ['database_logs']
        );
        if (!logChannelData) {
          logger.warn('⚠️ No log channel found for "database_logs" in the logging database.');
        } else {
          const logChannel = await interaction.guild.channels
            .fetch(logChannelData.channel_id)
            .catch(() => null);
          if (!logChannel) {
            logger.warn(`⚠️ Could not fetch log channel ID: ${logChannelData.channel_id}`);
          } else {
            const embed = new EmbedBuilder()
              .setColor(0xffa500)
              .setTitle('🔑 **Guild Database Key Updated**')
              .addFields(
                { name: '📋 **Table**', value: `\`${table}\``, inline: true },
                { name: '🔑 **Key Column**', value: `\`${keyColumn}\``, inline: true },
                { name: '❌ **Old Key**', value: `\`\`\`${key}\`\`\``, inline: true },
                { name: '✅ **New Key**', value: `\`\`\`${newValue}\`\`\``, inline: true }
              )
              .setFooter({ text: `Executed by ${interaction.user.tag}` })
              .setTimestamp();
            await logChannel.send({ embeds: [embed] });
          }
        }
      } catch (logErr) {
        logger.error(`Error logging key update: ${logErr.message}`);
      }
    }
  } catch (err) {
    logger.error(`❌ Error executing /edit_database: ${err.message}`);
    return interaction.editReply('❌ An error occurred while updating the database.');
  }
};
module.exports.autocomplete = async interaction => {
  try {
    const focused = interaction.options.getFocused(true);
    const subcommand = interaction.options.getSubcommand();
    const searchValue = focused.value.toLowerCase();
    logger.info(`🔍 DEBUG: Autocomplete triggered for ${focused.name} | Input: ${searchValue}`);
    if (focused.name === 'database') {
      return interaction.respond(
        ['main', 'messages', 'images', 'guild']
          .filter(db => db.includes(searchValue))
          .map(db => ({
            name: db.charAt(0).toUpperCase() + db.slice(1),
            value: db
          }))
      );
    }
    const dbChoice = interaction.options.getString('database') || 'guild';
    if (!dbChoice) return interaction.respond([]);
    let dbHandler;
    switch (dbChoice) {
      case 'main':
        dbHandler = dbUtils;
        break;
      case 'messages':
        dbHandler = dbUtils.messages;
        break;
      case 'images':
        dbHandler = dbUtils.image;
        break;
      case 'guild':
      default:
        dbHandler = dbUtils.guild;
        break;
    }
    let tableNames = [];
    if (subcommand === 'change_keys' && focused.name === 'table') {
      tableNames = Object.keys(IMPORTANT_KEYS);
    } else if (subcommand === 'change' && focused.name === 'table') {
      const tables = await dbHandler.getAll(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
      );
      tableNames = tables.map(row => row.name);
    }
    if (focused.name === 'table') {
      return interaction.respond(
        tableNames
          .filter(name => name.toLowerCase().includes(searchValue))
          .slice(0, 25)
          .map(name => ({ name, value: name }))
      );
    }
    if (focused.name === 'column') {
      const tableChoice = interaction.options.getString('table');
      if (!tableChoice) return interaction.respond([]);
      const columns = await dbHandler.getAll(`PRAGMA table_info(${tableChoice})`);
      return interaction.respond(
        columns
          .map(col => col.name)
          .filter(name => name.toLowerCase().includes(searchValue))
          .slice(0, 25)
          .map(name => ({ name, value: name }))
      );
    }
    if (focused.name === 'field') {
      const tableChoice = interaction.options.getString('table');
      const column = interaction.options.getString('column');
      if (!tableChoice || !column) return interaction.respond([]);
      const fields = await dbHandler.getAll(`SELECT DISTINCT ${column} FROM ${tableChoice}`);
      return interaction.respond(
        fields
          .map(row => row[column])
          .filter(value => value && value.toString().toLowerCase().includes(searchValue))
          .slice(0, 25)
          .map(value => ({ name: value.toString(), value: value.toString() }))
      );
    }
    if (focused.name === 'key' && subcommand === 'change_keys') {
      const tableChoice = interaction.options.getString('table');
      if (!tableChoice) return interaction.respond([]);
      const keyColumn =
        IMPORTANT_KEYS[tableChoice] || IMPORTANT_KEYS[tableChoice.replace(/s$/, '')];
      if (!keyColumn) return interaction.respond([]);
      const keys = await dbHandler.getAll(`SELECT DISTINCT ${keyColumn} FROM ${tableChoice}`);
      return interaction.respond(
        keys
          .map(row => row[keyColumn])
          .filter(value => value.toLowerCase().includes(searchValue))
          .slice(0, 25)
          .map(value => ({ name: value, value }))
      );
    }
  } catch (err) {
    logger.error(`❌ Autocomplete error in /edit_database: ${err.message}`);
    return interaction.respond([]);
  }
};
