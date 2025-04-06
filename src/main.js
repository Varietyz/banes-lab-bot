require("dotenv").config();

const { REST } = require("@discordjs/rest");
const { Routes } = require("discord-api-types/v10");
const { server, io } = require("./api/websocket");

const initializeGuildTables = require("./migrations/initializeGuildTables");
const initializeMainTables = require("./migrations/initializeMainTables");
const { loadModules, commands } = require("./moduleLoader");
const gracefulShutdown = require("./modules/events/client/gracefulShutdown");

const logger = require("./modules/utils/essentials/logger");
const loggedIn = require("./modules/events/bot/loggedIn");
const client = require("./modules/discordClient");

const apiPort = process.env.DEV_PORT || process.env.API_PORT;
const discordToken = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

const initializeBot = async () => {
  try {
    await initializeGuildTables();
    await initializeMainTables();

    loadModules("commands", client);
    loadModules("services", client);
    loadModules("events", client);
    loadModules("modals", client);
    client.commands = commands;

    const rest = new REST({ version: "10" }).setToken(discordToken);
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
      body: commands.map((cmd) => cmd.data.toJSON()),
    });

    logger.info("✅ Slash commands registered successfully.");

    await client.login(discordToken).then(() => {
      logger.info("✅ Discord client logged in successfully.");

      // Now the client is logged in, and you can start interacting with it
      server.listen(3001, () => {
        logger.info(`🌐 HTTPS/WebSocket server running on port ${apiPort}`);
        logger.info("✅ Socket.io instance initialized:", !!io);
      });
    });
    loggedIn(client);
  } catch (error) {
    logger.error(
      `🚨 Initialization for port ${apiPort} Failed: ${error.message}`
    );
    process.exit(1);
  }
};

initializeBot();

process.on("SIGINT", () => gracefulShutdown("SIGINT", client));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM", client));
