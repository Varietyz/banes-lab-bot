const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const path = require('path');
const fs = require('fs');
const db = require('../../../utils/essentials/dbUtils');
const logger = require('../../../utils/essentials/logger');
const { Vibrant } = require('node-vibrant/node');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
/**
 *
 * @param roleKey
 * @param imageCacheMap
 */
function getRoleIcon(roleKey, imageCacheMap) {
  const baseName = roleKey.toLowerCase();
  if (imageCacheMap.has(baseName)) {
    const filePath = path.join(__dirname, '../../../../../', imageCacheMap.get(baseName));
    if (fs.existsSync(filePath)) {
      logger.debug(`✅ Found image for "${baseName}" at ${filePath}`);
      return filePath;
    } else {
      logger.warn(`⚠️ Image file not found: ${filePath} (expected for ${baseName})`);
    }
  } else {
    logger.warn(`⚠️ No matching image found for role key: ${baseName}`);
  }
  return undefined;
}
/**
 *
 * @param roles
 * @param guild
 * @param existingRoleKeys
 * @param imageCacheMap
 * @param counters
 */
async function processRoles(roles, guild, existingRoleKeys, imageCacheMap, counters) {
  for (const roleData of roles) {
    const { roleKey, roleName } = roleData;
    const lookupKey = `role_${roleKey}`;
    logger.info(`Processing role "${roleName}" with key "${roleKey}" (lookupKey: ${lookupKey})`);
    const existingRole = guild.roles.cache.find(
      r => r.name.toLowerCase() === roleName.toLowerCase()
    );
    if (existingRole) {
      logger.info(`Role "${roleName}" already exists in the guild. Skipping creation.`);
      counters.alreadyExistsCount++;
      continue;
    }
    if (existingRoleKeys.has(lookupKey)) {
      logger.info(`Role "${roleName}" already exists in the database. Skipping creation.`);
      counters.alreadyExistsCount++;
      continue;
    }
    // Determine icon path for role
    const iconPath = roleData.filePath || getRoleIcon(roleKey, imageCacheMap);
    logger.debug(`Icon path for "${roleName}": ${iconPath}`);

    // Default fallback role color (Discord blurple)
    let roleColor = '#5865F2';

    // Helper function to calculate brightness (0 - dark, 255 - bright)
    const getBrightness = ([r, g, b]) => (r * 299 + g * 587 + b * 114) / 1000;

    // Helper function to determine if color is readable on Discord's themes
    const isReadableSwatch = swatch => {
      if (!swatch?.rgb) return false;
      const brightness = getBrightness(swatch.rgb);
      const [r, g, b] = swatch.rgb;
      const saturation = (Math.max(r, g, b) - Math.min(r, g, b)) / Math.max(r, g, b);
      return brightness >= 100 && brightness <= 200 && saturation >= 0.3;
    };

    if (iconPath) {
      try {
        logger.info(`Extracting color palette for "${roleName}" from ${iconPath}`);

        const palette = await Vibrant.from(iconPath).getPalette();

        logger.debug(`Palette extracted for "${roleName}": ${JSON.stringify(palette)}`);

        // Prioritize swatches by vibrancy and readability
        const swatchPriority = [
          palette.Vibrant,
          palette.LightVibrant,
          palette.Muted,
          palette.LightMuted,
          palette.DarkVibrant,
          palette.DarkMuted
        ];

        // Select the first readable swatch based on criteria
        const selectedSwatch =
          swatchPriority.find(isReadableSwatch) ||
          swatchPriority.find(swatch => swatch?.hex) ||
          null;

        if (selectedSwatch?.hex) {
          roleColor = selectedSwatch.hex;
          logger.info(`🎨 Selected readable color for "${roleName}": ${roleColor}`);
        } else {
          logger.warn(
            `⚠️ No suitable readable swatch found for "${roleName}". Using fallback color.`
          );
        }
      } catch (err) {
        logger.warn(
          `⚠️ Error extracting palette for "${roleName}": ${err.message}. Using fallback color.`
        );
      }
    } else {
      logger.warn(`⚠️ No icon available for "${roleName}". Using fallback color.`);
    }

    logger.info(
      `Attempting to create role "${roleName}" with color "${roleColor}"${iconPath ? ` and icon ${iconPath}` : ''}`
    );
    await sleep(3500);
    await createRoleWithRetry(
      roleData,
      guild,
      lookupKey,
      roleColor,
      iconPath,
      existingRoleKeys,
      counters
    );
  }
}
/**
 *
 * @param roleData
 * @param guild
 * @param lookupKey
 * @param roleColor
 * @param iconPath
 * @param existingRoleKeys
 * @param counters
 */
