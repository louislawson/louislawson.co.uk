import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  buildCopy,
  copyOfProject,
  removeCopies,
} from "../../__tests__/project-copy";

// R04 has no measurements, so the table is built here from a copy of the project whose R04 has
// some. The demo figures exist only in the copy: nothing with a measurement is ever committed.
afterAll(removeCopies);

function buildCopyWithMeasurements(): string {
  const dir = copyOfProject("measured-build-");
  const file = join(dir, "src", "content", "projects", "this-website.md");
  const source = readFileSync(file, "utf-8");
  expect(source).toContain("\nstack:\n");
  writeFileSync(
    file,
    source.replace(
      "\nstack:\n",
      [
        "",
        "measurements:",
        "  - label: Demo time to environment",
        '    before: "8"',
        '    after: "2"',
        "    unit: hours",
        "  - label: Demo incidents caught before users",
        '    before: "70"',
        "    unit: '%'",
        "stack:",
        "",
      ].join("\n"),
    ),
  );
  const output = buildCopy(dir, { DEPLOY_CONTEXT: "production" });
  if (output !== "") throw new Error(`the build failed:\n${output}`);
  return readFileSync(
    join(dir, "dist", "projects", "this-website", "index.html"),
    "utf-8",
  );
}

describe("a production build of a project that has measurements", () => {
  let html = "";
  beforeAll(() => {
    html = buildCopyWithMeasurements();
  }, 90_000);
  const text = (fragment: string) =>
    fragment
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();

  it("heads the block measured and shows the table before the tools", () => {
    expect(html).toMatch(
      /<h2[^>]*\sid="project-details"[^>]*>\s*measured\s*<\/h2>/,
    );
    expect(html).not.toMatch(/<h2[^>]*>\s*tools\s*<\/h2>/);
    expect(html.match(/<table\b/g)).toHaveLength(1);
    expect(html.indexOf("</table>")).toBeLessThan(
      html.indexOf('aria-label="Tools used"'),
    );
  });

  it("shows a before-and-after row and a single figure, each with its unit", () => {
    const body = /<tbody\b[^>]*>(.*?)<\/tbody>/s.exec(html)?.[1] ?? "";
    const rows = [...body.matchAll(/<tr\b[^>]*>(.*?)<\/tr>/gs)].map((m) =>
      [...m[1]!.matchAll(/<t[hd]\b([^>]*)>(.*?)<\/t[hd]>/gs)].map((cell) => ({
        attributes: cell[1]!,
        text: text(cell[2]!),
      })),
    );
    expect(rows.map((row) => row.map((cell) => cell.text))).toEqual([
      ["Demo time to environment", "8 hours", "2 hours"],
      ["Demo incidents caught before users", "70%"],
    ]);
    expect(rows[1]![1]!.attributes).toContain('colspan="2"');
  });

  it("gives the table a caption only screen readers get, and no inline style", () => {
    expect(html).toMatch(
      /<caption[^>]*class="vh"[^>]*>\s*Before and after measurements\s*<\/caption>/,
    );
    expect(html).not.toMatch(/<[a-z][^>]*\sstyle\s*=/i);
  });
});
