// @ts-check
import { defineConfig } from "astro/config";
import { site } from "./src/config/site.ts";
import { staticWebAppConfig } from "./src/integrations/staticwebapp-config.ts";

// https://astro.build/config
export default defineConfig({
  site: site.url,
  // The content security policy in public/staticwebapp.config.json allows no inline styles.
  build: { inlineStylesheets: "never" },
  // Nor may an asset be inlined: Vite turns any asset under this size into a data: URL, and Astro
  // inlines a processed script under it into the page. The policy blocks both.
  vite: { build: { assetsInlineLimit: 0 } },
  integrations: [staticWebAppConfig({ noindex: site.noindex })],
});
