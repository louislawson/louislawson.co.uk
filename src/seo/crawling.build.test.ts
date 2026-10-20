import {
  existsSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  buildCopy,
  copyOfProject,
  removeCopies,
} from "../__tests__/project-copy";
import type { DeployContext } from "../config/site";

// Real builds of a copy of the project, once for every pairing of `launch` and deploy context,
// checked as a crawler would meet them: the robots.txt it fetches first, and the sitemap it is
// pointed at. LAUNCH is flipped in the copy only; the repository's site.ts is never touched. The
// site URL is the test's own, so an address is checked to come from it and not from a default.
afterAll(removeCopies);

const SITE_URL = "https://example.test";
// Either value, so the test still finds its line once the launch PR has flipped it.
const LAUNCH_LINE = /const LAUNCH = (?:true|false);/;

const ALLOW_ALL = `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap-index.xml\n`;
const DISALLOW_ALL = "User-agent: *\nDisallow: /\n";

interface Built {
  robots: string;
  /** Every file of the build whose name says it is a sitemap. */
  sitemapFiles: string[];
  read: (file: string) => string;
}

/** Replaces text that must be there, so an edit that stopped matching fails instead of passing. */
function replaceOnce(path: string, from: RegExp, to: string): void {
  const source = readFileSync(path, "utf-8");
  expect(source, `${path} no longer holds ${from}`).toMatch(from);
  writeFileSync(path, source.replace(from, to));
}

/** A project entry, real or a placeholder the way the committed ones are. */
function project(opts: {
  code: string;
  featured: boolean;
  placeholder?: boolean;
}): string {
  const text = (real: string, todo: string) =>
    opts.placeholder ? `"TODO: ${todo}"` : real;
  return `---
code: ${opts.code}
title: ${text("Demo project", "project title")}
summary: ${text("A demo summary.", "one sentence on the result")}
headline: ${text("Demo headline", "a headline of two to five words")}
status: ${text("commissioning", "status")}
period: ${text('"2026"', "period")}
featured: ${opts.featured}
order: ${Number(opts.code.slice(1))}
kind: open-source
setup: ${text("A demo setup.", "where it started")}
change: ${text("A demo change.", "what you changed")}
result: ${text("A demo result.", "what is different now")}
stack:
  - ${text("Astro", "tools used")}
---

### how it works

${opts.placeholder ? "TODO: write the run sheet for this project." : "A demo write-up."}
`;
}

/**
 * Gives the copy what the launch gate requires, which a launched build refuses to start without:
 * the intro, career line, role line and LinkedIn link, a CV, and two real projects with the
 * featured one real. The copy's own projects are replaced by two demos and a placeholder, which
 * production leaves out, so the copy does not depend on what the committed content is by then.
 * None of it is committed.
 */
function makeLaunchable(dir: string): void {
  const profile = join(dir, "src", "data", "profile.ts");
  replaceOnce(profile, /roleLine: "[^"]*"/, 'roleLine: "A demo role"');
  replaceOnce(profile, /intro: "[^"]*"/, 'intro: "A demo introduction."');
  replaceOnce(profile, /careerLine: "[^"]*"/, 'careerLine: "A demo career"');
  replaceOnce(
    profile,
    /linkedin: "[^"]*"/,
    'linkedin: "https://www.linkedin.com/in/demo"',
  );
  replaceOnce(profile, /cv: "[^"]*"/, 'cv: "/cv.pdf"');
  writeFileSync(join(dir, "public", "cv.pdf"), "%PDF-1.4\n");

  const projects = join(dir, "src", "content", "projects");
  for (const file of readdirSync(projects)) rmSync(join(projects, file));
  const entries = [
    { slug: "demo-one", code: "R01", featured: true },
    { slug: "demo-two", code: "R02", featured: false },
    { slug: "demo-draft", code: "R03", featured: false, placeholder: true },
  ];
  for (const { slug, ...entry } of entries) {
    writeFileSync(join(projects, `${slug}.md`), project(entry));
  }
}

function build(launch: boolean, deployContext: DeployContext): Built {
  const dir = copyOfProject(`crawling-${launch}-${deployContext}-`);
  replaceOnce(
    join(dir, "src", "config", "site.ts"),
    LAUNCH_LINE,
    `const LAUNCH = ${launch};`,
  );
  if (launch) makeLaunchable(dir);
  // A local build is the one with no DEPLOY_CONTEXT: the workflow sets it only for the other two.
  const output = buildCopy(dir, {
    SITE_URL,
    DEPLOY_CONTEXT: deployContext === "local" ? "" : deployContext,
  });
  if (output !== "") throw new Error(`the build failed:\n${output}`);
  const dist = join(dir, "dist");
  const read = (file: string) => readFileSync(join(dist, file), "utf-8");
  return {
    robots: read("robots.txt"),
    sitemapFiles: readdirSync(dist, { recursive: true, encoding: "utf-8" })
      .filter((path) => /sitemap/i.test(path))
      .sort(),
    read,
  };
}

/** The addresses a sitemap lists, in the order it lists them. */
function locations(xml: string): string[] {
  return [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map((match) => match[1]);
}

describe("the source", () => {
  it("has no static robots.txt, which would shadow the one the build generates", () => {
    expect(existsSync(join(process.cwd(), "public", "robots.txt"))).toBe(false);
  });
});

describe.each<DeployContext>(["local", "preview", "production"])(
  "a %s build before launch",
  (deployContext) => {
    let built: Built;
    beforeAll(() => {
      built = build(false, deployContext);
    });

    it("disallows everything and names no sitemap", () => {
      expect(built.robots).toBe(DISALLOW_ALL);
      expect(built.robots).not.toMatch(/sitemap/i);
    });

    it("makes no sitemap", () => {
      expect(built.sitemapFiles).toEqual([]);
    });
  },
);

describe.each<DeployContext>(["local", "preview"])(
  "a %s build after launch",
  (deployContext) => {
    let built: Built;
    beforeAll(() => {
      built = build(true, deployContext);
    });

    it("still disallows everything and names no sitemap, so a preview stays out of search", () => {
      expect(built.robots).toBe(DISALLOW_ALL);
      expect(built.robots).not.toMatch(/sitemap/i);
    });

    it("still makes no sitemap", () => {
      expect(built.sitemapFiles).toEqual([]);
    });
  },
);

describe("a production build after launch", () => {
  let built: Built;
  beforeAll(() => {
    built = build(true, "production");
  });

  it("allows crawling and ends with the sitemap's absolute address, built from the site URL", () => {
    expect(built.robots).toBe(ALLOW_ALL);
    expect(built.robots.trimEnd().split("\n").at(-1)).toBe(
      `Sitemap: ${SITE_URL}/sitemap-index.xml`,
    );
  });

  it("makes the sitemap that robots.txt points at, and nothing else of the kind", () => {
    expect(built.sitemapFiles).toEqual(["sitemap-0.xml", "sitemap-index.xml"]);
    expect(locations(built.read("sitemap-index.xml"))).toEqual([
      `${SITE_URL}/sitemap-0.xml`,
    ]);
  });

  it("lists the home page and each project page, and neither the 404 nor a file that is not a page", () => {
    // The launchable copy has two real projects and a placeholder one, which production leaves out.
    expect(locations(built.read("sitemap-0.xml")).sort()).toEqual([
      `${SITE_URL}/`,
      `${SITE_URL}/projects/demo-one/`,
      `${SITE_URL}/projects/demo-two/`,
    ]);
  });
});
