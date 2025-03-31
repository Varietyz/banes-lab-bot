const { Client, GatewayIntentBits, Partials } = require("discord.js");
const fs = require("fs");
const path = require("path");
require("dotenv").config();
const logger = require("./modules/utils/essentials/logger");
const { registerModal } = require("./modules/utils/essentials/modalHandler");
const { REST } = require("@discordjs/rest");
const { Routes } = require("discord-api-types/v10");
const {
  closeDatabases,
  cancelAllDbOperations,
  getOne,
} = require("./modules/utils/essentials/dbUtils");
const globalState = require("./config/globalState");

const initializeGuildTables = require("./migrations/initializeGuildTables");
const initializeMainTables = require("./migrations/initializeMainTables");

const jwt = require("jsonwebtoken");

const express = require("express");
const { Server } = require("socket.io");
const authRoutes = require("./api/authRoutes");
const cors = require("cors");
const https = require("https");

const app = express();

const allowedOrigins = [
  "https://banes-lab.com",
  "https://ws.banes-lab.com",
  "http://localhost:3001",
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};

// **Apply CORS middleware first**
app.use(cors(corsOptions));
app.options("*", cors(corsOptions)); // Preflight handler

// Logging middleware
app.use((req, res, next) => {
  logger.info(`Incoming request: ${req.method} ${req.originalUrl}`);
  next();
});

// Now use the JSON parser and mount your routes
app.use(express.json());
app.use("/api", authRoutes);

logger.info(`CORS configured for origins: ${allowedOrigins.join(", ")}`);

// Load SSL certificates and log their source paths
const privateKeyPath = "/etc/letsencrypt/live/bot.banes-lab.com/privkey.pem";
const certificatePath = "/etc/letsencrypt/live/bot.banes-lab.com/fullchain.pem";
const privateKey = fs.readFileSync(privateKeyPath, "utf8");
const certificate = fs.readFileSync(certificatePath, "utf8");
const credentials = { key: privateKey, cert: certificate };
logger.info(
  `SSL certificates loaded: private key from ${privateKeyPath}, certificate from ${certificatePath}`
);

// Create HTTPS server using Express app
const server = https.createServer(credentials, app);

// Set up Socket.IO with detailed logging of connection info
const io = new Server(server, {
  cors: {
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  },
});
global._io = io;

// Simple cookie parser function
function parseCookies(cookieHeader) {
  const list = {};
  if (!cookieHeader) return list;
  cookieHeader.split(";").forEach((cookie) => {
    const parts = cookie.split("=");
    list[parts.shift().trim()] = decodeURI(parts.join("="));
  });
  return list;
}

io.on("connection", (socket) => {
  // Log entire handshake headers for debugging
  logger.info(`Handshake headers: ${JSON.stringify(socket.handshake.headers)}`);

  // Extract the token from the cookie header and store user details on the socket
  let userEmail = null;
  let userId = null;
  const cookiesHeader = socket.handshake.headers.cookie;
  logger.info(`Handshake cookies: ${cookiesHeader}`);
  if (cookiesHeader) {
    const parsedCookies = parseCookies(cookiesHeader);
    logger.info(`Parsed cookies: ${JSON.stringify(parsedCookies)}`);
    if (parsedCookies.token) {
      try {
        const payload = jwt.verify(parsedCookies.token, process.env.JWT_SECRET);
        userEmail = payload.email; // Optional, if you need it for logging
        userId = payload.userId;
      } catch (err) {
        logger.error("Token verification failed for socket:", err.message);
      }
    } else {
      logger.warn("No token found in parsed cookies.");
    }
  } else {
    logger.warn("No cookie header present in the handshake.");
  }
  // Store userId (and email if desired) on the socket for later use
  socket.userId = userId;
  socket.userEmail = userEmail;

  logger.info(
    `Socket connected: ID ${socket.id}, userId: ${userId}, email: ${userEmail}, remote IP: ${socket.handshake.address}`
  );

  // Update sendMessage handler to query DB for the registered email.
  socket.on("sendMessage", async ({ content, channelId }) => {
    let email = null;
    // Use the stored userId to query the database for the registered email.
    if (socket.userId) {
      try {
        const userRecord = await getOne(
          "SELECT email FROM users WHERE user_id = ?",
          [socket.userId]
        );
        // userRecord might be an object containing the email field.
        email = userRecord ? userRecord.email : null;
        logger.info(
          `Queried email from DB for userId ${socket.userId}: ${email}`
        );
      } catch (err) {
        logger.error(
          `Error querying email for userId ${socket.userId}: ${err.message}`
        );
      }
    } else {
      logger.warn("Socket does not have a userId. Cannot query email.");
    }

    // Append the email to the message if available.
    const messageWithEmail = email ? `${content} (sent by ${email})` : content;

    // Fetch and send the message to the desired channel.
    try {
      const channel = await client.channels.fetch(channelId);
      if (channel) {
        channel.send(messageWithEmail);
        logger.info(
          `Message sent to channel ${channelId} from socket ${socket.id} with email: ${email}`
        );
      } else {
        logger.error(
          `Channel ${channelId} not found for message from socket ${socket.id}`
        );
      }
    } catch (err) {
      logger.error(`Error sending message: ${err.message}`);
    }
  });

  socket.on("disconnect", () => {
    logger.info(`Socket disconnected: ID ${socket.id}`);
  });
});

