import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Only this project's tests: not the copies in other worktrees, docs or infra.
    include: ["src/**/*.test.ts"],
    // build.test.ts runs real Astro builds, which a cold CI runner can take a few seconds over.
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
