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

// The tests that build a changed copy of the project (an invalid entry, a photo, a demo
// measurement) all build it the same way, here, so none of them can forget what one forgot: a copy
// that shares node_modules with the real project also shares Astro's content cache in
// node_modules/.astro, so a copy that builds writes its own content into the cache that every
// other build reads. Each copy keeps its own cache instead.
const root = process.cwd();
const copies: string[] = [];

/** The config with its own cache directory, in the copy. */
export function withOwnCacheDir(source: string): string {
  const call = "defineConfig({";
  if (!source.includes(call)) {
    throw new Error(
      `astro.config.mjs no longer calls ${call}: update withOwnCacheDir in src/__tests__/project-copy.ts, which gives each test copy its own Astro cache`,
    );
  }
  return source.replace(call, `${call}\n  cacheDir: "./.cache",`);
}

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
  const config = join(dir, "astro.config.mjs");
  writeFileSync(config, withOwnCacheDir(readFileSync(config, "utf-8")));
  return dir;
}

/**
 * Builds the copy and returns what a failed build printed ("" if it succeeded). The environment is
 * the one a local build has, with `env` over it.
 */
export function buildCopy(
  dir: string,
  env: Record<string, string> = {},
): string {
  try {
    execFileSync(
      process.execPath,
      [join(dir, "node_modules", "astro", "bin", "astro.mjs"), "build"],
      {
        cwd: dir,
        env: { ...process.env, DEPLOY_CONTEXT: "", SITE_URL: "", ...env },
        stdio: "pipe",
        // A synchronous call cannot be interrupted by the test timeout, so a hung build needs its
        // own. It sits inside the 90 s a build's hook is given.
        timeout: 80_000,
      },
    );
    return "";
  } catch (error) {
    const { stdout, stderr } = error as { stdout?: Buffer; stderr?: Buffer };
    return `${stdout ?? ""}${stderr ?? ""}`;
  }
}

export function removeCopies(): void {
  for (const dir of copies.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
}
