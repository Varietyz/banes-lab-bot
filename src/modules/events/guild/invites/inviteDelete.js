const logger = require('../../../utils/essentials/logger');
const { EmbedBuilder } = require('discord.js');
const {
  guild: { getOne }
} = require('../../../utils/essentials/dbUtils');
module.exports = {
  name: 'inviteDelete',
  once: false,
  async execute(invite, client) {
    logger.info(
      `❌ [InviteDelete] Invite deleted in guild: ${invite.guild.name} (Code: ${invite.code})`
    );
    const inviteCreator = invite.inviter ? `<@${invite.inviter.id}>` : '`Unknown`';
    const usesLimit =
      invite.maxUses > 0 ? `**Max Uses:** \`${invite.maxUses}\`` : '♾️ **Unlimited Uses**';
    const expiryDate = invite.expiresAt
      ? `🕛 **Expires:** \`${new Date(invite.expiresAt).toLocaleString()}\``
      : '🔓 **No Expiry**';
    const embed = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle('❌ Invite Deleted')
      .addFields(
        { name: '🔗 Invite Code', value: `\`${invite.code}\``, inline: true },
        { name: '📌 Channel', value: `<#${invite.channel.id}>`, inline: true },
        { name: '\u200b', value: '\u200b', inline: false }, // Spacer
        { name: '👤 Created by', value: inviteCreator, inline: true },
        { name: '\u200b', value: usesLimit, inline: true },
        { name: expiryDate, value: '\u200b', inline: false }
      )
      .setTimestamp();
    const logChannelData = await getOne(
      'SELECT channel_id FROM ensured_channels WHERE channel_key = ?',
      ['invite_logs']
    );
    if (logChannelData) {
      const logChannel = await client.channels.fetch(logChannelData.channel_id);
      if (logChannel) {
        await logChannel.send({ embeds: [embed] });
        logger.info(
          `📋 Logged invite deletion (Code: ${invite.code}, Max Uses: ${invite.maxUses > 0 ? invite.maxUses : 'Unlimited'})`
        );
      }
    }
  }
};
