/** Where @astrojs/sitemap writes the index of the sitemap files. */
export const SITEMAP_PATH = "/sitemap-index.xml";

/**
 * The robots.txt for a build. `noindex` is the one rule in config/site.ts that decides whether a
 * build may be indexed: crawling follows it, so an indexable build allows crawling and names its
 * sitemap, and every other build disallows everything and names none (it has no sitemap).
 */
export function robotsTxt(opts: { noindex: boolean; siteUrl: string }): string {
  if (opts.noindex) return "User-agent: *\nDisallow: /\n";
  const sitemap = new URL(SITEMAP_PATH, opts.siteUrl).href;
  return `User-agent: *\nAllow: /\n\nSitemap: ${sitemap}\n`;
}
