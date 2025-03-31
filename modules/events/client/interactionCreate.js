const {
  handleAutocomplete,
  handleSlashCommand
} = require('../../utils/essentials/slashCommandHandler');
const { handleModalSubmission } = require('../../utils/essentials/modalHandler');
const { showRegisterClanchatModal } = require('../../modals/registerCCWebhookModal');
const modalIds = require('../../../config/customModalIds');
const db = require('../../utils/essentials/dbUtils');
const { sanitizeInteraction } = require('../../utils/essentials/sanitizer');
const logger = require('../../utils/essentials/logger');
module.exports = {
  name: 'interactionCreate',
  once: false,
  async execute(interaction, client) {
    sanitizeInteraction(interaction);
    if (interaction.isCommand()) {
      await handleSlashCommand(interaction, client.commands);
    } else if (interaction.isAutocomplete()) {
      await handleAutocomplete(interaction, client.commands);
    } else if (interaction.isButton()) {
      logger.info(`🟡 Button Clicked: ${interaction.customId}`);
      if (modalIds.includes(interaction.customId)) {
        logger.info('🟠 Opening Modal...');
        const existing = await db.getOne(
          'SELECT * FROM modal_tracking WHERE modal_key = ? AND registered_by = ?',
          [interaction.customId, interaction.user.id]
        );
        if (existing) {
          return interaction.reply({
            content:
              '⚠️ You already have an ongoing registration for this modal. Please complete or wait before trying again.',
            flags: 64
          });
        }
        await db.runQuery('INSERT INTO modal_tracking (modal_key, registered_by) VALUES (?, ?)', [
          interaction.customId,
          interaction.user.id
        ]);
        await showRegisterClanchatModal(interaction);
      }
    } else if (interaction.isModalSubmit()) {
      if (!interaction.customId) {
        return interaction.reply({
          content: '❌ Modal submission failed. No custom ID found.',
          flags: 64
        });
      }
      logger.info(`🔴 Modal Submitted: ${interaction.customId}`);
      await handleModalSubmission(interaction);
    } else if (interaction.isStringSelectMenu()) {
      if (interaction.customId === 'vote_dropdown' && client.competitionService) {
        await client.competitionService.handleVote(interaction);
      }
    }
  }
};
