require("dotenv").config();
const { Server } = require("socket.io");
const https = require("https");
const allowedOrigins = require("./allowedOrigins");
const credentials = require("./appCredentials");
const app = require("./app");
const logger = require("../modules/utils/essentials/logger");
const jwt = require("jsonwebtoken");
const { getOne } = require("../modules/utils/essentials/dbUtils");
const client = require("../modules/discordClient");

const server = https.createServer(credentials, app);
const SERVER_VERSION = new Date().toISOString();
logger.info(`🌐 Server version: ${SERVER_VERSION}`);

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

function parseCookies(cookieHeader) {
  return cookieHeader.split(";").reduce((cookies, cookie) => {
    const [name, ...rest] = cookie.split("=");
    cookies[name.trim()] = decodeURIComponent(rest.join("=").trim());
    return cookies;
  }, {});
}

/**
 * Filters the email prefix from bot message content.
 * @param {string} content - The original message content.
 * @returns {string} - The filtered content.
 */
function filterBotMessageContent(content) {
  // Regex to match the email prefix at the beginning of the content
  const emailRegex = /^\*\*`🌐\s[^`]+`\*\*\s*/;
  // Only filter if the pattern is present at the start
  if (emailRegex.test(content)) {
    return content.replace(emailRegex, "");
  }
  return content;
}

io.on("connection", async (socket) => {
  socket.emit("serverInfo", { version: SERVER_VERSION });
  logger.info(`📡[${SERVER_VERSION}] Socket connected: ${socket.id} `);

  let userId = null;

  socket.on("authenticate", async ({ token }) => {
    // ✅ Listener is defined regardless of cookie presence
    if (token) {
      try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        userId = payload.userId;
        socket.userId = userId;
        logger.info(`🔐 Authenticated socket ${socket.id} for user ${userId}`);

        // 🔗 Link socket to the channel they’re allowed to view
        if (userId) {
          try {
            const userChannel = await getOne(
              "SELECT channel_id FROM user_channels WHERE user_id = ?",
              [userId]
            );

            if (userChannel?.channel_id) {
              socket.channelId = userChannel.channel_id;
              socket.join(socket.channelId);
              logger.info(
                `🔗 Socket ${socket.id} bound to channel ${socket.channelId}`
              );
            } else {
              logger.warn(`⚠️ No channel found for user ${userId}`);
            }
          } catch (err) {
            logger.error(
              `❌ DB error retrieving channel for ${userId}: ${err.message}`
            );
          }
        }

        // After socket.channelId is set
        if (socket.channelId) {
          try {
            const discordChannel = await client.channels.fetch(
              socket.channelId
            );
            if (discordChannel) {
              const fetchedMessages = await discordChannel.messages.fetch({
                limit: 20,
              }); // adjust as needed

              const history = fetchedMessages
                .map((msg) => ({
                  author: msg.author.bot ? "You" : msg.author.username,
                  content: msg.author.bot
                    ? filterBotMessageContent(msg.content || "")
                    : msg.content,
                  timestamp: msg.createdAt.toLocaleString(),
                  channelId: socket.channelId,
                }))
                .reverse(); // chronological order

              socket.emit("historicalMessages", history);
              logger.info(
                `📜 Sent history to socket ${socket.id} for channel ${socket.channelId}`
              );
            }
          } catch (err) {
            logger.error(`❌ Failed to fetch message history: ${err.message}`);
          }
        }
      } catch (err) {
        if (err.name === "TokenExpiredError") {
          logger.warn("⏳ Token expired, forcing user to log in again.");
          socket.emit("tokenExpired", {
            message: "Session expired, please log in again.",
          });
        } else {
          logger.error("🚫 Token verification failed:", err.message);
        }
      }
    }
  });

  socket.on("sendMessage", async ({ content }) => {
    let channelId = socket.channelId;
    if (!channelId) {
      // Check for fallback email in cookies
      const cookieHeader = socket.handshake.headers.cookie;
      if (cookieHeader) {
        const cookies = parseCookies(cookieHeader);
        if (cookies.fallbackEmail) {
          try {
            const userChannel = await getOne(
              "SELECT channel_id FROM user_channels WHERE email = ?",
              [cookies.fallbackEmail]
            );
            if (userChannel?.channel_id) {
              channelId = userChannel.channel_id;
              logger.info(
                `ℹ️ Fallback channel resolved from cookie: ${channelId}`
              );
            }
          } catch (err) {
            logger.error(
              `❌ Error fetching channel for fallback email ${cookies.fallbackEmail}: ${err.message}`
            );
          }
        }
      }

      // Final fallback if channelId is still not set
      if (!channelId) {
        channelId = BigInt("1356688841536442398");
        logger.warn(`⚠️ Falling back to default channelId ${channelId}`);
      }
    }

    if (!channelId) {
      logger.warn(
        `❌ Cannot send message — socket ${socket.id} has no linked channel.`
      );
      return;
    }

    let email = null;
    try {
      const user = await getOne("SELECT email FROM users WHERE user_id = ?", [
        socket.userId,
      ]);
      email = user?.email || "unknown@user";
    } catch (err) {
      logger.error(
        `❌ Failed to fetch email for user ${socket.userId}: ${err.message}`
      );
    }

    if (email === "unknown@user" && channelId) {
      try {
        const fallback = await getOne(
          "SELECT email FROM user_channels WHERE channel_id = ?",
          [channelId]
        );
        email = fallback?.email || "unknown@user";
      } catch (err) {
        logger.error(
          `❌ Failed to fetch email from user_channels for channel ${channelId}: ${err.message}`
        );
        email = "unknown@user";
      }
    }

    const formattedMessage = `**\`🌐 ${email}\`** ${content}`;

    try {
      const discordChannel = await client.channels.fetch(channelId);
      if (!discordChannel) {
        logger.error(`❌ Discord channel not found: ${channelId}`);
        return;
      }

      await discordChannel.send(formattedMessage);
      logger.info(
        `✅ Message from ${email} sent to Discord channel ${channelId}`
      );
    } catch (err) {
      logger.error(`❌ Error sending to Discord: ${err.message}`);
    }
  });

  socket.on("disconnect", () => {
    logger.info(`🔌 Socket disconnected: ${socket.id}`);
  });
});

logger.info("✅ WebSocket server setup complete.");
module.exports = { server, io };
