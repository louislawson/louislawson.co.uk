import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Runs the real Astro build once per deploy context and checks what a deployment would serve.
const astro = join(process.cwd(), "node_modules", "astro", "bin", "astro.mjs");
const outDirs: string[] = [];

function build(env: Record<string, string>): string {
  const outDir = mkdtempSync(join(tmpdir(), "site-build-"));
  outDirs.push(outDir);
  execFileSync(process.execPath, [astro, "build", "--outDir", outDir], {
    env: { ...process.env, DEPLOY_CONTEXT: "", SITE_URL: "", ...env },
    stdio: "pipe",
  });
  return outDir;
}

function read(dir: string, file: string): string {
  return readFileSync(join(dir, file), "utf-8");
}

afterAll(() => {
  for (const dir of outDirs) rmSync(dir, { recursive: true, force: true });
});

/** The file names directly inside one folder of a build. */
function listing(dir: string, folder: string): string[] {
  return readdirSync(join(dir, folder));
}

/** Every page and stylesheet of a build: what the content security policy applies to. */
function pagesAndStyles(dir: string): Record<string, string> {
  const files: Record<string, string> = {};
  for (const page of ["index.html", "404.html"]) files[page] = read(dir, page);
  for (const name of listing(dir, "_astro")) {
    if (name.endsWith(".css"))
      files[`_astro/${name}`] = read(dir, `_astro/${name}`);
  }
  return files;
}

