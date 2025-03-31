const logger = require('./logger');
/**
 *
 * @param interaction
 * @param commands
 */
async function handleSlashCommand(interaction, commands) {
  try {
    const command = commands.find(cmd => cmd.data.name === interaction.commandName);

    if (!command) {
      logger.warn(`❌ **Unknown Command:** \`${interaction.commandName}\` is not recognized.`);
      return;
    }

    await command.execute(interaction);
    logger.info(`✅ **Success:** \`${interaction.commandName}\` executed successfully. 🎉`);
  } catch (err) {
    logger.error(
      `🚨 **Execution Error:** Error executing \`${interaction.commandName}\`: ${err.message}`
    );
  }
}
/**
 *
 * @param interaction
 * @param commands
 */
async function handleAutocomplete(interaction, commands) {
  try {
    const command = commands.find(cmd => cmd.data.name === interaction.commandName);

    if (!command) {
      logger.warn(`❌ **Autocomplete Error:** Unknown command \`${interaction.commandName}\`.`);
      return;
    }

    if (!command.autocomplete) {
      logger.warn(
        `⚠️ **Missing Handler:** Autocomplete not implemented for \`${interaction.commandName}\`.`
      );
      return;
    }

    await command.autocomplete(interaction);
    logger.info(`✅ **Autocomplete:** \`${interaction.commandName}\` handled successfully. 🎉`);
  } catch (err) {
    logger.error(
      `🚨 **Autocomplete Error:** Error processing \`${interaction.commandName}\`: ${err.message}`
    );
    await interaction.respond([]);
  }
}
process.on('unhandledRejection', (reason, promise) => {
  logger.error(`🚨 **Unhandled Rejection:** at \`${promise}\` | Reason: ${reason}`);
});
process.on('uncaughtException', error => {
  logger.error(`🚨 **Uncaught Exception:** ${error.message}`);
  logger.error(error.stack);
  throw error;
});
module.exports = {
  handleAutocomplete,
  handleSlashCommand
};
