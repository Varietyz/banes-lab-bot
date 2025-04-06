const fs = require("fs");
const path = require("path");
const logger = require("./modules/utils/essentials/logger");
const { registerModal } = require("./modules/utils/essentials/modalHandler");

const commands = [];
const functions = [];

/**
 * Recursively loads modules of a given type from the modules folder.
 * @param {string} type - The module type ("commands", "services", "events", or "modals").
 * @param {Discord.Client} client - The Discord client instance (needed for events and modals).
 * @returns {Array} - An array of loaded modules.
 */
function loadModules(type, client) {
  const folderPath = path.join(__dirname, `modules/${type}`);
  logger.info(`Loading modules of type '${type}' from ${folderPath}`);
  const loadedModules = [];
  const traverseDirectory = (currentPath) => {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        traverseDirectory(fullPath);
      } else if (entry.isFile() && entry.name.endsWith(".js")) {
        try {
          const module = require(fullPath);
          if (type === "commands") {
            if (!module.data || !module.data.description || !module.execute) {
              logger.error(
                `❌ Error: Invalid command in ${entry.name}. Missing 'description' or 'execute'.`
              );
              continue;
            }
            commands.push(module);
            logger.info(
              `✅ Loaded Command: ${module.data.name} from ${fullPath}`
            );
          } else if (type === "services") {
            functions.push(module);
            logger.info(
              `✅ Loaded Service: ${path.basename(entry.name, ".js")}`
            );
          } else if (type === "events") {
            if (!module.name) {
              logger.warn(
                `⚠️ Skipping event file ${entry.name} - missing event name.`
              );
              continue;
            }
            if (module.once) {
              client.once(module.name, (...args) =>
                module.execute(...args, client)
              );
            } else {
              client.on(module.name, (...args) =>
                module.execute(...args, client)
              );
            }
            logger.info(`✅ Loaded Event: ${module.name}`);
          } else if (type === "modals") {
            if (!module.modalId || !module.execute) {
              logger.warn(
                `⚠️ Skipping modal file ${entry.name} - missing modalId or execute function.`
              );
              continue;
            }
            registerModal(module.modalId, module.execute);
            logger.info(`✅ Registered Modal: ${module.modalId}`);
          }
          loadedModules.push(module);
        } catch (err) {
          logger.error(
            `❌ Error: Failed to load ${type} module from ${fullPath}: ${err.message}`
          );
        }
      }
    }
  };
  traverseDirectory(folderPath);
  return loadedModules;
}

module.exports = { loadModules, commands };
