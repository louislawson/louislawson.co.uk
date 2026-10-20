import type { APIRoute } from "astro";
import { robotsTxt } from "../config/robots";
import { site } from "../config/site";

// Made at build, so it follows the build's noindex rule. There is deliberately no public/robots.txt:
// a static file would be the same in every build, and a preview would then invite crawlers in.
// The address is Astro's own `site`, the one @astrojs/sitemap writes into the sitemap, so the
// Sitemap: line and the sitemap cannot name different origins.
export const GET: APIRoute = ({ site: origin }) => {
  if (origin === undefined) throw new Error("astro.config.mjs sets no site");
  return new Response(
    robotsTxt({ noindex: site.noindex, siteUrl: origin.href }),
    { headers: { "Content-Type": "text/plain; charset=utf-8" } },
  );
};
