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
import { afterAll, describe, expect, it } from "vitest";

// An invalid entry must never be committed under src/content/, where it would break every build,
// so this builds a copy of the project with one bad entry added.
const root = process.cwd();
const copies: string[] = [];

function copyOfProject(): string {
  const dir = mkdtempSync(join(tmpdir(), "content-build-"));
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
  return dir;
}

/** Builds the copy and returns what a failed build printed ("" if it succeeded). */
function failedBuildOutput(dir: string): string {
  try {
    execFileSync(
      process.execPath,
      [join(dir, "node_modules", "astro", "bin", "astro.mjs"), "build"],
      {
        cwd: dir,
        env: { ...process.env, DEPLOY_CONTEXT: "", SITE_URL: "" },
        stdio: "pipe",
        // A synchronous call cannot be interrupted by the test timeout, so a hung build needs its own.
        timeout: 50_000,
      },
    );
    return "";
  } catch (error) {
    const { stdout, stderr } = error as { stdout?: Buffer; stderr?: Buffer };
    return `${stdout ?? ""}${stderr ?? ""}`;
  }
}

afterAll(() => {
  for (const dir of copies) rmSync(dir, { recursive: true, force: true });
});

describe("a build with an invalid project entry", () => {
  it("fails and names the file and the field", () => {
    const dir = copyOfProject();
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

    const output = failedBuildOutput(dir);

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
    const dir = copyOfProject();
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

    const output = failedBuildOutput(dir);

    expect(output).toContain("launch gate");
    expect(output).toMatch(
      /cv field is still a placeholder|public\/cv\.pdf does not exist/,
    );
  });
});
