const logger = require('../../../utils/essentials/logger');
const { EmbedBuilder } = require('discord.js');
const {
  guild: { getOne }
} = require('../../../utils/essentials/dbUtils');
module.exports = {
  name: 'shardDisconnect',
  once: false,
  async execute(event, id, client) {
    logger.warn(`🔌 Shard ${id} Disconnected.`);

    const logChannelData = await getOne(
      'SELECT channel_id FROM ensured_channels WHERE channel_key = ?',
      ['bot_logs']
    );
    if (!logChannelData) return;

    const logChannel = await client.channels.fetch(logChannelData.channel_id).catch(() => null);
    if (!logChannel) return;

    const embed = new EmbedBuilder()
      .setColor(0xe74c3c) // Red for shard disconnection
      .setTitle('🔌 Shard Disconnected')
      .setDescription(`Shard **${id}** has disconnected from Discord.`)
      .setTimestamp();

    await logChannel.send({ embeds: [embed] });
  }
};
