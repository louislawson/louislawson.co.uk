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
  buildCopy,
  copyOfProject,
  removeCopies,
  withOwnCacheDir,
} from "./project-copy";

const root = process.cwd();

afterAll(removeCopies);

describe("withOwnCacheDir", () => {
  it("adds a cacheDir to the config's defineConfig call", () => {
    expect(
      withOwnCacheDir('export default defineConfig({\n  site: "x",\n});\n'),
    ).toBe(
      'export default defineConfig({\n  cacheDir: "./.cache",\n  site: "x",\n});\n',
    );
  });

  it("fails, naming the file, when the config has no such call, rather than leaving the cache shared", () => {
    expect(() => withOwnCacheDir("export default {};\n")).toThrow(
      /astro\.config\.mjs/,
    );
  });
});

describe("copyOfProject", () => {
  it("copies what the build reads, and gives the copy its own Astro cache", () => {
    const dir = copyOfProject("project-copy-test-");
    for (const path of ["src", "public", "tsconfig.json", "package.json"]) {
      expect(existsSync(join(dir, path)), path).toBe(true);
    }
    expect(readFileSync(join(dir, "astro.config.mjs"), "utf-8")).toMatch(
      /defineConfig\(\{\s*cacheDir:\s*"\.\/\.cache",/,
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
});
