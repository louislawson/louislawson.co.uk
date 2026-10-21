import { readFile, writeFile } from "node:fs/promises";
import type { AstroIntegration } from "astro";
import {
  buildStaticWebAppConfig,
  type StaticWebAppConfig,
} from "../config/staticwebapp";

/**
 * Writes the final dist/staticwebapp.config.json: the committed baseline from public/ plus the
 * build-dependent X-Robots-Tag header and the content security policy's Trusted Types rules and,
 * for a build with the analytics beacon, its Cloudflare sources. Wiring only; the decision lives
 * in config/site.ts and the header logic in config/staticwebapp.ts, both unit-tested.
 */
export function staticWebAppConfig(opts: {
  noindex: boolean;
  beacon: boolean;
}): AstroIntegration {
  return {
    name: "static-web-app-config",
    hooks: {
      "astro:build:done": async ({ dir }) => {
        const file = new URL("staticwebapp.config.json", dir);
        const baseline = JSON.parse(
          await readFile(file, "utf-8"),
        ) as StaticWebAppConfig;
        const config = buildStaticWebAppConfig(baseline, opts);
        await writeFile(file, `${JSON.stringify(config, null, 2)}\n`);
      },
    },
  };
}
