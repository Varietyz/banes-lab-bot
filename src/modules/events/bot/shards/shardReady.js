const logger = require('../../../utils/essentials/logger');
module.exports = {
  name: 'shardReady',
  once: false,
  async execute(id) {
    logger.info(`✅ Shard ${id} is Ready.`);
  }
};
