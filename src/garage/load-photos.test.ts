import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// load-photos.ts is the thin part that needs Astro and Vite, so it is held to its rules by reading
// it: how the photos are found is what makes them findable at all.
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

  it("finds the photos with two import.meta.glob calls: their metadata and their bytes", () => {
    expect(globs).toHaveLength(2);
    expect(code).toContain('import: "default"');
    expect(code.match(/query:\s*"\?inline"/g)).toHaveLength(1);
  });

  it("gives each a string literal for the pattern, because Vite does not see one held in a variable", () => {
    for (const pattern of globs) expect(pattern).toMatch(/^"[^"]+"$/);
  });

  it("looks only in src/assets/garage, for the same files both times", () => {
    expect(new Set(globs).size).toBe(1);
    expect(globs[0]).toMatch(/^"\/src\/assets\/garage\/\*\.\{[a-z,]+\}"$/);
  });

  it("does not read a path off an image object, which Astro hides", () => {
    expect(code).not.toMatch(/fsPath/);
  });

  it("makes the optimised copy with Astro's getImage, as webp, never wider than the photo", () => {
    expect(code).toMatch(/getImage\(/);
    expect(code).toContain('format: "webp"');
    expect(code).toMatch(/Math\.min\(photo\.width/);
  });
});
