// Builds the site once per deploy context for the Playwright tests: `npm run build:e2e`. Preview
// goes to dist-e2e/preview and production to dist-e2e/production, so one run tests both. The
// folders stay inside the project, because a build folder outside it breaks the package resolution
// of Astro's prerender step. LAUNCH stays as committed; DEPLOY_CONTEXT is set per build (an unset
// one is a local build, which the tests don't use). Node runs this TypeScript directly.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { CONTEXTS, folderOf } from "../e2e/contexts.ts";

const root = fileURLToPath(new URL("../", import.meta.url));
const astro = fileURLToPath(
  new URL("../node_modules/astro/bin/astro.mjs", import.meta.url),
);

for (const context of CONTEXTS) {
  console.log(`\nbuilding ${context.name} into ${folderOf(context)}`);
  const { status } = spawnSync(
    process.execPath,
    [astro, "build", "--outDir", folderOf(context)],
    {
      cwd: root,
      stdio: "inherit",
      env: { ...process.env, DEPLOY_CONTEXT: context.name },
    },
  );
  if (status !== 0) {
    console.error(`the ${context.name} build failed`);
    process.exit(status ?? 1);
  }
}
