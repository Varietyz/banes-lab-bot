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
const createDiscordChannelForUser = require("../modules/services/webUtils/createChannelForUser");
const dbUtils = require("../modules/utils/essentials/dbUtils");
const { v4: uuidv4 } = require("uuid");
const cookie = require("cookie");

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
  transports: ["websocket"],
});

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
  // Emit server version info as before
  socket.emit("serverInfo", { version: SERVER_VERSION });
  logger.info(`📡[${SERVER_VERSION}] Socket connected: ${socket.id} `);

  // Parse token from handshake cookies
  let token;
  if (socket.handshake.headers.cookie) {
    const cookies = cookie.parse(socket.handshake.headers.cookie);
    token = cookies.token;
  }

  if (!token) {
    logger.warn(
      `Socket ${socket.id} not authenticated: no token found in cookies.`
    );
    socket.emit("tokenExpired", {
      message: "No token provided, please log in again.",
    });
    socket.disconnect();
    return;
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const userId = payload.userId;
    socket.userId = userId;
    logger.info(`🔐 Authenticated socket ${socket.id} for user ${userId}`);

    // Session management (create/update session record)
    const sessionId = uuidv4();
    const createdAt = Math.floor(Date.now() / 1000);
    const expiresAt = createdAt + 3600;

    const existingSession = await dbUtils.getOne(
      "SELECT * FROM user_sessions WHERE token = ?",
      [token]
    );

    if (existingSession) {
      await dbUtils.runQuery(
        "UPDATE user_sessions SET session_id = ? WHERE token = ?",
        [sessionId, token]
      );
      logger.info(`🔄 Updated session for token ${token} for user ${userId}`);
    } else {
      const userRecord = await getOne(
        "SELECT ip_hash FROM users WHERE user_id = ?",
        [userId]
      );
      const ipHash = userRecord?.ip_hash || "";
      await dbUtils.runQuery(
        `INSERT INTO user_sessions (session_id, user_id, token, ip_hash, created_at, expires_at)
   VALUES (?, ?, ?, ?, ?, ?)
   ON CONFLICT(token) DO UPDATE SET
     session_id = excluded.session_id,
     created_at = excluded.created_at,
     expires_at = excluded.expires_at`,
        [sessionId, userId, token, ipHash, createdAt, expiresAt]
      );
      logger.info(
        `🌐 Session ${sessionId} for ${userId} with token ${token} created at ${createdAt} and ends on ${expiresAt}`
      );
    }

    // Bind socket to the user’s channel
    if (userId) {
      let userChannel = await getOne(
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
        logger.warn(
          `⚠️ No channel found for user ${userId}. Creating new channel...`
        );
        const userRecord = await getOne(
          "SELECT email FROM users WHERE user_id = ?",
          [userId]
        );
        if (userRecord?.email) {
          const newChannel = await createDiscordChannelForUser(
            userRecord.email
          );
          if (newChannel && newChannel.id) {
            await dbUtils.runQuery(
              "INSERT INTO user_channels (user_id, email, channel_id, ip_hash) VALUES (?, ?, ?, ?)",
              [
                userId,
                userRecord.email.toLowerCase(),
                newChannel.id,
                userRecord.ip_hash || "",
              ]
            );
            socket.channelId = newChannel.id;
            socket.join(socket.channelId);
            logger.info(
              `🔗 New channel ${socket.channelId} created and bound to socket ${socket.id} for user ${userId}`
            );
          } else {
            logger.error(
              `❌ Failed to create Discord channel for user ${userId}`
            );
          }
        } else {
          logger.error(
            `❌ User record not found for user ${userId} to create channel`
          );
          socket.emit("userNotFound", { message: "User not found" });
        }
      }
    }

    // Fetch historical messages if channel is set
    if (socket.channelId) {
      try {
        const discordChannel = await client.channels.fetch(socket.channelId);
        if (discordChannel) {
          const fetchedMessages = await discordChannel.messages.fetch({
            limit: 20,
          });
          const history = fetchedMessages
            .map((msg) => ({
              author: msg.author.bot ? "You" : msg.author.username,
              content: msg.author.bot
                ? filterBotMessageContent(msg.content || "")
                : msg.content,
              timestamp: msg.createdAt.toLocaleString(),
              channelId: socket.channelId,
            }))
            .reverse();
          socket.emit("historicalMessages", history);
          logger.info(
            `📜 Sent history to socket ${socket.id} for channel ${socket.channelId}`
          );
        }
      } catch (err) {
        logger.error(`❌ Failed to fetch message history: ${err.message}`);
        // Optional: Handle error by recreating the channel if necessary
      }
    }
  } catch (err) {
    logger.error("🚫 Token verification failed:", err.message);
    socket.emit("tokenExpired", {
      message: "Invalid or expired token, please log in again.",
    });
    socket.disconnect();
    return;
  }

  socket.on("sendMessage", async ({ content }) => {
    let channelId = socket.channelId;
    if (!channelId) {
      // Attempt fallback to default channel if necessary
      channelId = BigInt("1356688841536442398");
      logger.warn(`⚠️ Falling back to default channelId ${channelId}`);
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
        socket.emit("channelNotFound", {
          message: "Discord channel not found",
        });
        return;
      }
      await discordChannel.send(formattedMessage);
      logger.info(
        `✅ Message from ${email} sent to Discord channel ${channelId}`
      );
    } catch (err) {
      logger.error(`❌ Error sending to Discord: ${err.message}`);
      if (
        err.message.includes("Unknown Channel") ||
        err.message.includes("not found")
      ) {
        socket.emit("channelNotFound", {
          message: "Discord channel not found",
        });
      }
    }
  });

  socket.on("disconnect", () => {
    logger.info(`🔌 Socket disconnected: ${socket.id}`);
  });
});

logger.info("✅ WebSocket server setup complete.");
module.exports = { server, io };
