import { execFileSync } from "node:child_process";
import {
  cpSync,
  mkdtempSync,
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

    let output = "";
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
    } catch (error) {
      const { stdout, stderr } = error as { stdout?: Buffer; stderr?: Buffer };
      output = `${stdout ?? ""}${stderr ?? ""}`;
    }

    expect(output).toContain("bad-entry");
    expect(output).toContain("org");
    expect(output).toContain("anonymised");
  });
});
