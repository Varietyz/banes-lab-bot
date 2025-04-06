const logger = require('../../utils/essentials/logger');
module.exports = {
  name: 'debug',
  once: false,
  async execute(info) {
    if (/\[WS\s*=>\s*Shard\s*\d+\]/i.test(info) && /heartbeat/i.test(info)) {
      return;
    }
    logger.debug(`🐞 Debug Info: ${info}`);
  }
};
