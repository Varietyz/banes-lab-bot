const logger = require('../essentials/logger');
const { sleep } = require('./sleepUtil');
async function purgeChannel(channel) {
  let messagesToDelete = [];
  try {
    do {
      const fetchedMessages = await channel.messages.fetch({ limit: 100 });
      if (fetchedMessages.size === 0) {
        break;
      }
      messagesToDelete = fetchedMessages;
      await channel.bulkDelete(messagesToDelete, true);
      logger.info(`✅ **Deleted:** \`${messagesToDelete.size}\` messages successfully.`);

      await sleep(1000);
    } while (messagesToDelete.size > 0);
  } catch (error) {
    logger.error(`🚨 **Error:** Failed to delete messages: ${error}`);
    await sleep(2000);
  }
}
module.exports = {
  purgeChannel
};
