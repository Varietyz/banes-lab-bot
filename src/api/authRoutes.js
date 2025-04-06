// routes/authRoutes.js
const express = require("express");
const passport = require("passport");
const jwt = require("jsonwebtoken");
const db = require("../modules/utils/essentials/dbUtils");
const logger = require("../modules/utils/essentials/logger");
const createDiscordChannelForUser = require("../modules/services/webUtils/createChannelForUser");
const crypto = require("crypto");

const router = express.Router();

const DISCORD_REDIRECT = "https://ws.banes-lab.com/api/auth/discord/callback";
const GOOGLE_REDIRECT = "https://ws.banes-lab.com/api/auth/google/callback";
const GITHUB_REDIRECT = "https://ws.banes-lab.com/api/auth/github/callback";

// Utility: Hash IP address for privacy
function hashIP(ip) {
  return crypto.createHash("sha256").update(ip).digest("hex");
}

// Create token and save user if new. Incorporates IP hash.
const createTokenAndSaveUser = async (userId, username, email, ipHash) => {
  const token = jwt.sign({ userId, username, email }, process.env.JWT_SECRET, {
    expiresIn: "1h",
  });

  let existingUser = await db.getOne("SELECT * FROM users WHERE user_id = ?", [
    userId,
  ]);
  if (Array.isArray(existingUser)) existingUser = existingUser[0];
  if (!existingUser) {
    // Create new user record with a generated UUID and store the IP hash.
    await db.runQuery(
      "INSERT INTO users (user_id, username, email, password_hash, ip_hash) VALUES (?, ?, ?, ?, ?)",
      [userId, username, email.toLowerCase(), "OAuthAccount", ipHash]
    );
  }
  return token;
};

router.get("/checkAuth", (req, res) => {
  // Ensure you have cookie-parser middleware enabled in your app
  const token = req.cookies?.token;

  if (!token) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    res.json({ message: "Authenticated", user: payload });
  } catch {
    res.status(401).json({ message: "Invalid or expired token" });
  }
});

// Allow OPTIONS for preflight
router.options("/*", (req, res) => {
  res.sendStatus(204);
});

// Configure OAuth strategies with passReqToCallback enabled

// Discord Strategy
const DiscordStrategy = require("passport-discord").Strategy;
passport.use(
  new DiscordStrategy(
    {
      clientID: process.env.DISCORD_CLIENT_ID,
      clientSecret: process.env.DISCORD_CLIENT_SECRET,
      callbackURL: DISCORD_REDIRECT,
      scope: ["identify", "email", "guilds"],
      passReqToCallback: true,
    },
    async (req, _accessToken, _refreshToken, profile, done) => {
      try {
        const userId = profile.id;
        const email = profile.email || `ID: ${userId}`;
        const username = profile.username;
        const ip =
          req.headers["x-forwarded-for"]?.split(",")[0].trim() || req.ip;
        const hashedIP = hashIP(ip);
        const token = await createTokenAndSaveUser(
          userId,
          username,
          email,
          hashedIP
        );
        done(null, { token, userId, username, email, hashedIP });
      } catch (error) {
        done(error, null);
      }
    }
  )
);

// Google Strategy
const GoogleStrategy = require("passport-google-oauth20").Strategy;
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: GOOGLE_REDIRECT,
      passReqToCallback: true,
    },
    async (req, _accessToken, _refreshToken, profile, done) => {
      try {
        const userId = profile.id;
        const email = profile.emails[0].value;
        const username = profile.displayName;
        const ip =
          req.headers["x-forwarded-for"]?.split(",")[0].trim() || req.ip;
        const hashedIP = hashIP(ip);
        const token = await createTokenAndSaveUser(
          userId,
          username,
          email,
          hashedIP
        );
        done(null, { token, userId, username, email, hashedIP });
      } catch (error) {
        done(error, null);
      }
    }
  )
);

// GitHub Strategy
const GitHubStrategy = require("passport-github2").Strategy;
passport.use(
  new GitHubStrategy(
    {
      clientID: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackURL: GITHUB_REDIRECT,
      passReqToCallback: true,
    },
    async (req, _accessToken, _refreshToken, profile, done) => {
      try {
        const userId = profile.id;
        const email = profile.emails[0].value;
        const username = profile.username;
        const ip =
          req.headers["x-forwarded-for"]?.split(",")[0].trim() || req.ip;
        const hashedIP = hashIP(ip);
        const token = await createTokenAndSaveUser(
          userId,
          username,
          email,
          hashedIP
        );
        done(null, { token, userId, username, email, hashedIP });
      } catch (error) {
        done(error, null);
      }
    }
  )
);

router.get(
  "/auth/discord",
  passport.authenticate("discord", { session: false })
);
router.get(
  "/auth/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    session: false,
  })
);
router.get(
  "/auth/github",
  passport.authenticate("github", { scope: ["user:email"], session: false })
);
router.get(
  "/auth/github/callback",
  passport.authenticate("github", { failureRedirect: "/", session: false }),
  handleOAuthCallback
);

// OAuth callback handler with channel creation logic
async function handleOAuthCallback(req, res) {
  try {
    const { token, userId, email, hashedIP } = req.user;
    // Check if the user already has an associated Discord channel
    let channel = await db.getOne(
      "SELECT channel_id FROM user_channels WHERE ip_hash = ? AND email = ?",
      [hashedIP, email.toLowerCase()]
    );

    if (!channel) {
      logger.debug(`Creating Discord channel for user ${email}`);
      const newChannel = await createDiscordChannelForUser(email);
      if (newChannel && newChannel.id) {
        await db.runQuery(
          "INSERT INTO user_channels (user_id, email, channel_id, ip_hash) VALUES (?, ?, ?, ?)",
          [userId, email.toLowerCase(), newChannel.id, hashedIP]
        );
        channel = { channel_id: newChannel.id };
      }
    }
    // Set the JWT token in a secure cookie
    res.cookie("token", token, {
      httpOnly: true,
      secure: true, // Ensure you use HTTPS
      sameSite: "None", // Required for cross-site cookies
      domain: ".banes-lab.com", // Make it available to all subdomains
      path: "/",
    });

    res.redirect("https://banes-lab.com/contact");
  } catch (error) {
    logger.error(`OAuth callback error: ${error.message}`, { error });
    res.redirect("/?error=oauth");
  }
}

router.get(
  "/auth/discord/callback",
  passport.authenticate("discord", { failureRedirect: "/", session: false }),
  handleOAuthCallback
);
router.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/", session: false }),
  handleOAuthCallback
);
router.get(
  "/auth/github/callback",
  passport.authenticate("github", { failureRedirect: "/", session: false }),
  handleOAuthCallback
);

// Removed regular /login route

module.exports = router;
