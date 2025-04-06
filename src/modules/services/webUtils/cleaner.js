// cleaner.js
const fs = require("fs");
const path = require("path");
const dbUtils = require("../../utils/essentials/dbUtils");
const client = require("../../discordClient");
const logger = require("../../utils/essentials/logger");

/**
 * Cleanup inactive users:
 *  - Finds users who have not had a session created in the last month.
 *  - Archives their Discord channel history to a JSON file.
 *  - Deletes their Discord channel.
 *  - Cleans up related database entries.
 */
async function cleanupInactiveUsers() {
  try {
    // Define cutoff time (1 month ago in Unix timestamp)
    const inactiveTime = Math.floor(Date.now() / 1000) - 14 * 24 * 60 * 60; // 2 weeks

    // Query inactive users:
    // Here, we assume a user with no session after the cutoff is inactive.
    const inactiveUsers = await dbUtils.getAll(
      `SELECT u.user_id, u.email, uc.channel_id
       FROM users u
       LEFT JOIN user_sessions us ON u.user_id = us.user_id
       LEFT JOIN user_channels uc ON u.user_id = uc.user_id
       WHERE (us.created_at IS NULL OR us.created_at < ?)`,
      [inactiveTime]
    );

    for (const user of inactiveUsers) {
      logger.info(`Cleaning up inactive user: ${user.email}`);

      // Archive channel history if a channel exists.
      if (user.channel_id) {
        try {
          const channel = await client.channels.fetch(user.channel_id);
          if (channel) {
            // Fetch messages (adjust limit as needed, consider pagination for long histories)
            const messagesCollection = await channel.messages.fetch({
              limit: 100,
            });
            const history = messagesCollection.map((msg) => ({
              author: msg.author.username,
              content: msg.content,
              timestamp: msg.createdAt,
            }));

            // Ensure the history folder exists.
            const historyDir = path.join(__dirname, "history");
            if (!fs.existsSync(historyDir)) {
              fs.mkdirSync(historyDir);
            }

            // Save history to a file named after the user's email.
            const filePath = path.join(historyDir, `${user.email}.json`);
            fs.writeFileSync(
              filePath,
              JSON.stringify(history, null, 2),
              "utf8"
            );
            logger.info(`Archived history for ${user.email} to ${filePath}`);

            // Delete the Discord channel.
            await channel.delete("Cleanup inactive user channel");
            logger.info(
              `Deleted Discord channel ${user.channel_id} for ${user.email}`
            );
          }
        } catch (channelErr) {
          logger.error(
            `Failed to process channel for ${user.email}: ${channelErr.message}`
          );
        }
      }

      // Clean up database entries.
      await dbUtils.runQuery("DELETE FROM user_sessions WHERE user_id = ?", [
        user.user_id,
      ]);
      await dbUtils.runQuery("DELETE FROM user_channels WHERE user_id = ?", [
        user.user_id,
      ]);
      await dbUtils.runQuery("DELETE FROM users WHERE user_id = ?", [
        user.user_id,
      ]);

      logger.info(`Cleaned up database entries for ${user.email}`);
    }
  } catch (err) {
    logger.error(`Cleanup error: ${err.message}`);
  }
}

module.exports = { cleanupInactiveUsers };
