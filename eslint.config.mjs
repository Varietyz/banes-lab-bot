// eslint.config.js
import js from "@eslint/js";
import node from "eslint-plugin-n";
import globals from "globals";

export default [
  js.configs.recommended,

  { languageOptions: { globals: { ...globals.node, ...globals.browser } } },
  // 🧠 Backend Rules — Node.js ONLY for Discord Bot
  {
    files: ["banes-lab-bot/**/*.js"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
      ecmaVersion: "latest",
      sourceType: "module",
    },
    plugins: { node },
    rules: {
      "node/no-missing-require": "error",
      "node/no-unpublished-require": "off",
      "node/no-deprecated-api": "error",
      "node/callback-return": "error",
      "node/exports-style": ["error", "module.exports"],
    },
  },

  // 🚫 Ignore specific paths (globally)
  {
    ignores: ["node_modules", "dist", "build", ".vscode/scripts/"],
  },
];
