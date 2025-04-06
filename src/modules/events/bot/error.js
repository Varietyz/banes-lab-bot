const logger = require('../../utils/essentials/logger');
const { EmbedBuilder, WebhookClient } = require('discord.js');
const db = require('../../utils/essentials/dbUtils');
module.exports = {
  name: 'error',
  once: false,
  async execute(error, client) {
    logger.error(`❌ Bot Error: ${error.message}`);
    const ERROR_TRACK_TIME = 1800;
    const ERROR_ALERT_THRESHOLD = 5;
    const webhookData = await db.guild.getOne(
      'SELECT webhook_url FROM guild_webhooks WHERE webhook_key = ?',
      ['webhook_critical_state']
    );
    const roleData = await db.guild.getOne('SELECT role_id FROM guild_roles WHERE role_key = ?', [
      'role_owner'
    ]);
    if (!webhookData || !webhookData.webhook_url) {
      logger.warn('⚠️ No webhook URL found for critical errors.');
    }
    if (!roleData || !roleData.role_id) {
      logger.warn('⚠️ No management role ID found in database.');
    }
    const webhookURL = webhookData?.webhook_url;
    const managementRoleID = roleData?.role_id;
    await db.guild.runQuery(`
          CREATE TABLE IF NOT EXISTS error_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            error_message TEXT NOT NULL,
            error_stack TEXT,
            occurrences INTEGER DEFAULT 1,
            last_occurred TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            reported INTEGER DEFAULT 0
          )
        `);
    const existingError = await db.guild.getOne(
      `SELECT * FROM error_logs WHERE error_message = ? AND last_occurred > DATETIME('now', '-${ERROR_TRACK_TIME} seconds')`,
      [error.message]
    );
    if (existingError) {
      await db.guild.runQuery(
        'UPDATE error_logs SET occurrences = occurrences + 1, last_occurred = CURRENT_TIMESTAMP WHERE id = ?',
        [existingError.id]
      );
    } else {
      await db.guild.runQuery('INSERT INTO error_logs (error_message, error_stack) VALUES (?, ?)', [
        error.message,
        error.stack || null
      ]);
    }
    const currentError = await db.guild.getOne('SELECT * FROM error_logs WHERE error_message = ?', [
      error.message
    ]);
    if (!currentError) {
      logger.warn('⚠️ Error not found in database after insert/update.');
      return;
    }
    const logChannelData = await db.guild.getOne(
      'SELECT channel_id FROM ensured_channels WHERE channel_key = ?',
      ['bot_logs']
    );
    const logChannel = logChannelData
      ? await client.channels.fetch(logChannelData.channel_id).catch(() => null)
      : null;
    if (!logChannel) {
      logger.warn(`⚠️ Could not fetch log channel ID ${logChannelData?.channel_id}.`);
      return;
    }
    const embed = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle('❌ Bot Error Detected')
      .setDescription(`\`\`\`${error.stack || error.message}\`\`\``)
      .addFields(
        { name: 'Occurrences', value: `${currentError.occurrences}`, inline: true },
        { name: 'Last Occurred', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true }
      )
      .setTimestamp();
    await logChannel.send({ embeds: [embed] });
    logger.info('📋 Logged new error in bot_logs.');
    if (currentError.occurrences >= ERROR_ALERT_THRESHOLD && webhookURL) {
      const webhookClient = new WebhookClient({ url: webhookURL });
      const webhookEmbed = new EmbedBuilder()
        .setColor(0xe74c3c)
        .setTitle('🚨 URGENT BOT ERROR')
        .setDescription(`**Error Message:**\n\`\`\`${error.message}\`\`\``)
        .addFields(
          { name: 'Occurrences', value: `${currentError.occurrences}`, inline: true },
          { name: 'Last Occurred', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true }
        )
        .setFooter({ text: 'Immediate attention required!' })
        .setTimestamp();
      await webhookClient
        .send({
          content: `<@&${managementRoleID}> ⚠️ Urgent bot failure detected!`,
          embeds: [webhookEmbed]
        })
        .catch(err => logger.warn(`⚠️ Failed to send webhook alert: ${err.message}`));
      logger.warn('🚨 Sent webhook alert for urgent error.');
    }
  }
};
