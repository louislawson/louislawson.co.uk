/// <reference types="vitest/config" />
import { getViteConfig } from "astro/config";

// getViteConfig loads astro.config.mjs and Astro's Vite plugin, which the Container API needs to
// compile .astro components in tests.
export default getViteConfig({
  test: {
    // Components render on the server, so the Container API needs the node environment.
    environment: "node",
    // Only this project's tests: not the copies in other worktrees, docs or infra.
    include: ["src/**/*.test.ts"],
    // build.test.ts runs real Astro builds, which a cold CI runner can take a few seconds over.
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
