import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Pins which changes make deploy.yml run: a push to main deploys production, a pull request gets a
// preview. The filters are read from the workflow file itself and applied the way GitHub applies
// them, so a change to a filter is tested, not just a string in it.

const repository = fileURLToPath(new URL("../", import.meta.url));
const deploy = readFileSync(
  join(repository, ".github/workflows/deploy.yml"),
  "utf-8",
);
const readme = readFileSync(join(repository, "README.md"), "utf-8");

/** The `paths:` list of one trigger, in order, with its quotes removed. */
function pathFilter(event: "push" | "pull_request"): string[] {
  const lines = deploy.split("\n");
  const start = lines.indexOf(`  ${event}:`);
  const paths = lines.indexOf("    paths:", start);
  const patterns: string[] = [];
  for (const line of lines.slice(paths + 1)) {
    const item = /^ {6}- (.+)$/.exec(line);
    if (item) patterns.push(item[1]!.replace(/^["']|["']$/g, ""));
    else if (!/^\s*(#.*)?$/.test(line)) break;
  }
  return patterns;
}

/** GitHub's path globs: a double star crosses folders (and may match none), a single star stays in one. */
function globToRegExp(glob: string): RegExp {
  let source = "";
  for (let i = 0; i < glob.length; i++) {
    const char = glob[i]!;
    if (char === "*" && glob[i + 1] === "*") {
      if (glob[i + 2] === "/") {
        source += "(?:.*/)?";
        i += 2;
      } else {
        source += ".*";
        i += 1;
      }
    } else if (char === "*") {
      source += "[^/]*";
    } else if (char === "?") {
      source += "[^/]";
    } else {
      source += char.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    }
  }
  return new RegExp(`^${source}$`);
}

/** Whether a changed file makes the trigger fire: patterns in order, the last match wins. */
function fires(patterns: string[], path: string): boolean {
  let included = false;
  for (const pattern of patterns) {
    const negated = pattern.startsWith("!");
    if (globToRegExp(negated ? pattern.slice(1) : pattern).test(path)) {
      included = !negated;
    }
  }
  return included;
}

describe("a push to main", () => {
  const push = pathFilter("push");

  it.each([
    "src/pages/index.astro",
    "src/content/schema.ts",
    // The schemas import it, so the build reads it.
    "src/content/todo.ts",
    "src/data/profile.ts",
    "src/content/projects/this-website.md",
    "public/staticwebapp.config.json",
    "package.json",
    "astro.config.mjs",
    ".github/workflows/deploy.yml",
    ".github/actions/swa-client/action.yml",
  ])("deploys production for a change to %s, which the build reads", (path) => {
    expect(fires(push, path)).toBe(true);
  });

  it.each([
    "scripts/placeholders.ts",
    "scripts/check-metadata.ts",
    "scripts/build-e2e.ts",
    // The Playwright tests, server and config check the built site; they are not part of it.
    "e2e/smoke.spec.ts",
    "e2e/serve.ts",
    "playwright.config.ts",
    // The settings of the HTML and link checks, which read the built site and are not part of it.
    "lychee.toml",
    ".htmlvalidate.mjs",
    ".github/workflows/links.yml",
    // The server's rules, which only the e2e server and its tests use.
    "src/e2e/rules.ts",
    "src/e2e/rules.test.ts",
    "src/e2e/NOTES.md",
    "src/metadata/image.ts",
    "src/metadata/pdf.ts",
    "src/metadata/__fixtures__/pdf.ts",
    "src/metadata/image.test.ts",
    // The helper the build tests share, which only they import.
    "src/__tests__/project-copy.ts",
    // Markdown under src/ is content, but not under src/metadata/: the later re-include of
    // src/**/*.md must not win over the exclusion.
    "src/metadata/NOTES.md",
    // Only scripts/placeholders.ts and its test use it.
    "src/content/list-placeholders.ts",
    "src/content/validate.test.ts",
    "README.md",
    "docs/BUILD-PLAN.md",
    "infra/site/main.tf",
    ".github/workflows/ci.yml",
  ])(
    "does not deploy for a change to %s, which the build does not read",
    (path) => {
      expect(fires(push, path)).toBe(false);
    },
  );
});

describe("a pull request", () => {
  const pullRequest = pathFilter("pull_request");

  it.each([
    "src/pages/index.astro",
    "src/content/todo.ts",
    "src/content/schema.ts",
    "src/content/projects/this-website.md",
    "public/staticwebapp.config.json",
    "package.json",
    ".github/workflows/deploy.yml",
  ])("gets a preview for a change to %s", (path) => {
    expect(fires(pullRequest, path)).toBe(true);
  });

  it.each([
    "src/metadata/image.ts",
    "src/metadata/check.ts",
    "src/metadata/NOTES.md",
    "src/metadata/__fixtures__/containers.ts",
    "src/__tests__/project-copy.ts",
    "src/content/list-placeholders.ts",
    "src/content/schema.test.ts",
    "src/e2e/rules.ts",
    "e2e/smoke.spec.ts",
    "playwright.config.ts",
    "lychee.toml",
    ".htmlvalidate.mjs",
    ".github/workflows/links.yml",
    "scripts/check-metadata.ts",
    "docs/BUILD-PLAN.md",
  ])("does not get a preview for a change to %s", (path) => {
    expect(fires(pullRequest, path)).toBe(false);
  });
});

// The exclusions above rest on one fact: nothing the build reads imports what is excluded. If a
// page ever imported src/metadata/ or src/content/list-placeholders.ts, a push that changed only
// that file would skip the deploy, and production would silently stay on the old build.
describe("what the build reads", () => {
  const EXTENSIONS = new Set([".ts", ".mjs", ".astro"]);
  const IMPORT = /(?:from|import)\s*\(?\s*["'](\.{1,2}\/[^"']+)["']/g;

  function filesUnder(dir: string): string[] {
    return readdirSync(join(repository, dir)).flatMap((name) => {
      const path = `${dir}/${name}`;
      if (statSync(join(repository, path)).isDirectory())
        return filesUnder(path);
      return EXTENSIONS.has(name.slice(name.lastIndexOf("."))) ? [path] : [];
    });
  }

  /** The file a relative import points at, as a path from the repository root. */
  function resolve(from: string, specifier: string): string | undefined {
    const base = join(dirname(join(repository, from)), specifier);
    const candidates = [
      base,
      base.replace(/\.js$/, ".ts"),
      `${base}.ts`,
      `${base}.astro`,
      `${base}.mjs`,
      join(base, "index.ts"),
    ];
    const found = candidates.find(
      (path) => existsSync(path) && statSync(path).isFile(),
    );
    return found && relative(repository, found).replaceAll("\\", "/");
  }

  const sources = [...filesUnder("src"), "astro.config.mjs"];

  it.each([
    ["push", pathFilter("push")],
    ["pull_request", pathFilter("pull_request")],
  ])(
    "a file that triggers a %s deploy never imports one that does not",
    (_event, filter) => {
      const hidden: string[] = [];
      for (const file of sources.filter((path) => fires(filter, path))) {
        const text = readFileSync(join(repository, file), "utf-8");
        for (const [, specifier] of text.matchAll(IMPORT)) {
          const target = resolve(file, specifier!);
          if (target && !fires(filter, target)) {
            hidden.push(`${file} imports ${target}`);
          }
        }
      }
      expect(hidden).toEqual([]);
    },
  );

  it("finds the imports it is meant to check", () => {
    // A guard against the check passing because it found nothing to look at.
    const text = readFileSync(
      join(repository, "src/content.config.ts"),
      "utf-8",
    );
    expect(resolve("src/content.config.ts", "./content/schema")).toBe(
      "src/content/schema.ts",
    );
    expect([...text.matchAll(IMPORT)].length).toBeGreaterThan(0);
  });
});

describe("the README's Deploying table", () => {
  const row = (start: string) =>
    readme.split("\n").find((line) => line.startsWith(start)) ?? "";

  it("has a row for the daily schedule", () => {
    expect(row("| Daily at 04:17 UTC")).toContain("DEPLOY_CONTEXT=production");
  });

  it("says a push leaves out the scripts and the code only they use", () => {
    const push = row("| Push to `main`");
    expect(push).toContain("`scripts/`");
    expect(push).toContain("`src/metadata/`");
    expect(push).toContain("`src/content/list-placeholders.ts`");
    expect(push).toContain("`src/e2e/`");
    expect(push).toContain("`lychee.toml`");
    expect(push).toContain("`.htmlvalidate.mjs`");
  });

  it("says a pull request gets no preview for them either", () => {
    const pullRequest = row("| Pull request that changes nothing");
    expect(pullRequest).toContain("`scripts/`");
    expect(pullRequest).toContain("`src/metadata/`");
    expect(pullRequest).toContain("`src/content/list-placeholders.ts`");
    expect(pullRequest).toContain("`src/e2e/`");
    expect(pullRequest).toContain("`e2e/`");
    expect(pullRequest).toContain("`lychee.toml`");
    expect(pullRequest).toContain("`.htmlvalidate.mjs`");
  });
});
