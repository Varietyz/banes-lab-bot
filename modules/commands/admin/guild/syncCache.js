const { SlashCommandBuilder } = require('@discordjs/builders');
const { PermissionsBitField, EmbedBuilder } = require('discord.js');
const logger = require('../../../utils/essentials/logger');
const { populateImageCache } = require('../../../../migrations/populateImageCache');
module.exports = {
  data: new SlashCommandBuilder()
    .setName('sync_cache')
    .setDescription('ADMIN: Manually update the image cache with the latest data.')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
  async execute(interaction) {
    if (!interaction.guild) {
      return await interaction.reply({
        content: '❌ **Error:** This command can only be used within a guild.',
        flags: 64
      });
    }
    await interaction.deferReply({ flags: 64 });
    logger.info(
      `👮 Administrator \`${interaction.user.id}\` initiated a manual clan channel update.`
    );
    try {
      await populateImageCache();
      const successEmbed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('✅ **Image Cache Update Successful**')
        .setDescription('The image cache has been updated with the latest resource folder data.')
        .setTimestamp();
      await interaction.editReply({ embeds: [successEmbed] });
    } catch (error) {
      logger.error(`❌ Error executing /update_clanchannel: ${error.message}`);
      await interaction.editReply({
        content:
          '❌ **Error:** An error occurred while updating the clan channel. Please try again later.'
      });
    }
  }
};
