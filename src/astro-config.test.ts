import { describe, expect, it } from "vitest";
import config from "../astro.config.mjs";

describe("astro.config.mjs", () => {
  it("never inlines stylesheets, because the content security policy blocks inline styles", () => {
    // Astro inlines stylesheets under about 4 KB by default. A page that grew its first small
    // component would then ship an inline <style> that the policy refuses, and render unstyled.
    expect(config.build?.inlineStylesheets).toBe("never");
  });

  it("inlines no asset, because the content security policy blocks inline scripts and data: URLs", () => {
    // Vite inlines any asset under assetsInlineLimit (4 KB by default). Astro does the same for a
    // processed script, which would then ship inline, and a small CSS asset becomes a data: URL.
    expect(config.vite?.build?.assetsInlineLimit).toBe(0);
  });

  it("takes the site URL from the resolved site configuration", () => {
    expect(config.site).toMatch(/^https?:\/\/[^/]+$/);
  });
});
