import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { placeholderHint } from "./todo";

const folder = new URL("./projects/", import.meta.url);

/** The frontmatter line `status: …` of each project file, with the file's name. */
function statuses(): { file: string; value: string }[] {
  return readdirSync(folder)
    .filter((name) => name.endsWith(".md"))
    .flatMap((file) => {
      const text = readFileSync(new URL(file, folder), "utf-8");
      const match = /^status:\s*["']?(.*?)["']?\s*$/m.exec(text);
      return match ? [{ file, value: match[1]! }] : [];
    });
}

describe("the placeholder statuses in the project files", () => {
  it("are found: there is a status line in every project file", () => {
    const files = readdirSync(folder).filter((name) => name.endsWith(".md"));
    expect(statuses().map((s) => s.file)).toEqual(files);
  });

  it("are short, so a hatched one fits the status cell of a compact row instead of wrapping over lines", () => {
    // The schema's own error message lists the four allowed values, so the placeholder need not.
    const placeholders = statuses().filter((s) => s.value.startsWith("TODO:"));
    expect(placeholders.length).toBeGreaterThan(0);
    for (const { file, value } of placeholders) {
      expect(placeholderHint(value).length, file).toBeLessThanOrEqual(12);
    }
  });
});
