const { cleanupInactiveUsers } = require("./modules/services/webUtils/cleaner");

require("dotenv").config();
module.exports = [
  {
    name: "clean_up",
    func: async () => {
      await cleanupInactiveUsers();
    },
    interval: 60 * 60,
    runOnStart: true,
    runAsTask: true,
  },
];
