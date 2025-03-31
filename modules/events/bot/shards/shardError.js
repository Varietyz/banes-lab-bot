const logger = require('../../../utils/essentials/logger');
const { EmbedBuilder } = require('discord.js');
const {
  guild: { getOne }
} = require('../../../utils/essentials/dbUtils');
module.exports = {
  name: 'shardError',
  once: false,
  async execute(error, shardId, client) {
    logger.error(`❌ Shard ${shardId} Error: ${error.message}`);

    const logChannelData = await getOne(
      'SELECT channel_id FROM ensured_channels WHERE channel_key = ?',
      ['bot_logs']
    );
    if (!logChannelData) return;

    const logChannel = await client.channels.fetch(logChannelData.channel_id).catch(() => null);
    if (!logChannel) return;

    const embed = new EmbedBuilder()
      .setColor(0xe74c3c) // Red for errors
      .setTitle('❌ Shard Error')
      .addFields(
        { name: 'Shard ID', value: `${shardId}`, inline: true },
        { name: 'Error', value: `\`\`\`${error.message}\`\`\``, inline: false }
      )
      .setTimestamp();

    await logChannel.send({ embeds: [embed] });
  }
};
