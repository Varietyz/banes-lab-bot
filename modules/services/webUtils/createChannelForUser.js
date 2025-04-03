// modules/utils/essentials/createChannelForUser.js
const { ChannelType, PermissionsBitField } = require("discord.js");
const logger = require("../../utils/essentials/logger");
const client = require("../../discordClient");

/**
 * Creates a dedicated Discord text channel for a user.
 * @param {Client} client - The Discord client instance.
 * @param {string} email - The user's email (used to generate a sanitized channel name).
 * @returns {Promise<GuildChannel>} - The created channel.
 */
async function createDiscordChannelForUser(email) {
  try {
    // Retrieve the guild using the GUILD_ID from environment variables.
    let guild = client.guilds.cache.get(process.env.GUILD_ID);

    // Fallback: fetch the guild if it's not in cache.
    if (!guild) {
      logger.warn(
        "⚠️ Guild not found in cache. Attempting to fetch directly from API..."
      );
      guild = await client.guilds.fetch(process.env.GUILD_ID);
      if (!guild) {
        throw new Error(
          "Guild fetch failed. Invalid GUILD_ID or missing permissions."
        );
      }
      logger.info(`✅ Successfully fetched guild ${guild.name} from API.`);
    }

    // Sanitize the email to create a valid channel name.
    const sanitizedEmail = email.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
    const channelName = `🌐-${sanitizedEmail}`;

    // Create the new text channel.
    const newChannel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      topic: `Private channel for ${email}`,
      permissionOverwrites: [
        {
          id: guild.roles.everyone,
          deny: [PermissionsBitField.Flags.ViewChannel],
        },
      ],
    });

    logger.info(`✅ Created channel ${newChannel.id} for user ${email}`);
    return newChannel;
  } catch (error) {
    logger.error(`🚨 Error in createDiscordChannelForUser: ${error.message}`);
    throw error;
  }
}

module.exports = createDiscordChannelForUser;
