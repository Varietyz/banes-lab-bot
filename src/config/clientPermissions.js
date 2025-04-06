const { GatewayIntentBits, Partials } = require("discord.js");

const intents = [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildWebhooks,
  GatewayIntentBits.AutoModerationConfiguration,
  GatewayIntentBits.AutoModerationExecution,
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.MessageContent,
  GatewayIntentBits.GuildMembers,
  GatewayIntentBits.GuildMessageReactions,
  GatewayIntentBits.GuildVoiceStates,
  GatewayIntentBits.GuildModeration,
  GatewayIntentBits.GuildInvites,
  GatewayIntentBits.GuildExpressions,
  GatewayIntentBits.GuildIntegrations,
  GatewayIntentBits.GuildModeration,
  GatewayIntentBits.DirectMessages,
];

const partials = [
  Partials.Message,
  Partials.Reaction,
  Partials.User,
  Partials.Channel,
];

module.exports = { intents, partials };