async function createRoleWithRetry(
  roleData,
  guild,
  lookupKey,
  roleColor,
  iconPath,
  existingRoleKeys,
  counters
) {
  const maxRetries = 3;
  let attempt = 0;
  while (attempt < maxRetries) {
    const startTime = Date.now();
    try {
      logger.debug(
        `Attempt ${attempt + 1}: Calling guild.roles.create for "${roleData.roleName}"...`
      );
      const serverBoostLevel = guild.premiumTier;
      let finalIconPath = iconPath;
      if (serverBoostLevel < 2) {
        finalIconPath = null;
        logger.info(
          `⚠️ Skipping role icon for "${roleData.roleName}" (Server Boost Level: ${serverBoostLevel}).`
        );
      }
      const creationPromise = guild.roles.create({
        name: roleData.roleName,
        color: roleColor,
        reason: 'Initializing guild roles',
        icon: finalIconPath
      });
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Role creation timed out after 5 seconds')), 5000)
      );
      const newRole = await Promise.race([creationPromise, timeoutPromise]);
      const elapsed = Date.now() - startTime;
      logger.debug(`guild.roles.create returned for "${roleData.roleName}" after ${elapsed} ms.`);
      existingRoleKeys.add(lookupKey);
      counters.createdCount++;
      await sleep(3500);
      logger.info(
        `✅ Successfully created role: "${newRole.name}" (Color: ${roleColor}) (Boost Level: ${serverBoostLevel})`
      );
      return;
    } catch (error) {
      const elapsed = Date.now() - startTime;
      if (error.retry_after) {
        logger.warn(
          `⚠️ Rate limited while creating role "${roleData.roleName}". Retry after ${error.retry_after} ms. (Elapsed: ${elapsed} ms)`
        );
        await sleep(error.retry_after);
      } else {
        logger.error(
          `❌ Error creating role "${roleData.roleName}" on attempt ${attempt + 1}: ${error.message} (Elapsed: ${elapsed} ms)`
        );
      }
      logger.debug(error.stack);
      attempt++;
    }
  }
  logger.error(`❌ Failed to create role "${roleData.roleName}" after ${maxRetries} attempts.`);
}
/**
 *
 * @param guild
 * @param imageCacheMap
 */
async function updateRolesWithIcons(guild, imageCacheMap) {
  if (guild.premiumTier < 2) {
    logger.info(`⚠️ Skipping role icon updates. Server Boost Level: ${guild.premiumTier}`);
    return;
  }
  logger.info(`🔄 Checking roles for missing icons (Server Boost Level: ${guild.premiumTier})...`);
  for (const role of guild.roles.cache.values()) {
    if (!role.icon) {
      const roleKey = role.name.toLowerCase().replace(/\s+/g, '_');
      const iconPath = getRoleIcon(roleKey, imageCacheMap);
      if (iconPath) {
        try {
          await role.setIcon(iconPath, 'Adding role icon after boost');
          logger.info(`✅ Updated role "${role.name}" with an icon after boosting.`);
        } catch (error) {
          logger.warn(`⚠️ Failed to update icon for role "${role.name}": ${error.message}`);
        }
      }
    }
  }
}
module.exports = {
  data: new SlashCommandBuilder()
    .setName('sync_roles')
    .setDescription('ADMIN: Initialize guild roles for skills, bosses, activities, and clan ranks.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
    try {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ flags: 64 });
      }
      const guild = interaction.guild;
      const existingDBRecords = await db.guild.getAll('SELECT role_key FROM guild_roles');
      const existingRoleKeys = new Set(existingDBRecords.map(record => record.role_key));
      logger.info(`Fetched ${existingRoleKeys.size} existing role keys from the database.`);
      const emojiData = await db.image.getAll('SELECT file_name, file_path FROM emojis');
      const rolesToCreate = emojiData.map(({ file_name }) => {
        const baseName = file_name.replace(/\.(png|jpg|jpeg|gif)$/, '').toLowerCase();
        return {
          roleKey: baseName,
          roleName: baseName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
        };
      });

      const unifiedImageData = [...emojiData];
      const imageCacheMap = new Map(
        unifiedImageData.map(({ file_name, file_path }) => [file_name.toLowerCase(), file_path])
      );
      logger.info(`Unified image cache created with ${imageCacheMap.size} entries.`);
      const counters = { createdCount: 0, alreadyExistsCount: 0 };
      await processRoles(rolesToCreate, guild, existingRoleKeys, imageCacheMap, counters);
      await updateRolesWithIcons(guild, imageCacheMap);
      const summary = `🎉 **Initialization Complete**
📌 **Total Roles Processed:** ${counters.createdCount + counters.alreadyExistsCount}
✅ Created: ${counters.createdCount}
⚠️ Already existed: ${counters.alreadyExistsCount}`;
      logger.info(summary);
      await interaction.editReply(summary);
    } catch (error) {
      logger.error(`❌ Error executing /init_guild_roles: ${error.message}`);
      await interaction.editReply(
        '❌ **Error:** An issue occurred while initializing guild roles.'
      );
    }
  }
};
