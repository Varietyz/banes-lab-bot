// 📂 modules/events/messageCreate.js
const { io } = require("../../../api/websocket");

module.exports = {
  name: "messageCreate",
  once: false,
  async execute(message) {
    if (!message.author.bot) {
      console.log(
        `📨 Discord message received from ${message.author.username}: ${message.content || "[Non-text content]"}`
      );

      // Prepare the message data
      const messageData = {
        author: message.author.username,
        content: message.content || "", // Handles cases where content is empty but an image is sent
        timestamp: message.createdAt.toLocaleString(),
        channelId: message.channel.id,
      };

      // Emit the message to all clients connected to the channel
      if (io) {
        io.to(message.channel.id).emit("message", messageData);
        console.log("✅ Message successfully emitted to the web client.");
      } else {
        console.error("❌ Error: Socket.io instance is not initialized.");
      }
    }
  },
};
