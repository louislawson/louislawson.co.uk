import { execFileSync } from "node:child_process";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// The shipped pages have no wrapped prose yet, so this builds a copy of the project with one page
// that has some, written the way Prettier wraps it, and reads what a deployment would serve.
const root = process.cwd();
const copies: string[] = [];

afterAll(() => {
  for (const dir of copies) rmSync(dir, { recursive: true, force: true });
});

function buildWithProsePage(): string {
  const dir = mkdtempSync(join(tmpdir(), "whitespace-build-"));
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
  mkdirSync(join(dir, "src", "pages"), { recursive: true });
  writeFileSync(
    join(dir, "src", "pages", "prose.astro"),
    [
      "---",
      'import Base from "../layouts/Base.astro";',
      "---",
      "",
      '<Base title="Prose" sections={[{ id: "projects", number: 1 }]}>',
      "  <p>",
      "    Body text that ends a line.",
      '    <a href="/somewhere">An ordinary link</a>',
      "    and more text, then a",
      "    <kbd>1</kbd>",
      "    key hint.",
      "  </p>",
      "</Base>",
      "",
    ].join("\n"),
  );
  execFileSync(
    process.execPath,
    [join(dir, "node_modules", "astro", "bin", "astro.mjs"), "build"],
    {
      cwd: dir,
      env: { ...process.env, DEPLOY_CONTEXT: "", SITE_URL: "" },
      stdio: "pipe",
    },
  );
  // As a browser lays it out: any run of whitespace is one space.
  return readFileSync(
    join(dir, "dist", "prose", "index.html"),
    "utf-8",
  ).replace(/\s+/g, " ");
}

describe("a built page with prose wrapped across lines", () => {
  let html = "";
  beforeAll(() => {
    html = buildWithProsePage();
  });

  it("keeps a space on each side of a link and of a key hint", () => {
    expect(html).toContain(
      'that ends a line. <a href="/somewhere">An ordinary link</a> and more text',
    );
    expect(html).toContain("then a <kbd>1</kbd> key hint.");
  });

  it("keeps a navigation hint against its label, with no space between", () => {
    expect(html).toMatch(/<kbd[^>]*>1<\/kbd>projects<\/a>/);
  });

  // The copy has no .git, as a build from a source archive has none, so git cannot give a date.
  it("builds, with a footer that leaves out the updated date, where there is no git history", () => {
    expect(html).toContain("<footer");
    expect(html).toContain("no cookies, no tracking");
    expect(html).not.toContain("updated ");
  });
});
