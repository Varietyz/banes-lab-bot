const os = require("os");
const logger = require("../../utils/essentials/logger");
require("dotenv").config();

const apiPort = process.env.DEV_PORT || process.env.API_PORT;

/**
 * Generates a detailed login log message.
 * @param {Client} client - The initialized Discord client.
 */
const loggedIn = (client) => {
  const loginTimestamp = new Date().toISOString();
  const activeGuilds = client.guilds.cache.size;
  const guilds = client.guilds.cache
    .map((guild) => `🔹 ${guild.name} (${guild.id})`)
    .join("\n");

  const memoryUsage = process.memoryUsage();
  const totalMemory = (memoryUsage.heapTotal / 1024 / 1024).toFixed(2);
  const usedMemory = (memoryUsage.heapUsed / 1024 / 1024).toFixed(2);
  const cpuUsage = os
    .loadavg()
    .map((num) => num.toFixed(2))
    .join(", ");

  logger.info(`
🌟 Detailed Login Information 🌟
--------------------------------------
🟢 Bot Username:         ${client.user.tag}
🆔 Bot ID:               ${client.user.id}
📅 Login Time:           ${loginTimestamp}
🕒 Uptime:               ${process.uptime().toFixed(2)} seconds

🌐 Active Guilds (${activeGuilds}): 
${guilds}

🌐 API Server Information:
  🌍 Active Ports:        ${apiPort}

💾 System Metrics:
  📈 Memory Usage:        ${usedMemory} MB / ${totalMemory} MB
  🔋 CPU Load (1, 5, 15 min): ${cpuUsage}
  🌐 Node Version:        ${process.version}
  🆔 Process ID:          ${process.pid}
--------------------------------------
✅ Bot is fully operational and ready to receive commands.
    `);
};

module.exports = loggedIn;
