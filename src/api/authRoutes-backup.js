// routes/authRoutes.js
const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = require("../modules/utils/essentials/dbUtils");
const logger = require("../modules/utils/essentials/logger");
const { v4: uuidv4 } = require("uuid");
const createDiscordChannelForUser = require("../modules/services/webUtils/createChannelForUser");
const crypto = require("crypto");

const router = express.Router();
const SALT_ROUNDS = 10;

// Hash the IP address for privacy
function hashIP(ip) {
  return crypto.createHash("sha256").update(ip).digest("hex");
}

// Handle OPTIONS request explicitly
router.options("/login", (req, res) => {
  res.sendStatus(204); // 204 No Content is typical for preflight
});

router.post("/login", async (req, res) => {
  logger.debug("🔑 POST /api/login request received.");
  const { email, password } = req.body;
  const ip = req.headers["x-forwarded-for"]?.split(",")[0].trim() || req.ip;

  const hashedIP = hashIP(ip);

  if (!email || !password) {
    logger.warn("❌ Missing email or password.");
    return res
      .status(400)
      .json({ message: "Email and password are required." });
  }

  try {
    logger.debug(`Executing query to fetch user by email: ${email}`);
    let result = await db.getOne("SELECT * FROM users WHERE email = ?", [
      email,
    ]);
    logger.debug("Query result for user fetch:", result);

    if (Array.isArray(result)) result = result[0];

    let isNewUser = false;

    // Auto-registration
    if (!result) {
      const existingUser = await db.getOne(
        "SELECT email FROM users WHERE ip_hash = ?",
        [hashedIP]
      );

      if (existingUser) {
        const maskedEmail = existingUser.email.replace(
          /^(.{4})(.*)(@.*)$/,
          (match, p1, p2, p3) => {
            return p1 + "*".repeat(p2.length) + p3;
          }
        );

        return res.status(400).json({
          message: `You have already created an account: ${maskedEmail}`,
        });
      }

      isNewUser = true;
      logger.info(`🆕 Creating new user for email: ${email}`);
      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
      const userId = uuidv4();

      // Log before inserting new user
      logger.debug(`Inserting new user with ID: ${userId} and email: ${email}`);
      await db.runQuery(
        "INSERT INTO users (user_id, username, email, password_hash, ip_hash) VALUES (?, ?, ?, ?, ?)",
        [userId, email.split("@")[0], email, passwordHash, hashedIP]
      );
      logger.debug("User insertion complete, fetching newly created user");
      result = await db.getOne("SELECT * FROM users WHERE email = ?", [email]);
      logger.debug("Query result after user creation:", result);
      if (Array.isArray(result)) result = result[0];
    }

    if (!result || !result.password_hash) {
      logger.warn(`❌ User not found or invalid for email: ${email}`);
      return res
        .status(401)
        .json({ message: "❌ User not found or invalid for email" });
    }

    // Validate password
    logger.debug(
      `Comparing provided password with stored hash for user: ${result.username}`
    );
    const valid = await bcrypt.compare(password, result.password_hash);
    if (!valid) {
      logger.warn(`❌ Password mismatch for user: ${result.username}`);
      return res.status(401).json({ message: "❌ Password mismatch" });
    }

    // Issue JWT token
    logger.debug(`Password match for user: ${result.username}. Issuing token.`);
    const token = jwt.sign(
      {
        userId: result.user_id,
        username: result.username,
        email: result.email,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    // Set cookie with proper domain for subdomain sharing
    res.cookie("token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "None",
      domain: process.env.COOKIE_DOMAIN || ".banes-lab.com",
    });

    logger.info(
      `✅ Token issued for user: ${result.username} (userId: ${result.user_id})`
    );

    let channel = await db.getOne(
      "SELECT channel_id FROM user_channels WHERE email = ?",
      [email]
    );

    if (!channel) {
      logger.debug(`Creating Discord channel for user ${email}`);
      const newChannel = await createDiscordChannelForUser(email);

      if (newChannel && newChannel.id) {
        await db.runQuery(
          "INSERT INTO user_channels (user_id, email, channel_id) VALUES (?, ?, ?)",
          [result.user_id, email, newChannel.id]
        );
        channel = { channel_id: newChannel.id };
      }
    }

    res.status(200).json({
      token,
      userId: result.user_id,
      channelId: channel.channel_id,
      accountConfirmed: !isNewUser,
    });
  } catch (error) {
    logger.error(`🚨 Login error: ${error.message}`, { error });
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
