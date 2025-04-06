// modules/discordClient.js
const { Client } = require("discord.js");
const { intents, partials } = require("../config/clientPermissions");
const logger = require("./utils/essentials/logger");

const client = new Client({
  intents,
  partials,
});
logger.info(`✅ Collecting Discord client Permissions`);

module.exports = client;
