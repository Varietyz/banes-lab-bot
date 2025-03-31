// sanitizer.js
const validator = require('validator');
const { logger } = require('../../../main');

/**
 * Sanitize any user input in the interaction.
 * This function covers:
 *  - Slash Command options
 *  - Modal Submission fields
 *  - Autocomplete focused value
 *  - All types of Select Menus (String, User, Role, Channel, Mentionable)
 *  - (Optionally) Button custom IDs (only for logging validation)
 *
 * @param {Interaction} interaction - The Discord interaction object.
 */
function sanitizeInteraction(interaction) {
  // For Slash Commands:
  if (interaction.isCommand() && interaction.options?.data) {
    interaction.options.data.forEach(option => {
      if (typeof option.value === 'string') {
        // Escape harmful characters.
        option.value = validator.escape(option.value);
      }
    });
  }

  // For Modal Submissions:
  if (interaction.isModalSubmit() && interaction.fields) {
    // interaction.fields.fields is a collection of submitted fields.
    interaction.fields.fields.forEach(field => {
      if (typeof field.value === 'string') {
        field.value = validator.escape(field.value);
      }
    });
  }

  // For Autocomplete interactions:
  // Typically, autocomplete interactions have a "focused" value containing user input.
  if (interaction.isAutocomplete() && interaction.options) {
    const focused = interaction.options.getFocused();
    if (typeof focused === 'string') {
      // Attach a sanitized version for use in your autocomplete handler.
      interaction.sanitizedFocusedValue = validator.escape(focused);
    }
  }

  // For String Select Menus:
  // The values array contains the user-selected option values.
  if (interaction.isStringSelectMenu() && Array.isArray(interaction.values)) {
    interaction.values = interaction.values.map(value =>
      typeof value === 'string' ? validator.escape(value) : value
    );
  }

  // For User, Role, Channel, and Mentionable Select Menus:
  if (
    interaction.isUserSelectMenu() ||
    interaction.isRoleSelectMenu() ||
    interaction.isChannelSelectMenu() ||
    interaction.isMentionableSelectMenu()
  ) {
    if (Array.isArray(interaction.values)) {
      interaction.values = interaction.values.map(value =>
        typeof value === 'string' ? validator.escape(value) : value
      );
    }
  }

  // For Button Interactions:
  // Buttons usually have a customId defined by your code, but if you ever incorporate dynamic data
  // or want to ensure the customId is safe, you might validate it. However, modifying it may break logic.
  if (interaction.isButton() && typeof interaction.customId === 'string') {
    // Example: Log a warning if customId contains unexpected characters.
    if (!/^[\w-]+$/.test(interaction.customId)) {
      logger.error(`Unexpected characters found in button customId: ${interaction.customId}`);
      // You could also choose to sanitize, but that might interfere with your command matching.
    }
  }

  // Context Menu interactions (Message or User) typically don't include additional user text,
  // so no sanitization is necessary.
}

module.exports = { sanitizeInteraction };
