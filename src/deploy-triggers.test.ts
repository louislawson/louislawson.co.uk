import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Pins what makes deploy.yml run, and what it does when it runs from the daily schedule. These
// are read from the workflow file itself, so a change to a filter or an expression is tested.

const deploy = readFileSync(
  new URL("../.github/workflows/deploy.yml", import.meta.url),
  "utf-8",
);
const readme = readFileSync(new URL("../README.md", import.meta.url), "utf-8");

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
    "src/metadata/image.ts",
    "src/metadata/pdf.ts",
    "src/metadata/__fixtures__/pdf.ts",
    "src/metadata/image.test.ts",
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
    "src/metadata/__fixtures__/containers.ts",
    "src/content/list-placeholders.ts",
    "src/content/schema.test.ts",
    "scripts/check-metadata.ts",
    "docs/BUILD-PLAN.md",
  ])("does not get a preview for a change to %s", (path) => {
    expect(fires(pullRequest, path)).toBe(false);
  });
});

describe("the daily schedule", () => {
  it("runs at 04:17 UTC every day: an odd minute, to avoid the top of the hour", () => {
    expect(deploy).toMatch(
      /^ {2}schedule:\n {4}- cron: ["']17 4 \* \* \*["']$/m,
    );
  });

  it("is one trigger of the same workflow, so it joins the production queue", () => {
    // Not a pull request, so the workflow-level group must name production, not a pull request
    // number: a scheduled run would otherwise land in "Deploy-runs-" with nothing after it.
    const group = /^ {2}group: (.+)$/m.exec(
      deploy.slice(deploy.indexOf("\nconcurrency:")),
    )?.[1];
    expect(group).toContain("github.event_name == 'pull_request'");
    expect(group).toContain(
      "format('Deploy-runs-{0}', github.event.pull_request.number)",
    );
    expect(group).toMatch(/\|\| 'Deploy-production-runs'\s*\}\}$/);
  });

  it("builds: the build job is not limited to pushes and pull requests", () => {
    const condition =
      /name: Deploy build\n(?:.*\n)*?\s+if: >-\n((?:\s+.*\n)+?)\s+runs-on/.exec(
        deploy,
      )?.[1];
    expect(condition).toContain("github.event_name == 'push'");
    expect(condition).toContain("github.event_name == 'schedule'");
  });

  it("builds as production, like a push", () => {
    expect(deploy).toContain(
      "DEPLOY_CONTEXT: ${{ github.event_name == 'pull_request' && 'preview' || 'production' }}",
    );
  });

  it("keeps the build artifact for a day, not a week", () => {
    expect(deploy).toContain(
      "retention-days: ${{ github.event_name == 'schedule' && 1 || 7 }}",
    );
  });

  it("deploys through the same production group as a push", () => {
    // The deploy job's own group falls back to "production" when there is no pull request number.
    expect(deploy).toContain(
      "group: Deploy-${{ github.event.pull_request.number || 'production' }}",
    );
  });
});

describe("the README's Deploying table", () => {
  it("has a row for the daily schedule", () => {
    expect(readme).toMatch(/\| Daily at 04:17 UTC[^|]*\|/);
  });

  it("names what a push and a pull request leave out, including the scripts and the metadata check", () => {
    const table = readme.slice(readme.indexOf("## Deploying"));
    expect(table).toContain("scripts/");
    expect(table).toContain("src/metadata/");
  });
});
