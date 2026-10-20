import { readFileSync } from "node:fs";
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

  it("keeps the space between text and an inline element that a line break separates", () => {
    // Astro 7 defaults to "jsx", which drops a line break between text and an element, so prose
    // wrapped across lines ("... ground.\n<a>link</a>") loses its space. `true` keeps it.
    expect(config.compressHTML).toBe(true);
  });

  it("turns syntax highlighting off, because Shiki writes inline style attributes the content security policy blocks", () => {
    // A highlighted code block in a write-up would ship style="color:#..." on every token. With it
    // off, a code block is a plain <pre><code>, which the stylesheet colours from the tokens.
    expect(config.markdown?.syntaxHighlight).toBe(false);
  });

  it("tells Prettier the same whitespace rule, so formatting a page never changes what it renders", () => {
    // prettier-plugin-astro assumes Astro's default ("jsx") unless told otherwise, and would then
    // rejoin a line break that compressHTML: true shows as a space.
    const prettier = JSON.parse(
      readFileSync(new URL("../.prettierrc.json", import.meta.url), "utf-8"),
    );
    // Both accept the same rule under different spellings: true is "html" and false is "none",
    // and the plugin assumes Astro's default ("jsx") when the option is absent.
    const rule = (value: unknown) =>
      value === true ? "html" : value === false ? "none" : (value ?? "jsx");
    expect(rule(prettier.astroCompressHTML)).toBe(rule(config.compressHTML));
  });

  it("takes the site URL from the resolved site configuration", () => {
    expect(config.site).toMatch(/^https?:\/\/[^/]+$/);
  });
});
