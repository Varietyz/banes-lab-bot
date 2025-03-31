const logger = require('../../../utils/essentials/logger');
const { EmbedBuilder } = require('discord.js');
const {
  guild: { getOne }
} = require('../../../utils/essentials/dbUtils');
module.exports = {
  name: 'inviteCreate',
  once: false,
  async execute(invite, client) {
    logger.info(
      `🔗 [InviteCreate] New invite created in guild: ${invite.guild.name} (Code: ${invite.code})`
    );
    const INVITE_URL = `https://discord.gg/${invite.code}`;
    const inviteCreator = invite.inviter ? `<@${invite.inviter.id}>` : '`Unknown`';
    const expiryDate = invite.expiresAt
      ? `🕛 **Expires:** \`${new Date(invite.expiresAt).toLocaleString()}\``
      : '🔓 **No Expiry**';
    const usesLimit =
      invite.maxUses > 0 ? `**Max Uses:** \`${invite.maxUses}\`` : '♾️ **Unlimited Uses**';
    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle('🎉 New Invite Created!')
      .addFields(
        { name: '🔗 Invite Code', value: `${INVITE_URL}`, inline: true },
        { name: '\u200b', value: usesLimit, inline: true },
        { name: expiryDate, value: '\u200b', inline: false },
        { name: '📌 Channel', value: `<#${invite.channel.id}>`, inline: true },
        { name: '\u200b', value: '\u200b', inline: true },
        { name: '👤 Created by', value: inviteCreator, inline: true }
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
          `📋 Logged invite creation (Code: ${invite.code}, Max Uses: ${invite.maxUses > 0 ? invite.maxUses : 'Unlimited'})`
        );
      }
    }
  }
};