// What the content security policy refuses is a style attribute in a tag, and a data: URL where a
// URL is expected. The checks look for those, not for the words in prose or in an attribute value.
const STYLE_ATTRIBUTE = /<[a-z][^>]*\sstyle\s*=/i;
const DATA_URL =
  /(?:url\(\s*|\b(?:src|href|srcset|poster|action)\s*=\s*)["']?data:/i;
// A request for something the page needs to render: a stylesheet or font in a link, or a CSS
// import or url(). A link to another site (an anchor, a canonical URL) is not one.
const EXTERNAL_RESOURCE =
  /<link\b[^>]*\brel="(?:stylesheet|preload|preconnect|dns-prefetch|prefetch|modulepreload)"[^>]*\bhref="https?:\/\/|<link\b[^>]*\bhref="https?:\/\/[^>]*\brel="(?:stylesheet|preload|preconnect|dns-prefetch|prefetch|modulepreload)"|(?:@import\s+(?:url\()?|url\(\s*)["']?https?:\/\//i;

describe("the checks on a build", () => {
  it("flag a style attribute, a data: URL and an external resource", () => {
    expect('<p style="color:red">x</p>').toMatch(STYLE_ATTRIBUTE);
    expect('<p class="a" style = "x">x</p>').toMatch(STYLE_ATTRIBUTE);
    expect("a{background:url(data:image/png;base64,AAAA)}").toMatch(DATA_URL);
    expect('<img src="data:image/png;base64,AAAA">').toMatch(DATA_URL);
    expect(
      '<link rel="stylesheet" href="https://fonts.googleapis.com/css2">',
    ).toMatch(EXTERNAL_RESOURCE);
    expect('<link href="https://fonts.gstatic.com" rel="preconnect">').toMatch(
      EXTERNAL_RESOURCE,
    );
    expect('@import url("https://example.com/a.css");').toMatch(
      EXTERNAL_RESOURCE,
    );
    expect("src:url(https://example.com/a.woff2)").toMatch(EXTERNAL_RESOURCE);
  });

  it("leave prose, ordinary links and the site's own files alone", () => {
    const page =
      '<p>data: this is prose, and so is style = this</p><a href="https://github.com/louislawson/louislawson.co.uk">source</a><link rel="canonical" href="https://louislawson.co.uk/"><link rel="preload" href="/_astro/a.woff2" as="font"><link rel="stylesheet" href="/_astro/a.css"><div data-style="x" aria-label="style">y</div>';
    expect(page).not.toMatch(STYLE_ATTRIBUTE);
    expect(page).not.toMatch(DATA_URL);
    expect(page).not.toMatch(EXTERNAL_RESOURCE);
    expect("src:url(a.woff2) format('woff2')").not.toMatch(EXTERNAL_RESOURCE);
  });
});

describe.each(["preview", "production"])("a %s build", (deployContext) => {
  let dir = "";
  beforeAll(() => {
    dir = build({ DEPLOY_CONTEXT: deployContext });
  });

  it("sends noindex in the generated config while the site is not launched", () => {
    const config = JSON.parse(read(dir, "staticwebapp.config.json"));
    expect(config.globalHeaders["X-Robots-Tag"]).toBe("noindex");
  });

  it("keeps the baseline security headers in the generated config", () => {
    const config = JSON.parse(read(dir, "staticwebapp.config.json"));
    expect(config.globalHeaders["Content-Security-Policy"]).toContain(
      "default-src 'self'",
    );
    expect(config.responseOverrides["404"].rewrite).toBe("/404.html");
  });

  it("puts a noindex meta tag in the pages", () => {
    expect(read(dir, "index.html")).toContain(
      '<meta name="robots" content="noindex">',
    );
    expect(read(dir, "404.html")).toContain(
      '<meta name="robots" content="noindex">',
    );
  });

  it("inlines no stylesheet or script, which the content security policy would block", () => {
    for (const page of ["index.html", "404.html"]) {
      const html = read(dir, page);
      expect(html).not.toMatch(/<style[\s>]/);
      expect(html).not.toMatch(/<script(?![^>]*\ssrc=)[^>]*>/);
    }
  });

  it("has no style attribute and no data: URL in a page or a stylesheet", () => {
    const files = pagesAndStyles(dir);
    expect(Object.keys(files).some((name) => name.endsWith(".css"))).toBe(true);
    for (const [name, text] of Object.entries(files)) {
      expect(text, name).not.toMatch(STYLE_ATTRIBUTE);
      expect(text, name).not.toMatch(DATA_URL);
    }
  });

  it("makes no external font or stylesheet request", () => {
    for (const [name, text] of Object.entries(pagesAndStyles(dir))) {
      expect(text, name).not.toMatch(EXTERNAL_RESOURCE);
      expect(text, name).not.toMatch(/fonts\.(googleapis|gstatic)\.com/);
    }
  });

  it("serves Martian Mono from the site and preloads the Latin file the page needs", () => {
    const css = Object.entries(pagesAndStyles(dir))
      .filter(([name]) => name.endsWith(".css"))
      .map(([, text]) => text)
      .join("\n");
    expect(css).toContain("Martian Mono Variable");

    const html = read(dir, "index.html");
    const preload = /<link rel="preload"[^>]*>/.exec(html)?.[0] ?? "";
    expect(preload).toContain('as="font"');
    expect(preload).toContain('type="font/woff2"');
    // A font preload without crossorigin is fetched twice, because font requests are CORS-mode.
    expect(preload).toContain("crossorigin");

    const href = /href="([^"]+)"/.exec(preload)?.[1] ?? "";
    expect(href).toMatch(
      /^\/_astro\/martian-mono-latin-wdth-normal\.[\w-]+\.woff2$/,
    );
    // The preload names the very file the stylesheet loads, so it is used, not just fetched.
    expect(css).toContain(href.replace("/_astro/", ""));
    expect(listing(dir, "_astro")).toContain(href.replace("/_astro/", ""));
  });
});

describe("a build with an unknown DEPLOY_CONTEXT", () => {
  it("fails, naming the value", () => {
    let stderr = "";
    try {
      build({ DEPLOY_CONTEXT: "staging" });
    } catch (error) {
      stderr = String((error as { stderr?: Buffer }).stderr ?? "");
    }
    expect(stderr).toContain("staging");
  });
});
