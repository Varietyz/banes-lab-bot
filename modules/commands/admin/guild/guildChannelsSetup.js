const { SlashCommandBuilder } = require('@discordjs/builders');
const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');

const logger = require('../../../utils/essentials/logger');
const db = require('../../../utils/essentials/dbUtils');
const {
  ensureAllChannels,
  ensureChannel,
  ensureCategory
} = require('../../../utils/essentials/channelSetup');
const {
  listAvailablePresets,
  loadChannelConfigFromFile
} = require('../../../utils/essentials/loadChannelConfig');
const { getOne, getAll, runQuery } = db.guild;

function buildCategoryMap(config) {
  const catMap = {};
  for (const category of config.categories) {
    const catKey = category.name.toLowerCase().replace(/[^a-z0-9]/gi, '_');
    catMap[catKey] = category.channels.map(c => c.key);
  }
  catMap.basic = config.noCategory.map(c => c.key);
  return catMap;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('channels')
    .setDescription('ADMIN: Manage channels (setup, remove, assign, list).')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
      sub
        .setName('setup')
        .setDescription('Create channels for a category or all, optionally from a preset.')
        .addStringOption(opt =>
          opt
            .setName('preset')
            .setDescription('Optional preset config file from /config/channels/')
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addStringOption(opt =>
          opt
            .setName('category')
            .setDescription('Which category or "all"?')
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('remove_all')
        .setDescription('Remove all channels for a category or all.')
        .addStringOption(opt =>
          opt
            .setName('category')
            .setDescription('Which category or "all"?')
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('list')
        .setDescription('List all assigned channels.')
        .addStringOption(opt =>
          opt
            .setName('category')
            .setDescription('Optional category filter.')
            .setRequired(false)
            .setAutocomplete(true)
        )
        .addStringOption(opt =>
          opt
            .setName('preset')
            .setDescription('Optional preset to load structure from.')
            .setRequired(false)
            .setAutocomplete(true)
        )
    ),
  async execute(interaction) {
    const sub = interaction.options.getSubcommand(true);
    const category = interaction.options.getString('category');
    const presetPath =
      interaction.options.getString('preset') ??
      interaction.options._hoistedOptions?.find(opt => opt.name === 'preset')?.value;

    try {
      await interaction.deferReply({ flags: 64 });

      const config = loadChannelConfigFromFile(presetPath);

      const categoriesMap = buildCategoryMap(config);
      const allKeys = Object.values(categoriesMap).flat();

      if (sub === 'setup') {
        if (category === 'all') {
          await ensureAllChannels(interaction.guild, config);
        } else if (categoriesMap[category]) {
          const parentData = config.categories.find(
            c => category === c.name.toLowerCase().replace(/[^a-z0-9]/gi, '_')
          );
          if (parentData) {
            const cat = await ensureCategory(
              interaction.guild,
              parentData.name,
              parentData.permissionKey
            );
            for (const ch of parentData.channels) {
              await ensureChannel(interaction.guild, ch, cat);
            }
          }
        } else {
          return interaction.editReply(`❌ Unknown category: \`${category}\``);
        }

        return interaction.editReply(`✅ Setup complete for **${category}**.`);
      }

      if (sub === 'remove_all') {
        const keys = category === 'all' ? allKeys : categoriesMap[category];
        if (!keys) return interaction.editReply(`❌ Unknown category: \`${category}\``);

        for (const k of keys) {
          const row = await getOne(
            'SELECT channel_id FROM ensured_channels WHERE channel_key = ?',
            [k]
          );
          if (!row) continue;
          const ch = interaction.guild.channels.cache.get(row.channel_id);
          if (ch)
            await ch
              .delete()
              .catch(e => logger.warn(`❌ Failed to delete channel (${k}): ${e.message}`));
          await runQuery('DELETE FROM ensured_channels WHERE channel_key = ?', [k]);
        }

        return interaction.editReply(`🗑️ Removed all channels for **${category}**.`);
      }

      if (sub === 'list') {
        const rows = await getAll(
          'SELECT channel_key, channel_id FROM ensured_channels ORDER BY channel_key'
        );
        if (!rows.length) return interaction.editReply('No channels are currently assigned.');

        if (!presetPath) {
          return interaction.editReply('❌ Please select a valid preset to list by structure.');
        }

        const config = loadChannelConfigFromFile(presetPath);
        const categoriesMap = buildCategoryMap(config);

        const keys = category && categoriesMap[category] ? categoriesMap[category] : null;
        const filtered = keys ? rows.filter(r => keys.includes(r.channel_key)) : rows;

        const lines = filtered.map(r => `• \`${r.channel_key}\` → <#${r.channel_id}>`);
        const embed = new EmbedBuilder()
          .setTitle(`Assigned Channels${category ? ` (${category})` : ''}`)
          .setDescription(lines.join('\n'))
          .setColor(0xcea555);

        return interaction.editReply({ embeds: [embed] });
      }
    } catch (err) {
      logger.error(`❌ /channels ${sub} error: ${err.message}`);
      return interaction.editReply(`❌ Error: ${err.message}`);
    }
  },

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused(true);
    const input = focused.value.toLowerCase();

    const presetInput =
      interaction.options.getString('preset') ??
      interaction.options._hoistedOptions?.find(opt => opt.name === 'preset')?.value;

    if (focused.name === 'preset') {
      const presets = listAvailablePresets();
      const filtered = presets.filter(p => p.toLowerCase().includes(input));
      return interaction.respond(filtered.map(p => ({ name: p, value: `${p}.json` })));
    }

    if (focused.name === 'category') {
      const preset = interaction.options.getString('preset');
      if (!preset) return interaction.respond([]);

      try {
        const config = loadChannelConfigFromFile(preset);
        const catMap = buildCategoryMap(config);
        const matches = Object.keys(catMap)
          .concat('all')
          .filter(c => c.includes(input));
        return interaction.respond(matches.map(m => ({ name: m, value: m })));
      } catch (err) {
        logger.error(`🚨 Autocomplete Error: ${err.message}`);
        return interaction.respond([]);
      }
    }

    return interaction.respond([]);
  }
};
