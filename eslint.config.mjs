// SPDX-License-Identifier: MIT
// ESLint finds code mistakes (unused or undefined names, unreachable code); Prettier owns the layout. The scripts and
// tests run on Node; a tool's source runs in the sandbox's worker and names `register`, `ipc` and `tool` in its own
// `/* global */` line.
import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["node_modules/", "vendor/", "site/", "docs/assets/vendor/", "tools/*/tool.js"] },
  js.configs.recommended,
  {
    files: ["**/*.{js,mjs}"],
    languageOptions: { ecmaVersion: "latest", sourceType: "module", globals: { ...globals.node } },
    rules: { "no-unused-vars": ["error", { argsIgnorePattern: "^_", caughtErrors: "none" }] },
  },
  {
    files: ["tools/*/src/**/*.js", "lib/**/*.js"],
    languageOptions: { globals: { ...globals.worker } },
  },
  {
    files: ["docs/**/*.js"],
    languageOptions: { globals: { ...globals.browser } },
  },
];
