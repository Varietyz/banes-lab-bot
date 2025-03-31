const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ComponentType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');
const db = require('../../../utils/essentials/dbUtils');
const logger = require('../../../utils/essentials/logger');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reset_server')
    .setDescription('ADMIN: Fully wipe server roles, channels, emojis, webhooks, and DB entries.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });

    const confirmRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('confirm_reset')
        .setLabel('⚠️ Confirm Full Wipe')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('cancel_reset')
        .setLabel('❌ Cancel')
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.editReply({
      content: '⚠️ Are you absolutely sure you want to **W I P E** the entire server?',
      components: [confirmRow]
    });

    const filter = i => i.user.id === interaction.user.id;
    const collector = interaction.channel.createMessageComponentCollector({
      filter,
      componentType: ComponentType.Button,
      time: 20000
    });

    collector.on('collect', async i => {
      if (i.customId === 'confirm_reset') {
        collector.stop();
        await i.update({ content: '🧹 Starting full server reset...', components: [] });
        await runFullReset(interaction);
      } else {
        collector.stop();
        await i.update({ content: '❌ Reset cancelled.', components: [] });
      }
    });

    collector.on('end', collected => {
      if (collected.size === 0) {
        interaction.editReply({
          content: '❌ Reset confirmation timed out.',
          components: []
        });
      }
    });
  }
};

// 🔄 Full Reset Handler
async function runFullReset(interaction) {
  const guild = interaction.guild;
  let deleted = {
    roles: 0,
    channels: 0,
    emojis: 0,
    webhooks: 0
  };

  try {
    // 🧩 Roles (skip @everyone + bot roles)
    const roles = guild.roles.cache.filter(r => r.editable && r.id !== guild.id && !r.managed);
    for (const role of roles.values()) {
      await role
        .delete()
        .catch(err => logger.warn(`⚠️ Failed to delete role "${role.name}": ${err.message}`));
      deleted.roles++;
      await sleep(800);
    }

    // 🧱 Channels
    for (const channel of guild.channels.cache.values()) {
      await channel
        .delete()
        .catch(err => logger.warn(`⚠️ Failed to delete channel "${channel.name}": ${err.message}`));
      deleted.channels++;
      await sleep(800);
    }

    // 😀 Emojis
    for (const emoji of guild.emojis.cache.values()) {
      await emoji
        .delete()
        .catch(err => logger.warn(`⚠️ Failed to delete emoji "${emoji.name}": ${err.message}`));
      deleted.emojis++;
      await sleep(1000);
    }

    // 🔗 Webhooks
    const allChannels = await guild.channels.fetch();
    for (const ch of allChannels.values()) {
      if (!ch || !ch.isTextBased?.()) continue;
      try {
        const hooks = await ch.fetchWebhooks();
        for (const hook of hooks.values()) {
          await hook.delete('Wipe reset');
          deleted.webhooks++;
          await sleep(500);
        }
      } catch (err) {
        logger.warn(`⚠️ Could not fetch/delete webhooks for #${ch.name}: ${err.message}`);
      }
    }

    // 🧹 DB Table Cleanup
    await db.guild.runQuery('DELETE FROM ensured_channels');
    await db.guild.runQuery('DELETE FROM guild_roles');
    await db.guild.runQuery('DELETE FROM guild_emojis');
    await db.guild.runQuery('DELETE FROM guild_webhooks');
    await db.guild.runQuery('DELETE FROM guild_events');

    logger.info(`✅ Full reset complete.`);
    await interaction.followUp({
      flags: 64,
      content: `✅ **Server Reset Complete**:\n• 🧩 Roles: ${deleted.roles}\n• 🧱 Channels: ${deleted.channels}\n• 😀 Emojis: ${deleted.emojis}\n• 🔗 Webhooks: ${deleted.webhooks}\n🗃️ DB tables wiped: ensured_channels, guild_roles, guild_emojis, guild_webhooks, guild_events`
    });
  } catch (error) {
    logger.error(`❌ Reset failed: ${error.message}`);
    await interaction.followUp({
      flags: 64,
      content: `❌ Reset failed:\n\`\`\`${error.message}\`\`\``
    });
  }
}
