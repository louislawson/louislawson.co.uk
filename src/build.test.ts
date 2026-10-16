import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
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