const apiPort = 8040;
logger.info(`WebSocket server will run on port ${apiPort}`);

// Load modules with additional logging of file paths and types
const commands = [];
const functions = [];
const loadModules = (type, client) => {
  const folderPath = path.join(__dirname, `modules/${type}`);
  logger.info(`Loading modules of type '${type}' from ${folderPath}`);
  const loadedModules = [];
  const traverseDirectory = (currentPath) => {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        traverseDirectory(fullPath);
      } else if (entry.isFile() && entry.name.endsWith(".js")) {
        try {
          const module = require(fullPath);
          if (type === "commands") {
            if (!module.data || !module.data.description || !module.execute) {
              logger.error(
                `❌ Error: Invalid command in ${entry.name}. Missing 'description' or 'execute'.`
              );
              continue;
            }
            commands.push(module);
            logger.info(
              `✅ Loaded Command: ${module.data.name} from ${fullPath}`
            );
          } else if (type === "services") {
            functions.push(module);
            logger.info(
              `✅ Loaded Service: ${path.basename(entry.name, ".js")}`
            );
          } else if (type === "events") {
            if (!module.name) {
              logger.warn(
                `⚠️ Skipping event file ${entry.name} - missing event name.`
              );
              continue;
            }
            if (module.once) {
              client.once(module.name, (...args) =>
                module.execute(...args, client)
              );
            } else {
              client.on(module.name, (...args) =>
                module.execute(...args, client)
              );
            }
            logger.info(`✅ Loaded Event: ${module.name}`);
          } else if (type === "modals") {
            if (!module.modalId || !module.execute) {
              logger.warn(
                `⚠️ Skipping modal file ${entry.name} - missing modalId or execute function.`
              );
              continue;
            }
            registerModal(module.modalId, module.execute);
            logger.info(`✅ Registered Modal: ${module.modalId}`);
          }
          loadedModules.push(module);
        } catch (err) {
          logger.error(
            `❌ Error: Failed to load ${type} module from ${fullPath}: ${err.message}`
          );
        }
      }
    }
  };
  traverseDirectory(folderPath);
  return loadedModules;
};

const client = new Client({
  intents: [
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
    GatewayIntentBits.GuildMessagePolls,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [
    Partials.Message,
    Partials.Reaction,
    Partials.User,
    Partials.Channel,
  ],
});

const initializeBot = async () => {
  try {
    await initializeGuildTables();
    await initializeMainTables();
    // Optionally, also call your auth migration if not already in initializeMainTables
    // await require('./migrations/initializeAuthTables')();

    loadModules("commands", client);
    loadModules("services", client);
    loadModules("events", client);
    loadModules("modals", client);
    client.commands = commands;

    const rest = new REST({ version: "10" }).setToken(
      process.env.DISCORD_TOKEN
    );
    await rest.put(
      Routes.applicationGuildCommands(
        process.env.CLIENT_ID,
        process.env.GUILD_ID
      ),
      { body: commands.map((cmd) => cmd.data.toJSON()) }
    );
    logger.info("✅ Slash commands registered successfully.");

    await client.login(process.env.DISCORD_TOKEN);
    logger.info("✅ Bot logged in successfully.");

    server.listen(apiPort, () => {
      logger.info(`🌐 HTTPS/WebSocket server running on port ${apiPort}`);
      logger.info("✅ Socket.io instance initialized:", !!io);
    });
  } catch (error) {
    logger.error(
      `🚨 Initialization for port ${apiPort} Failed: ${error.message}`
    );
    process.exit(1);
  }
};

initializeBot();

async function gracefulShutdown(signal) {
  logger.info(`Received ${signal}. Initiating graceful shutdown...`);
  globalState.isShuttingDown = true;
  try {
    client.removeAllListeners();
    cancelAllDbOperations();
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await closeDatabases();
    await client.destroy();
    logger.info("Shutdown complete. Exiting now.");
    process.exit(0);
  } catch (error) {
    logger.error(`Error during shutdown: ${error.message}`);
    process.exit(1);
  }
}

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

module.exports = client;
