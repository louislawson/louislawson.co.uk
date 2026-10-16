// @ts-check
import { defineConfig } from "astro/config";
import { site } from "./src/config/site.ts";
import { staticWebAppConfig } from "./src/integrations/staticwebapp-config.ts";

// https://astro.build/config
export default defineConfig({
  site: site.url,
  // The content security policy in public/staticwebapp.config.json allows no inline styles.
  build: { inlineStylesheets: "never" },
  integrations: [staticWebAppConfig({ noindex: site.noindex })],
});
