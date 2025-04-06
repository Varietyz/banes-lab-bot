const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  EmbedBuilder
} = require('discord.js');
const db = require('../utils/essentials/dbUtils');
const logger = require('../utils/essentials/logger');
const modalId = 'register_clanchat_webhook_modal';
/**
 *
 * @param interaction
 */
async function showRegisterClanchatModal(interaction) {
  const modal = new ModalBuilder()
    .setCustomId('register_clanchat_webhook_modal')
    .setTitle('Register Clanchat Webhook');
  const secretKeyInput = new TextInputBuilder()
    .setCustomId('secret_key')
    .setLabel('Secret Key')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);
  const clanNameInput = new TextInputBuilder()
    .setCustomId('clan_name')
    .setLabel('Clan Name')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);
  const endpointUrlInput = new TextInputBuilder()
    .setCustomId('endpoint_url')
    .setLabel('Endpoint URL')
    .setStyle(TextInputStyle.Short)
    .setValue('https://clanchat.net')
    .setRequired(true);
  const row1 = new ActionRowBuilder().addComponents(secretKeyInput);
  const row2 = new ActionRowBuilder().addComponents(clanNameInput);
  const row3 = new ActionRowBuilder().addComponents(endpointUrlInput);
  modal.addComponents(row1, row2, row3);
  await interaction.showModal(modal);
}
/**
 *
 * @param interaction
 */
async function execute(interaction) {
  if (!interaction.fields) {
    return interaction.reply({
      content: '❌ Error processing modal submission. Missing fields.',
      flags: 64
    });
  }
  const secretKey = interaction.fields.getTextInputValue('secret_key');
  const clanName = interaction.fields.getTextInputValue('clan_name');
  const endpointUrl =
    interaction.fields.getTextInputValue('endpoint_url') || 'https://clanchat.net';
  const registeredBy = interaction.user.id;
  try {
    const clanchatKey = await generateClanChatKey();
    const webhookRow = await db.guild.getOne(
      'SELECT webhook_url, channel_id FROM guild_webhooks WHERE webhook_key = ?',
      ['webhook_osrs_clan_chat']
    );
    if (!webhookRow) {
      throw new Error('No matching webhook found in the database.');
    }
    await db.runQuery(
      `INSERT INTO clanchat_config (clanchat_key, secret_key, clan_name, webhook_url, channel_id, endpoint_url, registered_by)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        clanchatKey,
        secretKey,
        clanName,
        webhookRow.webhook_url,
        webhookRow.channel_id,
        endpointUrl,
        registeredBy
      ]
    );
    await interaction.reply({
      content: `✅ Successfully registered ClanChat webhook with URL:\n**\`\`\`${webhookRow.webhook_url}\`\`\`**
        \`\`\`${clanchatKey}\`\`\`
        \`\`\`${secretKey}\`\`\`
        \`\`\`${clanName}\`\`\`
        \`\`\`${endpointUrl}\`\`\``,
      flags: 64
    });
    logger.info(
      `✅ New ClanChat registered: Key=${clanchatKey}, Clan=${clanName}, URL=${endpointUrl}`
    );
    const targetChannelId = webhookRow.channel_id;
    let targetChannel = interaction.client.channels.cache.get(targetChannelId);
    if (!targetChannel) {
      try {
        targetChannel = (await interaction.client.channels.fetch(targetChannelId)) || undefined;
      } catch (err) {
        logger.warn(`⚠️ Could not fetch channel ${targetChannelId}: ${err.message}`);
      }
    }
    if (targetChannel) {
      const registrationEmbed = new EmbedBuilder()
        .setTitle('✅ Clan Chat Registration Complete')
        .setColor(0x00aa00)
        .setDescription(
          '**This channel was assigned as the clanchat.**\n\n' +
            `**Clan Name:** \`${clanName}\`\n` +
            `**Secret Key:** \`\`\`${secretKey}\`\`\`\n` +
            `**Endpoint URL:** \`${endpointUrl}\`\n` +
            '\n'
        )
        .setFooter({ text: `Registered by ${interaction.user.tag}` })
        .setTimestamp();
      try {
        if (targetChannel.isTextBased()) {
          if (targetChannel.isTextBased() && 'send' in targetChannel) {
            await targetChannel.send({ embeds: [registrationEmbed] });
          } else {
            logger.warn(
              `⚠️ The target channel ${targetChannelId} is not a text-based channel or does not support sending messages.`
            );
          }
        } else {
          logger.warn(`⚠️ The target channel ${targetChannelId} is not a text-based channel.`);
        }
      } catch (sendErr) {
        logger.warn(`⚠️ Unable to send embed in #${targetChannelId}: ${sendErr.message}`);
      }
    } else {
      logger.warn(
        `⚠️ Could not find or fetch channel with ID ${targetChannelId} to send the registration embed.`
      );
    }
  } catch (error) {
    if (
      error.message.includes(
        'SQLITE_CONSTRAINT: UNIQUE constraint failed: clanchat_config.secret_key'
      )
    ) {
      const existingEntry = await db.getOne('SELECT * FROM clanchat_config WHERE secret_key = ?', [
        secretKey
      ]);
      if (existingEntry) {
        const embed = new EmbedBuilder()
          .setColor(0xffcc00)
          .setTitle('⚠️ Secret Key Already Registered')
          .setDescription(
            'This secret key is already associated with an existing ClanChat webhook.'
          )
          .addFields(
            {
              name: '🔑 **ClanChat Key**',
              value: `\`${existingEntry.clanchat_key}\``,
              inline: true
            },
            { name: '🏛 **Clan Name**', value: `\`${existingEntry.clan_name}\``, inline: true },
            {
              name: '🔗 **Webhook URL**',
              value: `\`\`\`${existingEntry.webhook_url}\`\`\``,
              inline: false
            },
            { name: '📢 **Channel**', value: `<#${existingEntry.channel_id}>`, inline: true },
            {
              name: '🌍 **Endpoint URL**',
              value: `\`${existingEntry.endpoint_url}\``,
              inline: true
            },
            {
              name: '👤 **Registered By**',
              value: `<@${existingEntry.registered_by}>`,
              inline: false
            }
          )
          .setTimestamp();
        await interaction.reply({ embeds: [embed], flags: 64 });
      } else {
        await interaction.reply({
          content: '❌ Error: This secret key is already registered, but no details found.',
          flags: 64
        });
      }
    } else {
      logger.error(`❌ Database error: ${error.message}`);
      await interaction.reply({
        content: '❌ Error saving ClanChat webhook. Please try again.',
        flags: 64
      });
    }
  }
}
/**
 *
 */
async function generateClanChatKey() {
  const query = `
        SELECT MAX(CAST(SUBSTR(clanchat_key, LENGTH('chathook_') + 1) AS INTEGER)) AS maxKey
        FROM clanchat_config
    `;
  const row = await db.getOne(query);
  return `chathook_${row && row.maxKey ? row.maxKey + 1 : 1}`;
}
module.exports = {
  modalId,
  execute,
  showRegisterClanchatModal
};

// EXAMPLE USAGE FOR MODALS
