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

// The tests that build a changed copy of the project (an invalid entry, a photo, a demo
// measurement) all build it the same way, here, so none of them can forget what one forgot: a copy
// that shares node_modules with the real project also shares Astro's content cache in
// node_modules/.astro, so a copy that builds writes its own content into the cache that every
// other build reads. Each copy keeps its own cache instead.
const root = process.cwd();
const copies: string[] = [];

/**
 * What a build may take before it is killed. A synchronous call cannot be interrupted by the test
 * timeout, so a hung build needs its own, and it ends inside the 60 s that vitest.config.ts gives
 * every test and hook, so the failure it reports is this one, with the build's output.
 */
export const BUILD_TIMEOUT_MS = 55_000;

// The copy builds through this config, which is the copied one with caches of its own. Wrapping it
// finds nothing in its text, so a change to how astro.config.mjs is written cannot leave a cache
// shared without a word. Vite's own cache, its optimised dependencies, defaults to
// node_modules/.vite, which the copies share through the junction: two builds at once renamed the
// same folder under each other (EPERM and ENOENT), so it is moved into the copy as well.
const COPY_CONFIG = "astro.copy.config.mjs";
const COPY_CONFIG_SOURCE = `import config from "./astro.config.mjs";

export default {
  ...config,
  cacheDir: "./.cache",
  vite: { ...config.vite, cacheDir: "./.cache/vite" },
};
`;

/** A copy of the project in a temporary folder, which `removeCopies` deletes. */
export function copyOfProject(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
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
  writeFileSync(join(dir, COPY_CONFIG), COPY_CONFIG_SOURCE);
  return dir;
}

// The projects the build tests read, frozen as they were when the tests were written. A test that
// pins a project's code, title or link would otherwise fail on every content PR that adds or
// replaces a project, so the copies build these instead of whatever src/content/projects holds.
// They sit outside src/content, so neither the site's content loader nor list-placeholders sees them.
export const FIXTURE_PROJECTS = join(
  root,
  "src",
  "__tests__",
  "fixtures",
  "projects",
);

/** Replaces the copy's projects with the fixtures. */
export function useFixtureProjects(dir: string): void {
  const projects = join(dir, "src", "content", "projects");
  rmSync(projects, { recursive: true, force: true });
  cpSync(FIXTURE_PROJECTS, projects, { recursive: true });
}

/**
 * Builds the copy and returns what a failed build printed ("" if it succeeded). A build that fails
 * without printing anything, because it could not start or was killed at the timeout, returns the
 * error's own message, so "" always means it worked. The environment is the one a local build has,
 * with `env` over it.
 */
export function buildCopy(
  dir: string,
  env: Record<string, string> = {},
): string {
  try {
    execFileSync(
      process.execPath,
      [
        join(dir, "node_modules", "astro", "bin", "astro.mjs"),
        "build",
        "--config",
        COPY_CONFIG,
      ],
      {
        cwd: dir,
        env: { ...process.env, DEPLOY_CONTEXT: "", SITE_URL: "", ...env },
        stdio: "pipe",
        timeout: BUILD_TIMEOUT_MS,
      },
    );
    return "";
  } catch (error) {
    const { stdout, stderr, message } = error as {
      stdout?: Buffer;
      stderr?: Buffer;
      message?: string;
    };
    return `${stdout ?? ""}${stderr ?? ""}${message ?? "the build failed"}`;
  }
}

export function removeCopies(): void {
  for (const dir of copies.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
}
