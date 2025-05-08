// 📂 modules/events/messageCreate.js
const { io } = require("../../../api/websocket");
const { saveSmartLogToDb } = require("../../services/smartLogWriter");

module.exports = {
  name: "messageCreate",
  once: false,
  async execute(message) {
    const content = message.content || "";

    // ✅ SMART EMBED PARSE ONLY — from webhook in target channel
    if (
      message.channel.id === "1354249430282272798" &&
      message.webhookId &&
      message.embeds.length > 0 &&
      message.embeds[0].title === "📦 SMART Disk Report"
    ) {
      const embed = message.embeds[0];

      const extractField = (label) => {
        const field = embed.fields.find(f => f.name.includes(label));
        if (!field || !field.value) return null;
        return field.value.replace(/[^0-9.]/g, ""); // strip units, symbols
      };

      await saveSmartLogToDb({
        timestamp: new Date(message.createdTimestamp),
        temperature: Number(extractField("Temperature")),
        power_on_hours: Number(extractField("Power-On Hours")),
        percentage_used: Number(extractField("Usage")),
        data_read_gb: Number(extractField("Data Read")),
        data_written_gb: Number(extractField("Data Written"))
      });
    }

    // ✅ Emit normal user messages (non-bot)
    if (!message.author.bot) {
      console.log(
        `📨 Discord message received from ${message.author.username}: ${content || "[Non-text content]"}`
      );

      const messageData = {
        author: message.author.username,
        content,
        timestamp: message.createdAt.toLocaleString(),
        channelId: message.channel.id
      };

      if (io) {
        io.to(message.channel.id).emit("message", messageData);
        console.log("✅ Message successfully emitted to the web client.");
      } else {
        console.error("❌ Error: Socket.io instance is not initialized.");
      }
    }
  }
};
