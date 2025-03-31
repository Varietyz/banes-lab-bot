const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');
const fs = require('fs');
const path = require('path');
const logger = require('../../utils/essentials/logger');
module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Provides a list of available commands with descriptions.')
    .addStringOption(option =>
      option
        .setName('command')
        .setDescription('Get detailed help for a specific command')
        .setRequired(false)
        .setAutocomplete(true)
    ),
  async execute(interaction) {
    const commandName = interaction.options.getString('command');
    const { allCommands } = loadAndCategorizeCommands();
    const hasAdminPermissions = checkAdminPermissions(interaction);
    if (!hasAdminPermissions) {
      allCommands = allCommands.filter(cmd => !cmd.category.includes('Admin'));
    }
    if (commandName) {
      const command = allCommands.find(cmd => cmd.name === commandName);
      if (!command) {
        return interaction.reply({
          content: `❌ No command found with the name **${commandName}**.`,
          flags: 64
        });
      }
      const embed = createCommandEmbed(command);
      return interaction.reply({ embeds: [embed], flags: 64 });
    }
    const embed = new EmbedBuilder()
      .setTitle('📜 Varietyz Bot Help Menu')
      .setColor(0x3498db)
      .setDescription('🔹 Use `/help command:<name>` for details about a specific command.')
      .setTimestamp();
    return interaction.reply({ embeds: [embed], flags: 64 });
  },
  autocomplete: async interaction => {
    const hasAdminPermissions = checkAdminPermissions(interaction);
    const { allCommands } = loadAndCategorizeCommands();
    let availableCommands = allCommands;
    if (!hasAdminPermissions) {
      availableCommands = availableCommands.filter(cmd => !cmd.category.includes('Admin'));
    }
    return interaction.respond(availableCommands.map(cmd => ({ name: cmd.name, value: cmd.name })));
  }
};
function createCommandEmbed(command) {
  const embed = new EmbedBuilder()
    .setTitle(`📖 Command Help: \`/${command.name}\``)
    .setColor(0x3498db)
    .setTimestamp();
  embed.addFields({ name: '📝 **Description:**', value: command.description });
  embed.addFields({
    name: '📌 **Usage:**',
    value: `\`/${command.name}\` ${formatCommandUsage(command)}`
  });
  if (command.options.length > 0) {
    const optionsText = command.options
      .map(opt => {
        return `- \`${opt.name}\` *${opt.required ? 'required' : 'optional'}* → ${opt.description}`;
      })
      .join('\n');
    embed.addFields({ name: '🔹 **Options:**', value: optionsText });
  }
  embed.addFields({
    name: '💡 **Example:**',
    value: `\`/${command.name} ${generateExample(command)}\``
  });
  return embed;
}
function formatCommandUsage(command) {
  if (!command.options.length) return '';
  return command.options.map(opt => `[${opt.name}]`).join(' ');
}
function generateExample(command) {
  if (!command.options.length) return '';
  return command.options.map(opt => (opt.required ? `<${opt.name}>` : `[${opt.name}]`)).join(' ');
}
function loadAndCategorizeCommands() {
  const commandDir = path.join(__dirname);
  const commandFiles = fs.readdirSync(commandDir).filter(file => file.endsWith('.js'));
  const allCommands = [];
  for (const file of commandFiles) {
    try {
      const command = require(`./${file}`);
      if (!command.data) continue;
      const commandName = command.data.name;
      const commandDescription = command.data.description;
      const category = determineCategory(file);
      const commandObj = {
        name: commandName,
        description: commandDescription,
        category,
        options: command.data.options || []
      };
      allCommands.push(commandObj);
    } catch (error) {
      logger.error(`❌ Failed to load command ${file}:`, error);
    }
  }
  return { allCommands };
}
function determineCategory(filename) {
  if (filename.startsWith('admin')) return 'Admin';
  if (filename.includes('Competition') || filename.includes('SetRotationPeriod'))
    return 'Competition';
  return 'General';
}
function checkAdminPermissions(interaction) {
  return (
    interaction.member.permissions.has(PermissionsBitField.Flags.Administrator) ||
    interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)
  );
}
