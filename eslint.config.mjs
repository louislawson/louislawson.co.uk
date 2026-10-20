import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import eslintPluginAstro from "eslint-plugin-astro";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig([
  globalIgnores([
    "dist/",
    "dist-e2e/",
    "test-results/",
    "playwright-report/",
    ".astro/",
    "node_modules/",
    ".impeccable/",
    "docs/design/mock/",
  ]),
  js.configs.recommended,
  tseslint.configs.recommended,
  eslintPluginAstro.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node } },
  },
  {
    // A classic script that runs in the browser, not under Node.
    files: ["src/scripts/shortcuts-state.js"],
    languageOptions: { globals: { ...globals.browser } },
  },
]);
