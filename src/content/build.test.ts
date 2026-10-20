import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import {
  buildCopy,
  copyOfProject,
  removeCopies,
} from "../__tests__/project-copy";

// An invalid entry must never be committed under src/content/, where it would break every build,
// so this builds a copy of the project with one bad entry added.
afterAll(removeCopies);

describe("a build with an invalid project entry", () => {
  it("fails and names the file and the field", () => {
    const dir = copyOfProject("content-build-");
    writeFileSync(
      join(dir, "src", "content", "projects", "bad-entry.md"),
      [
        "---",
        "code: R09",
        "title: A project that names its employer",
        "summary: Work projects are anonymised.",
        "headline: Employer named here",
        "status: complete",
        'period: "2025"',
        "featured: false",
        "order: 9",
        "kind: work",
        "descriptor: A UK public-sector body",
        "org: Some Employer Ltd",
        "setup: Setup.",
        "change: Change.",
        "result: Result.",
        "stack: [Terraform]",
        "---",
        "",
        "Body.",
        "",
      ].join("\n"),
    );

    const output = buildCopy(dir);

    expect(output).toContain("bad-entry");
    expect(output).toContain("org");
    expect(output).toContain("anonymised");
  });
});

// The launch PR flips LAUNCH to true in src/config/site.ts, and its build must go red while the
// required set is incomplete. This works in both states: it sets LAUNCH to true whether or not it
// already is, and removes public/cv.pdf so the CV is missing however the content looks by then.
describe("a build with LAUNCH = true and no CV file", () => {
  it("fails at the launch gate, naming the CV", () => {
    const dir = copyOfProject("content-build-");
    const siteConfig = join(dir, "src", "config", "site.ts");
    const source = readFileSync(siteConfig, "utf-8");
    expect(
      source,
      "the LAUNCH constant in src/config/site.ts changed: update this test",
    ).toMatch(/const LAUNCH = (true|false);/);
    writeFileSync(
      siteConfig,
      source.replace(/const LAUNCH = (true|false);/, "const LAUNCH = true;"),
    );
    rmSync(join(dir, "public", "cv.pdf"), { force: true });

    const output = buildCopy(dir);

    expect(output).toContain("launch gate");
    expect(output).toMatch(
      /cv field is still a placeholder|public\/cv\.pdf does not exist/,
    );
  });
});
