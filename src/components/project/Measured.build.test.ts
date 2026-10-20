import { execFileSync } from "node:child_process";
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// R04 has no measurements, so the table is built here from a copy of the project whose R04 has
// some. The demo figures exist only in the copy: nothing with a measurement is ever committed.
const root = process.cwd();
const copies: string[] = [];

afterAll(() => {
  for (const dir of copies) rmSync(dir, { recursive: true, force: true });
});

function buildCopyWithMeasurements(): string {
  const dir = mkdtempSync(join(tmpdir(), "measured-build-"));
  copies.push(dir);
  for (const path of [
    "src",
    "public",
    "astro.config.mjs",
    "tsconfig.json",
    "package.json",
  ]) {
    cpSync(join(root, path), join(dir, path), { recursive: true });
  }
  // A junction needs no elevated rights on Windows, unlike a symbolic link to a directory.
  symlinkSync(
    join(root, "node_modules"),
    join(dir, "node_modules"),
    "junction",
  );
  // Astro keeps the content it has read in node_modules/.astro, which the junction shares with the
  // real project: the demo figures would be read back by every other build. The copy keeps its own.
  const config = join(dir, "astro.config.mjs");
  const configSource = readFileSync(config, "utf-8");
  expect(configSource).toContain("defineConfig({");
  writeFileSync(
    config,
    configSource.replace(
      "defineConfig({",
      'defineConfig({\n  cacheDir: "./.cache",',
    ),
  );
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
  execFileSync(
    process.execPath,
    [join(dir, "node_modules", "astro", "bin", "astro.mjs"), "build"],
    {
      cwd: dir,
      env: { ...process.env, DEPLOY_CONTEXT: "production", SITE_URL: "" },
      stdio: "pipe",
      // A synchronous call cannot be interrupted by the test timeout, so a hung build needs its own.
      timeout: 80_000,
    },
  );
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
    expect(html).toMatch(/<h2[^>]*\sid="measured"[^>]*>\s*measured\s*<\/h2>/);
    expect(html).not.toMatch(/<h2[^>]*\sid="tools"/);
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
