const { EmbedBuilder, UserFlagsBitField, Events } = require('discord.js');
const {
  guild: { getOne }
} = require('../../utils/essentials/dbUtils');
const logger = require('../../utils/essentials/logger');
module.exports = {
  name: 'guildMemberAdd',
  once: false,
  async execute(member) {
    if (!member.guild) {
      logger.warn('⚠️ [GuildMemberAdd] No guild found for member join event.');
      return;
    }
    logger.info(`⏳ [GuildMemberAdd] ${member.user.tag} joined but is pending onboarding.`);
    const onboardedMember = await waitForOnboarding(member);
    if (!onboardedMember) {
      logger.warn(`❌ [GuildMemberAdd] ${member.user.tag} left before completing onboarding.`);
      return;
    }
    try {
      logger.info(`✅ [Onboarding Complete] ${onboardedMember.user.tag} has entered the server.`);
      const logChannelData = await getOne(
        'SELECT channel_id FROM ensured_channels WHERE channel_key = ?',
        ['member_logs']
      );
      if (!logChannelData) {
        logger.warn('⚠️ No log channel found for "member_logs" in database.');
        return;
      }
      const logChannel = await onboardedMember.guild.channels
        .fetch(logChannelData.channel_id)
        .catch(() => null);
      if (!logChannel) {
        logger.warn(`⚠️ Could not fetch log channel ID: ${logChannelData.channel_id}`);
        return;
      }
      const isBot = onboardedMember.user.bot ? '`🤖 Yes (Bot)`' : '`👤 No (Human)`';
      const createdAt = `<t:${Math.floor(onboardedMember.user.createdTimestamp / 1000)}:R>`;
      const joinedAt = `<t:${Math.floor(onboardedMember.joinedTimestamp / 1000)}:R>`;
      const assignedRoles =
        onboardedMember.roles.cache
          .filter(role => role.id !== onboardedMember.guild.id)
          .map(role => `<@&${role.id}>`)
          .join(', ') || '`None`';
      const badges = getBadges(onboardedMember.user.flags);
      const isFlagged = isUserSuspicious(onboardedMember);
      const nitroStatus = getNitroStatus(onboardedMember);
      const serverBoosts = onboardedMember.premiumSince
        ? `<t:${Math.floor(onboardedMember.premiumSinceTimestamp / 1000)}:R>`
        : '`No Boosts`';
      const accountRisk = isFlagged ? '`🚨 High Risk`' : '`✅ Safe`';
      const embed = new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle('👋 New Member Joined')
        .setThumbnail(onboardedMember.user.displayAvatarURL({ dynamic: true, size: 1024 }))
        .addFields(
          {
            name: '👤 User',
            value: `<@${onboardedMember.id}> (${onboardedMember.user.tag})`,
            inline: false
          },
          { name: '🤖 Is Bot?', value: isBot, inline: true },
          { name: '📅 Account Created', value: createdAt, inline: true },
          { name: '📥 Joined Server', value: joinedAt, inline: true },
          { name: '🏷 Assigned Roles', value: assignedRoles, inline: false },
          { name: '🎭 User Badges', value: badges, inline: true },
          { name: '⚠️ Account Risk', value: accountRisk, inline: true },
          { name: '💎 Nitro Status', value: nitroStatus, inline: true },
          { name: '🚀 Server Boosts', value: serverBoosts, inline: true }
        )
        .setFooter({ text: `User ID: ${onboardedMember.id}` })
        .setTimestamp();
      await logChannel.send({ embeds: [embed] });
      logger.info(`📋 Successfully logged onboarding completion for ${onboardedMember.user.tag}`);
    } catch (error) {
      logger.error(`❌ Error logging member join: ${error.message}`);
    }
  }
};
/**
 *
 * @param member
 */
async function waitForOnboarding(member) {
  if (!member.pending) return member;
  return new Promise(resolve => {
    const timeout = setTimeout(() => resolve(null), 5 * 60 * 1000);
    const updateListener = (oldMember, newMember) => {
      if (newMember.id === member.id && !newMember.pending) {
        clearTimeout(timeout);
        member.guild.client.off(Events.GuildMemberUpdate, updateListener);
        resolve(newMember);
      }
    };
    member.guild.client.on(Events.GuildMemberUpdate, updateListener);
  });
}
/**
 *
 * @param flags
 */
function getBadges(flags) {
  if (!flags || !flags.bitfield) return '`None`';
  const BADGE_EMOJIS = {
    ActiveDeveloper: '🛠️ **Active Developer**',
    BugHunterLevel1: '🐛 **Bug Hunter**',
    BugHunterLevel2: '🐛🔥 **Bug Hunter (Level 2)**',
    CertifiedModerator: '🛡️ **Discord Moderator**',
    HypeSquadOnlineHouse1: '⚡ **HypeSquad Bravery**',
    HypeSquadOnlineHouse2: '🌊 **HypeSquad Brilliance**',
    HypeSquadOnlineHouse3: '🎭 **HypeSquad Balance**',
    HypeSquad: '🎪 **HypeSquad Events**',
    Partner: '🎉 **Discord Partner**',
    PremiumEarlySupporter: '💎 **Early Nitro Supporter**',
    Staff: '👔 **Discord Staff**',
    VerifiedBot: '✅ **Verified Bot**',
    VerifiedDeveloper: '👨‍💻 **Early Bot Developer**'
  };
  try {
    return (
      Object.keys(BADGE_EMOJIS)
        .filter(flag => flags?.has?.(UserFlagsBitField.Flags[flag]))
        .map(flag => BADGE_EMOJIS[flag])
        .join('\n') || '`None`'
    );
  } catch (error) {
    return '`None`';
  }
}
/**
 *
 * @param member
 */
function isUserSuspicious(member) {
  return Date.now() - member.user.createdTimestamp < 7 * 24 * 60 * 60 * 1000;
}
/**
 *
 * @param member
 */
function getNitroStatus(member) {
  if (member.user.avatar && member.user.avatar.startsWith('a_'))
    return '`✨ Nitro (Animated Avatar)`';
  if (member.user.banner) return '`🎨 Nitro (Profile Banner)`';
  return '`🚫 No Nitro`';
}
