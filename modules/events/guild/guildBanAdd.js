const { EmbedBuilder, AuditLogEvent } = require('discord.js');
const {
  guild: { getOne }
} = require('../../utils/essentials/dbUtils');
const logger = require('../../utils/essentials/logger');
const recentBans = new Set();
module.exports = {
  name: 'guildBanAdd',
  once: false,
  async execute(ban) {
    const { guild, user } = ban;
    if (!guild) {
      logger.warn('⚠️ [GuildBanAdd] No guild found for ban event.');
      return;
    }
    try {
      logger.info(
        `🚨 [GuildBanAdd] ${user.tag} (ID: ${user.id}) was banned from guild: ${guild.name}`
      );
      recentBans.add(user.id);
      setTimeout(() => recentBans.delete(user.id), 10000);
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
      logger.info('🔎 Checking audit logs for ban initiator...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      const fetchedLogs = await guild.fetchAuditLogs({
        type: AuditLogEvent.MemberBanAdd,
        limit: 5
      });
      const banLog = fetchedLogs.entries.find(
        entry =>
          entry.action === AuditLogEvent.MemberBanAdd &&
          entry.target.id === user.id &&
          Date.now() - entry.createdTimestamp < 10000
      );
      let bannedBy = '`Unknown`';
      let reason = '`No reason provided`';
      if (banLog) {
        bannedBy = `<@${banLog.executor.id}>`;
        reason = banLog.reason ? `\`${banLog.reason}\`` : '`No reason provided`';
        logger.info(`🔨 Detected BAN by ${bannedBy} for reason: ${reason}`);
      } else {
        logger.info(`🚨 ${user.tag} was banned, but no audit log entry was found.`);
      }
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('🔨 Member Banned')
        .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 1024 }))
        .addFields(
          { name: '👤 User', value: `<@${user.id}> (${user.tag})`, inline: false },
          { name: '🛠 Banned By', value: bannedBy, inline: true },
          { name: '📝 Reason', value: reason, inline: false }
        )
        .setFooter({ text: `User ID: ${user.id}` })
        .setTimestamp();
      await logChannel.send({ embeds: [embed] });
      logger.info(`📋 Successfully logged ban: ${user.tag} (by ${bannedBy}).`);
    } catch (error) {
      logger.error(`❌ Error logging ban: ${error.message}`);
    }
  }
};
module.exports.recentBans = recentBans;
