// 📂 modules/events/messageCreate.js

module.exports = {
  name: "messageCreate",
  once: false,
  async execute(message) {
    const io = global._io; // Access the shared io instance

    if (!message.author.bot) {
      console.log(`📨 Message received from Discord: ${message.content}`);

      if (io) {
        console.log("✅ Emitting message to web client...");
        io.emit("message", {
          author: message.author.username,
          content: message.content,
          channelId: message.channel.id,
        });
        console.log("✅ Message successfully emitted to the web client.");
      } else {
        console.error("❌ Error: Socket.io instance is not initialized.");
      }
    }
  },
};
