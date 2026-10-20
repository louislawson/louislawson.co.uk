import { describe, expect, it } from "vitest";
import { robotsTxt, SITEMAP_PATH } from "./robots";

describe("robotsTxt", () => {
  it("allows crawling and ends with the sitemap's absolute address when the build is indexable", () => {
    expect(robotsTxt({ noindex: false, siteUrl: "https://example.test" })).toBe(
      "User-agent: *\nAllow: /\n\nSitemap: https://example.test/sitemap-index.xml\n",
    );
  });

  it("disallows everything, and names no sitemap, when the build is not indexable", () => {
    expect(robotsTxt({ noindex: true, siteUrl: "https://example.test" })).toBe(
      "User-agent: *\nDisallow: /\n",
    );
  });

  it("builds the sitemap address from the site URL, whatever its scheme or port", () => {
    const body = robotsTxt({
      noindex: false,
      siteUrl: "http://localhost:4321",
    });
    expect(body.trimEnd().split("\n").at(-1)).toBe(
      "Sitemap: http://localhost:4321/sitemap-index.xml",
    );
  });

  it("points at the index file @astrojs/sitemap writes", () => {
    expect(SITEMAP_PATH).toBe("/sitemap-index.xml");
  });
});
