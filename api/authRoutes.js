// routes/authRoutes.js
const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = require("../modules/utils/essentials/dbUtils");
const logger = require("../modules/utils/essentials/logger");
const { v4: uuidv4 } = require("uuid");

const router = express.Router();
const SALT_ROUNDS = 10;

// Handle OPTIONS request explicitly
router.options("/login", (req, res) => {
  res.sendStatus(204); // 204 No Content is typical for preflight
});

router.post("/login", async (req, res) => {
  logger.debug("🔑 POST /api/login request received.");
  const { email, password } = req.body;
  if (!email || !password) {
    logger.warn("❌ Missing email or password.");
    return res
      .status(400)
      .json({ message: "Email and password are required." });
  }

  try {
    // Log query execution attempt
    logger.debug(`Executing query to fetch user by email: ${email}`);
    let result = await db.getOne("SELECT * FROM users WHERE email = ?", [
      email,
    ]);
    logger.debug("Query result for user fetch:", result);

    // If result is an array (shouldn't be with getOne, but checking as precaution)
    if (Array.isArray(result)) result = result[0];

    // Auto-registration – consider separating this in production
    if (!result) {
      logger.info(`🆕 Creating new user for email: ${email}`);
      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
      const userId = uuidv4();

      // Log before inserting new user
      logger.debug(`Inserting new user with ID: ${userId} and email: ${email}`);
      await db.runQuery(
        "INSERT INTO users (user_id, username, email, password_hash) VALUES (?, ?, ?, ?)",
        [userId, email.split("@")[0], email, passwordHash]
      );
      logger.debug("User insertion complete, fetching newly created user");
      result = await db.getOne("SELECT * FROM users WHERE email = ?", [email]);
      logger.debug("Query result after user creation:", result);
      if (Array.isArray(result)) result = result[0];
    }

    if (!result || !result.password_hash) {
      logger.warn(`❌ User not found or invalid for email: ${email}`);
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Validate password
    logger.debug(
      `Comparing provided password with stored hash for user: ${result.username}`
    );
    const valid = await bcrypt.compare(password, result.password_hash);
    if (!valid) {
      logger.warn(`❌ Password mismatch for user: ${result.username}`);
      return res.status(401).json({ message: "Invalid credentials" });
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

    logger.info(`✅ Token issued for user: ${result.username}`);
    res.status(200).json({ token });
  } catch (error) {
    logger.error(`🚨 Login error: ${error.message}`, { error });
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
