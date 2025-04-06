const logger = require('../../utils/essentials/logger');
module.exports = {
  name: 'raw',
  async execute(packet, client) {
    const supportedEvents = ['MESSAGE_UPDATE'];
    if (!supportedEvents.includes(packet.t)) return;
    try {
      const { d: data } = packet;
      if (['MESSAGE_UPDATE'].includes(packet.t) && !data.message_id) {
        return;
      }
      const channel = await client.channels.fetch(data.channel_id);
      if (!channel || !channel.isTextBased()) return;
      let message = null;
      if (data.message_id) {
        message = await channel.messages.fetch(data.message_id).catch(() => null);
        if (!message) {
          return;
        }
      }
      if (packet.t === 'MESSAGE_UPDATE') {
        client.emit('messageUpdate', null, message, client);
      }
    } catch (error) {
      logger.error('❌ Error processing raw event:', error);
    }
  }
};
