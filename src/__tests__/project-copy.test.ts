import {
  existsSync,
  lstatSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import {
  BUILD_TIMEOUT_MS,
  buildCopy,
  copyOfProject,
  removeCopies,
} from "./project-copy";

const root = process.cwd();

afterAll(removeCopies);

describe("copyOfProject", () => {
  it("copies what the build reads, and builds it through a config of its own that keeps the real one and adds a cache of the copy's", () => {
    const dir = copyOfProject("project-copy-test-");
    for (const path of [
      "src",
      "public",
      "astro.config.mjs",
      "tsconfig.json",
      "package.json",
    ]) {
      expect(existsSync(join(dir, path)), path).toBe(true);
    }
    // The copy's own config wraps the copied one, so nothing is found and replaced in its text.
    const config = readFileSync(join(dir, "astro.copy.config.mjs"), "utf-8");
    expect(config).toContain('from "./astro.config.mjs"');
    expect(config).toMatch(/cacheDir:\s*"\.\/\.cache"/);
    expect(readFileSync(join(dir, "astro.config.mjs"), "utf-8")).toBe(
      readFileSync(join(root, "astro.config.mjs"), "utf-8"),
    );
  });

  it("leaves the real config alone, and shares only node_modules with the real project", () => {
    const dir = copyOfProject("project-copy-test-");
    expect(readFileSync(join(root, "astro.config.mjs"), "utf-8")).not.toContain(
      "cacheDir",
    );
    expect(lstatSync(join(dir, "node_modules")).isSymbolicLink()).toBe(true);
    expect(realpathSync(join(dir, "node_modules"))).toBe(
      realpathSync(join(root, "node_modules")),
    );
  });
});

describe("buildCopy", () => {
  it("returns nothing for a build that worked, and writes the content cache in the copy only", () => {
    const dir = copyOfProject("project-copy-test-");
    // A title no other build has, so any trace of it in the real cache is this build's.
    const probe = "Cache-probe-3f9c2a";
    const page = join(dir, "src", "content", "projects", "this-website.md");
    writeFileSync(
      page,
      readFileSync(page, "utf-8").replace(
        "title: This website",
        `title: ${probe}`,
      ),
    );

    expect(buildCopy(dir)).toBe("");

    expect(
      readFileSync(join(dir, ".cache", "data-store.json"), "utf-8"),
    ).toContain(probe);
    const real = join(root, "node_modules", ".astro", "data-store.json");
    if (existsSync(real)) {
      expect(readFileSync(real, "utf-8")).not.toContain(probe);
    }
  });

  it("returns what a failed build printed", () => {
    const dir = copyOfProject("project-copy-test-");
    writeFileSync(
      join(dir, "src", "content", "projects", "bad-entry.md"),
      "---\ncode: nope\n---\n",
    );
    expect(buildCopy(dir)).toContain("bad-entry");
  });

  it("never reports a build that could not run, or was killed, as one that worked", () => {
    // A build that prints nothing before it fails (no such folder, a timeout) must still come back
    // as text, because "" is the sign of success.
    const output = buildCopy(join(root, "no-such-folder"));
    expect(output).not.toBe("");
    expect(output).toMatch(/ENOENT|no-such-folder/);
  });

  it("gives a build less time than vitest gives the test or hook that runs it", () => {
    // The helper's timeout is what ends a hung build, with its output. A vitest timeout that came
    // first could report only after the blocked build ended.
    const config = readFileSync(join(root, "vitest.config.ts"), "utf-8");
    for (const name of ["testTimeout", "hookTimeout"]) {
      const limit = Number(
        new RegExp(`${name}:\\s*([\\d_]+)`)
          .exec(config)?.[1]
          ?.replaceAll("_", ""),
      );
      expect(limit, `${name} in vitest.config.ts`).toBeGreaterThan(0);
      expect(BUILD_TIMEOUT_MS, name).toBeLessThan(limit);
    }
  });
});
