const logger = require('../../../utils/essentials/logger');
module.exports = {
  name: 'shardResume',
  once: false,
  async execute(id, replayedEvents) {
    logger.info(`🎯 Shard ${id} Resumed (${replayedEvents} Events Replayed).`);
  }
};
