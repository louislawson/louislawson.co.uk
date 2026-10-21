// @ts-check
import sitemap from "@astrojs/sitemap";
import { defineConfig } from "astro/config";
import { site } from "./src/config/site.ts";
import { staticWebAppConfig } from "./src/integrations/staticwebapp-config.ts";

// https://astro.build/config
export default defineConfig({
  site: site.url,
  // Astro 7 defaults to "jsx", which drops the line break between text and an inline element. The
  // pages are prose with inline links, placeholders and key hints, so wrapped text would lose its
  // spaces. `true` compresses the HTML and keeps the single space the browser would show.
  compressHTML: true,
  // The content security policy in public/staticwebapp.config.json allows no inline styles.
  build: { inlineStylesheets: "never" },
  // Nor may an asset be inlined: Vite turns any asset under this size into a data: URL, and Astro
  // inlines a processed script under it into the page. The policy blocks both.
  vite: { build: { assetsInlineLimit: 0 } },
  // Shiki, the default highlighter, writes a style attribute on every token of a code block, which
  // the policy blocks. A write-up's code is plain monospace on the panel colour instead.
  markdown: { syntaxHighlight: false },
  integrations: [
    staticWebAppConfig({
      noindex: site.noindex,
      beacon: site.beaconToken !== undefined,
    }),
    // Only a build that may be indexed has a sitemap; robots.txt (src/pages/robots.txt.ts) follows
    // the same rule. The integration leaves out the 404 page on its own.
    ...(site.noindex ? [] : [sitemap()]),
  ],
});
