import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { pagePaths } from "../src/e2e/rules.ts";

/** The two deploy contexts the site is built for, each served from its own folder on its own port. */
export const CONTEXTS = [
  { name: "preview", port: 4400 },
  { name: "production", port: 4401 },
] as const;

export type Context = (typeof CONTEXTS)[number];

export const BUILD_FOLDER = "dist-e2e";

export const folderOf = (context: Context) => join(BUILD_FOLDER, context.name);

export const originOf = (context: Context) =>
  `http://127.0.0.1:${context.port}`;

/** Every page of a context's build, read from the built folder and not from a list kept by hand. */
export function pagesOf(context: Context): string[] {
  if (!existsSync(join(folderOf(context), "index.html"))) {
    throw new Error(
      `${folderOf(context)} holds no build. Run "npm run build:e2e" first, or "npm run test:e2e", which builds and then tests.`,
    );
  }
  const files = readdirSync(folderOf(context), {
    recursive: true,
    withFileTypes: true,
  })
    .filter((entry) => entry.isFile())
    .map((entry) =>
      join(entry.parentPath, entry.name).slice(folderOf(context).length + 1),
    );
  return pagePaths(files);
}
