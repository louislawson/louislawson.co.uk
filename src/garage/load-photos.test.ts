import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// load-photos.ts is the thin part that needs Astro and Vite, so it is held to its rules by reading
// it: how the photos are found, and how they are read, decides whether an original is published.
const source = readFileSync(
  new URL("./load-photos.ts", import.meta.url),
  "utf-8",
);
// Comments out, but only whole comment lines and blocks: a glob pattern holds "/*" in a string.
const code = source
  .replace(/^\s*\/\*\*[\s\S]*?\*\/\s*$/gm, "")
  .replace(/^\s*\/\/.*$/gm, "");

describe("load-photos.ts", () => {
  const globs = [
    ...code.matchAll(/import\.meta\.glob(?:<[^>]*>)?\(\s*("[^"]*"|[^,)\s]+)/g),
  ].map((m) => m[1]!.trim());

  it("finds the photos with one import.meta.glob call, for the image imports and nothing else", () => {
    expect(globs).toHaveLength(1);
    expect(code).toContain('import: "default"');
  });

  it("gives it a string literal for the pattern, because Vite does not see one held in a variable", () => {
    expect(globs[0]).toMatch(/^"[^"]+"$/);
  });

  it("looks only in src/assets/garage", () => {
    expect(globs[0]).toMatch(/^"\/src\/assets\/garage\/\*\.\{[a-z,]+\}"$/);
  });

  it("imports no photo with a query, which Astro takes as a use of the original and publishes it", () => {
    expect(code).not.toMatch(/query\s*:/);
    expect(code).not.toMatch(/\?(?:inline|raw|url|no-inline)/);
  });

  it("reads each file from the project's root by the path the glob gives, with a plain read", () => {
    expect(code).toMatch(/from "astro:config\/server"/);
    expect(code).toMatch(/\broot\b/);
    expect(code).toMatch(/readFile\(/);
  });

  it("does not read a path off an image object, which Astro hides", () => {
    expect(code).not.toMatch(/fsPath/);
  });

  it("makes the optimised copy with Astro's getImage, as webp, never wider than the photo", () => {
    expect(code).toMatch(/getImage\(/);
    expect(code).toContain('format: "webp"');
    expect(code).toMatch(/Math\.min\(photo\.width/);
  });

  it("reads no image's src, which Astro takes as a use of the original too", () => {
    // The address of the optimised copy that getImage returns is a plain string and may be read.
    expect(code).not.toMatch(/\b(?:photo|image|images)(?:\[[^\]]*\])?\.src\b/);
  });
});
