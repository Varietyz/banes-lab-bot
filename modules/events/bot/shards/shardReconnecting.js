const logger = require('../../../utils/essentials/logger');
module.exports = {
  name: 'shardReconnecting',
  once: false,
  async execute(id) {
    logger.warn(`🔄 Shard ${id} is Reconnecting...`);
  }
};
