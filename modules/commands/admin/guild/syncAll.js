const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const logger = require('../../../utils/essentials/logger');
const { populateImageCache } = require('../../../../migrations/populateImageCache');
const { execute: syncEmojis } = require('./syncEmojis');
const { execute: syncRoles } = require('./syncRoles');
const { execute: syncServer } = require('./syncServer');
function createSubcommandInteraction(subcommand, interaction) {
  return {
    guild: interaction.guild,
    user: interaction.user,
    options: {
      getSubcommand: function () {
        return subcommand;
      },
      getString: function () {
        return null;
      },
      getChannel: function () {
        return null;
      }
    },
    replied: true,
    deferReply: async function () {
      return;
    },
    reply: async function (message) {
      logger.warn(
        `⚠️ Subcommand '${subcommand}' attempted to reply: ${message.content || message}`
      );
    },
    editReply: async function (message) {
      logger.warn(
        `⚠️ Subcommand '${subcommand}' attempted to editReply: ${message.content || message}`
      );
    }
  };
}
module.exports = {
  data: new SlashCommandBuilder()
    .setName('sync')
    .setDescription(
      'ADMIN: Runs all sync tasks sequentially: cache, emojis, server, members, roles, and channels.'
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
    if (!interaction.guild) {
      return await interaction.reply({
        content: '❌ **Error:** This command must be used in a server.',
        flags: 64
      });
    }
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ flags: 64 });
    }
    logger.info(`👮 Admin ${interaction.user.tag} initiated full sync execution.`);
    try {
      logger.info('🔄 Syncing image cache...');
      await populateImageCache();
      logger.info('✅ Image cache sync completed.');
      logger.info('🔄 Syncing server data...');
      await syncServer(interaction);
      logger.info('✅ Server sync completed.');
      logger.info('🔄 Syncing emojis...');
      await syncEmojis(createSubcommandInteraction('sync', interaction));
      logger.info('✅ Emoji sync completed.');
      logger.info('🔄 Syncing roles...');
      await syncRoles(interaction);
      logger.info('✅ Role sync completed.');
      await interaction.editReply('🎉 **All sync tasks executed successfully!**');
    } catch (error) {
      logger.error(`❌ Error executing full sync tasks: ${error.message}`);
      await interaction.editReply(
        '❌ **Error:** An issue occurred while executing the sync tasks.'
      );
    }
  }
};
