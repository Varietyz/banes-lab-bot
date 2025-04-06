const logger = require('../../utils/essentials/logger');
const dbUtils = require('../../utils/essentials/dbUtils');
const tasks = require('../../../tasks');
module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    logger.info(`✅ Online: ${client.user.tag} is now online! 🎉`);
    dbUtils.setClient(client);
    for (const task of tasks) {
      if (task.runOnStart) {
        logger.info(`⏳ Running startup task: ${task.name}`);
        try {
          await task.func(client);
        } catch (err) {
          logger.error(`🚨 Startup task error (${task.name}): ${err}`);
        }
      }
    }
    tasks.forEach(task => {
      if (task.runAsTask) {
        const hours = Math.floor(task.interval / 3600);
        const minutes = Math.floor((task.interval % 3600) / 60);
        const intervalFormatted = `${hours > 0 ? `${hours}h ` : ''}${minutes}m`;
        logger.info(`⏳ Scheduled task: ${task.name} every ${intervalFormatted}.`);
        setInterval(async () => {
          logger.info(`⏳ Executing scheduled task: ${task.name}...`);
          try {
            await task.func(client);
          } catch (err) {
            logger.error(`🚨 Task error (${task.name}): ${err}`);
          }
        }, task.interval * 1000);
      }
    });
  }
};
