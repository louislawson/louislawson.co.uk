import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  buildCopy,
  copyOfProject,
  removeCopies,
} from "../../__tests__/project-copy";

// The rules for a write-up are about Markdown that must never be committed, and a diagram is a file
// the project has none of, so each case is built from a copy of the project that has it. Nothing
// here exists outside the copies.
afterAll(removeCopies);

/** A valid project entry whose body is the one given, under the file name given. */
function entry(body: string): string {
  return [
    "---",
    "code: R09",
    "title: A project for a test",
    "summary: Work projects are anonymised.",
    "headline: Written for a build test",
    "status: complete",
    'period: "2025"',
    "featured: false",
    "order: 9",
    "kind: work",
    "descriptor: A UK public-sector body",
    "setup: Setup.",
    "change: Change.",
    "result: Result.",
    "stack: [Terraform]",
    "---",
    "",
    body,
    "",
  ].join("\n");
}

function buildWithEntry(body: string): string {
  const dir = copyOfProject("write-up-build-");
  const projects = join(dir, "src", "content", "projects");
  // The file an image names exists, so the rule is the only thing that can stop the build: Astro
  // fails first on an image it cannot find.
  mkdirSync(join(projects, "diagrams"));
  writeFileSync(join(projects, "diagrams", "anything.svg"), DIAGRAM);
  writeFileSync(join(projects, "bad-write-up.md"), entry(body));
  return buildCopy(dir);
}

describe("a build with a write-up that breaks a rule", () => {
  it("fails on a # heading, naming the file, the line and the level a write-up starts at", () => {
    const output = buildWithEntry("Words.\n\n# A second title\n");
    expect(output).toContain("src/content/projects/bad-write-up.md");
    expect(output).toContain("line 3");
    expect(output).toContain("# A second title");
    expect(output).toContain("###");
  });

  it("fails on a ## heading, because the page's h2 is # write-up", () => {
    const output = buildWithEntry("## Context\n\nWords.\n");
    expect(output).toContain("src/content/projects/bad-write-up.md");
    expect(output).toContain("line 1");
    expect(output).toContain("## Context");
  });

  it("fails on an image with empty alt text, naming the file, the line and the image", () => {
    const output = buildWithEntry(
      "### Context\n\n![](./diagrams/anything.svg)\n\nA caption.\n",
    );
    expect(output).toContain("src/content/projects/bad-write-up.md");
    expect(output).toContain("line 3");
    expect(output).toContain("./diagrams/anything.svg");
    expect(output).toContain("alt text");
  });
});

describe("a build of a project with no write-up", () => {
  it("has no write-up section, instead of a heading over nothing", () => {
    const dir = copyOfProject("write-up-build-");
    writeFileSync(
      join(dir, "src", "content", "projects", "no-write-up.md"),
      entry(""),
    );
    const output = buildCopy(dir);
    expect(output).toBe("");
    const html = readFileSync(
      join(dir, "dist", "projects", "no-write-up", "index.html"),
      "utf-8",
    );
    expect(html).toContain("A project for a test");
    expect(html).not.toContain('id="writeup"');
    expect(html).not.toMatch(/>\s*write-up\s*</);
  });
});

const DIAGRAM = [
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 120" width="320" height="120">',
  '  <rect width="320" height="120" fill="#151713"/>',
  '  <rect x="20" y="40" width="80" height="40" fill="none" stroke="#e9e7e0"/>',
  '  <rect x="220" y="40" width="80" height="40" fill="none" stroke="#ff6b1a"/>',
  '  <path d="M100 60h120" stroke="#a3a59b"/>',
  "</svg>",
  "",
].join("\n");

const WRITE_UP = [
  "Opening words with a [link](https://example.com/) and `inline code`.",
  "",
  "### Context",
  "",
  "- **First:** a point.",
  "- **Second:** another.",
  "",
  "```sh",
  "# build and test",
  "npm run build && npm test",
  "```",
  "",
  "![A box on the left joined by a line to a box on the right](./diagrams/demo.svg)",
  "",
  "The two boxes, and the line between them.",
  "",
  "### What I would do differently",
  "",
  "More words.",
].join("\n");

describe("a production build of a write-up with a code block and a diagram", () => {
  let dir = "";
  let output = "";
  let html = "";
  beforeAll(() => {
    dir = copyOfProject("write-up-build-");
    const projects = join(dir, "src", "content", "projects");
    mkdirSync(join(projects, "diagrams"));
    writeFileSync(join(projects, "diagrams", "demo.svg"), DIAGRAM);
    // R04's own body is replaced, so the page that is checked is the real one, built as production.
    const file = join(projects, "this-website.md");
    const source = readFileSync(file, "utf-8");
    const end = source.indexOf("\n---\n", 4) + "\n---\n".length;
    writeFileSync(file, `${source.slice(0, end)}\n${WRITE_UP}\n`);
    output = buildCopy(dir, { DEPLOY_CONTEXT: "production" });
    if (output !== "") throw new Error(`the build failed:\n${output}`);
    html = readFileSync(
      join(dir, "dist", "projects", "this-website", "index.html"),
      "utf-8",
    );
  });

  const prose = () =>
    /<div class="prose"[^>]*>(.*?)<\/div>\s*<\/div>\s*<\/section>/s.exec(
      html,
    )?.[1] ?? "";

  it("renders the write-up under the write-up heading, with ### as h3 and no h1 or h2 of its own", () => {
    expect(html).toMatch(/<h2[^>]*\sid="writeup"[^>]*>\s*write-up\s*<\/h2>/);
    const body = prose();
    expect(body).toBeTruthy();
    expect([...body.matchAll(/<h([1-6])\b/g)].map((m) => m[1])).toEqual([
      "3",
      "3",
    ]);
    expect(body).toMatch(/<h3[^>]*>Context<\/h3>/);
    expect(body).toMatch(/<h3[^>]*>What I would do differently<\/h3>/);
    expect(body).toContain("<strong>First:</strong>");
  });

  it("puts the write-up between the measured block and the link to the next project", () => {
    expect(html.indexOf('id="project-details"')).toBeLessThan(
      html.indexOf('id="writeup"'),
    );
  });

  it("renders a code block as a plain pre and code, with no style attribute and no highlighter's class", () => {
    expect(html).toMatch(/<pre\b[^>]*><code\b[^>]*>/);
    expect(prose()).toContain("npm run build &amp;&amp; npm test");
    expect(html).not.toMatch(/<[a-z][^>]*\sstyle\s*=/i);
    expect(html).not.toContain("astro-code");
    expect(html).not.toContain("shiki");
  });

  it("renders a diagram as an image with its alt text, served from the site's own files", () => {
    const image = /<img\b[^>]*>/.exec(prose())?.[0] ?? "";
    expect(image).toContain(
      'alt="A box on the left joined by a line to a box on the right"',
    );
    const src = /\ssrc="([^"]+)"/.exec(image)?.[1] ?? "";
    expect(src).toMatch(/^\/_astro\/demo\.[\w-]+\.svg$/);
    expect(existsSync(join(dir, "dist", src))).toBe(true);
    // Not a data: URL, which the content security policy blocks.
    expect(image).not.toMatch(/data:/);
  });

  it("follows the image with its caption, the paragraph after it", () => {
    const body = prose();
    const image = body.indexOf("<img");
    const caption = body.indexOf("The two boxes, and the line between them.");
    expect(image).toBeGreaterThan(-1);
    expect(caption).toBeGreaterThan(image);
    // Nothing sits between the image's paragraph and the caption's.
    expect(body.slice(image, caption)).toMatch(/^<img[^>]*><\/p>\s*<p>$/);
  });
});
