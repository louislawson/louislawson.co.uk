import { describe, expect, it } from "vitest";
import config from "../astro.config.mjs";

describe("astro.config.mjs", () => {
  it("never inlines stylesheets, because the content security policy blocks inline styles", () => {
    // Astro inlines stylesheets under about 4 KB by default. A page that grew its first small
    // component would then ship an inline <style> that the policy refuses, and render unstyled.
    expect(config.build?.inlineStylesheets).toBe("never");
  });

  it("takes the site URL from the resolved site configuration", () => {
    expect(config.site).toMatch(/^https?:\/\/[^/]+$/);
  });
});
