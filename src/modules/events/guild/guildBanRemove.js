const { EmbedBuilder, AuditLogEvent } = require('discord.js');
const {
  guild: { getOne }
} = require('../../utils/essentials/dbUtils');
const logger = require('../../utils/essentials/logger');
module.exports = {
  name: 'guildBanRemove',
  once: false,
  async execute(ban) {
    if (!ban || !ban.guild || !ban.user) {
      logger.warn('⚠️ [GuildBanRemove] Missing ban, guild, or user data.');
      return;
    }
    const { guild, user } = ban;
    try {
      logger.info(
        `✅ [GuildBanRemove] ${user.tag} (ID: ${user.id}) was unbanned from guild: ${guild.name}`
      );
      const logChannelData = await getOne(
        'SELECT channel_id FROM ensured_channels WHERE channel_key = ?',
        ['moderation_logs']
      );
      if (!logChannelData) {
        logger.warn('⚠️ No log channel found for "moderation_logs" in database.');
        return;
      }
      const logChannel = await guild.channels.fetch(logChannelData.channel_id).catch(() => null);
      if (!logChannel) {
        logger.warn(`⚠️ Could not fetch log channel ID: ${logChannelData.channel_id}`);
        return;
      }
      logger.info('🔎 Checking audit logs for unban initiator...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      const fetchedLogs = await guild.fetchAuditLogs({
        type: AuditLogEvent.MemberBanRemove,
        limit: 5
      });
      const unbanLog = fetchedLogs.entries.find(
        entry =>
          entry.action === AuditLogEvent.MemberBanRemove &&
          entry.target.id === user.id &&
          Date.now() - entry.createdTimestamp < 10000
      );
      let unbannedBy = '`Unknown`';
      if (unbanLog) {
        unbannedBy = `<@${unbanLog.executor.id}>`;
        logger.info(`🔓 Detected UNBAN by ${unbannedBy}`);
      } else {
        logger.info(`✅ ${user.tag} was unbanned, but no audit log entry was found.`);
      }
      const embed = new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle('🔓 Member Unbanned')
        .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 1024 }))
        .addFields(
          { name: '👤 User', value: `<@${user.id}> (${user.tag})`, inline: false },
          { name: '🛠 Unbanned By', value: unbannedBy, inline: false }
        )
        .setFooter({ text: `User ID: ${user.id}` })
        .setTimestamp();
      await logChannel.send({ embeds: [embed] });
      logger.info(`📋 Successfully logged unban: ${user.tag} (by ${unbannedBy}).`);
    } catch (error) {
      logger.error(`❌ Error logging unban: ${error.message}`);
    }
  }
};
