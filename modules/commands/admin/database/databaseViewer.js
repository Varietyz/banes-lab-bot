const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionFlagsBits
} = require('discord.js');
const dbUtils = require('../../../utils/essentials/dbUtils');
const logger = require('../../../utils/essentials/logger');
const PAGE_SIZE = 10;
async function getTableNames(dbChoice) {
  const query = "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'";
  let rows;
  switch (dbChoice) {
    case 'main':
      rows = await dbUtils.getAll(query);
      break;
    case 'messages':
      rows = await dbUtils.messages.getAll(query);
      break;
    case 'images':
      rows = await dbUtils.image.getAll(query);
      break;
    case 'guild':
      rows = await dbUtils.guild.getAll(query);
      break;
    default:
      rows = [];
  }
  return rows.map(row => row.name);
}
function formatRows(rows, startIndex = 0) {
  return rows
    .map((row, i) => {
      let rowText = `Row ${startIndex + i + 1}:\n`;
      for (const [key, value] of Object.entries(row)) {
        rowText += `  ${key}: ${value}\n`;
      }
      return rowText;
    })
    .join('\n');
}
module.exports.data = new SlashCommandBuilder()
  .setName('view_database')
  .setDescription('ADMIN: View information about a database and its tables (Admin only).')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption(option =>
    option
      .setName('database')
      .setDescription('Select the database to view')
      .setRequired(true)
      .addChoices(
        { name: 'Main', value: 'main' },
        { name: 'Messages', value: 'messages' },
        { name: 'Images', value: 'images' },
        { name: 'Guild', value: 'guild' }
      )
  )
  .addStringOption(option =>
    option
      .setName('table')
      .setDescription('Select a table to preview (autocomplete enabled)')
      .setAutocomplete(true)
  );
module.exports.execute = async interaction => {
  try {
    if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({
        content: '❌ You do not have permission to use this command.',
        flags: 64
      });
    }
    await interaction.deferReply({ flags: 64 });
    const dbChoice = interaction.options.getString('database');
    const tableChoice = interaction.options.getString('table');
    let getAllFunc;
    switch (dbChoice) {
      case 'main':
        getAllFunc = dbUtils.getAll;
        break;
      case 'messages':
        getAllFunc = dbUtils.messages.getAll;
        break;
      case 'images':
        getAllFunc = dbUtils.image.getAll;
        break;
      case 'guild':
        getAllFunc = dbUtils.guild.getAll;
        break;
      default:
        return interaction.editReply('Invalid database selection.');
    }
    if (!tableChoice) {
      const tableNames = await getTableNames(dbChoice);
      if (tableNames.length === 0) {
        return interaction.editReply(`No tables found in the **${dbChoice}** database.`);
      }
      const embed = new EmbedBuilder()
        .setTitle(`Tables in the ${dbChoice} Database`)
        .setDescription(tableNames.map(t => `- ${t}`).join('\n'))
        .setTimestamp();
      return interaction.editReply({ embeds: [embed] });
    } else {
      let rows;
      try {
        rows = await getAllFunc(`SELECT * FROM ${tableChoice}`);
      } catch (err) {
        return interaction.editReply(`Error querying table **${tableChoice}**: ${err.message}`);
      }
      if (!rows || rows.length === 0) {
        return interaction.editReply(
          `No data found in table **${tableChoice}** of the **${dbChoice}** database.`
        );
      }
      const totalPages = Math.ceil(rows.length / PAGE_SIZE);
      let currentPage = 0;
      const generateEmbed = page => {
        const startIdx = page * PAGE_SIZE;
        const endIdx = startIdx + PAGE_SIZE;
        const pageData = rows.slice(startIdx, endIdx);
        const formattedText = formatRows(pageData, startIdx);
        const embed = new EmbedBuilder()
          .setTitle(`Preview: ${tableChoice} (${dbChoice} DB) — Page ${page + 1}/${totalPages}`)
          .setDescription('```fix\n' + formattedText + '\n```')
          .setTimestamp();
        return embed;
      };
      const createPaginationButtons = page => {
        return new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('prev_page')
            .setLabel('⬅️ Previous')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page === 0),
          new ButtonBuilder()
            .setCustomId('next_page')
            .setLabel('Next ➡️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page === totalPages - 1)
        );
      };
      const replyMessage = await interaction.editReply({
        embeds: [generateEmbed(currentPage)],
        components: [createPaginationButtons(currentPage)]
      });
      const collector = replyMessage.createMessageComponentCollector({ time: 60000 });
      collector.on('collect', async buttonInteraction => {
        if (buttonInteraction.user.id !== interaction.user.id) {
          return await buttonInteraction.reply({
            content: '❌ You cannot control this menu.',
            flags: 64
          });
        }
        if (buttonInteraction.customId === 'prev_page') {
          currentPage = Math.max(0, currentPage - 1);
        } else if (buttonInteraction.customId === 'next_page') {
          currentPage = Math.min(totalPages - 1, currentPage + 1);
        }
        await buttonInteraction.update({
          embeds: [generateEmbed(currentPage)],
          components: [createPaginationButtons(currentPage)]
        });
      });
      collector.on('end', async () => {
        await interaction.editReply({ components: [] });
      });
    }
  } catch (err) {
    logger.error(`Error executing /database command: ${err.message}`);
    return interaction.editReply({ content: '❌ An error occurred while executing the command.' });
  }
};
module.exports.autocomplete = async interaction => {
  try {
    const dbChoice = interaction.options.getString('database');
    const focusedValue = interaction.options.getFocused();
    if (!dbChoice) {
      return interaction.respond([]);
    }
    const tableNames = await getTableNames(dbChoice);
    const filtered = tableNames.filter(name =>
      name.toLowerCase().startsWith(focusedValue.toLowerCase())
    );
    const choices = filtered.slice(0, 25).map(name => ({ name, value: name }));
    return interaction.respond(choices);
  } catch (err) {
    logger.error(`Autocomplete error in /database command: ${err.message}`);
    return interaction.respond([]);
  }
};
