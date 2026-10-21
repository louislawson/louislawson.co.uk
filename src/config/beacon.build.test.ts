import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  buildCopy,
  copyOfProject,
  removeCopies,
} from "../__tests__/project-copy";
import { ANALYTICS_TOKEN } from "./site";

// A real production build of a copy of the project whose analytics token is still a placeholder:
// the state the site was in before Louis supplied the token, and the one it returns to if the token
// is ever removed. The page must have no beacon and the policy no room for Cloudflare, while the
// Trusted Types rules stay (every build has them).
let dir = "";
let output = "";

beforeAll(() => {
  dir = copyOfProject("beacon-placeholder-");
  const file = join(dir, "src/config/site.ts");
  const source = readFileSync(file, "utf-8");
  const edited = source.replace(
    `"${ANALYTICS_TOKEN}"`,
    '"TODO: Cloudflare token"',
  );
  // A replacement that matched nothing would test the real token and pass for the wrong reason.
  expect(edited).not.toBe(source);
  writeFileSync(file, edited);
  output = buildCopy(dir, { DEPLOY_CONTEXT: "production" });
});

afterAll(removeCopies);

describe("a production build with a placeholder analytics token", () => {
  it("builds", () => {
    expect(output).toBe("");
  });

  it("has no beacon in any page", () => {
    for (const page of ["index.html", "404.html"]) {
      const html = readFileSync(join(dir, "dist", page), "utf-8");
      expect(html, page).not.toContain("cloudflareinsights");
      expect(html, page).not.toContain("data-cf-beacon");
    }
  });

  it("keeps Cloudflare out of the policy and Trusted Types in it", () => {
    const config = JSON.parse(
      readFileSync(join(dir, "dist", "staticwebapp.config.json"), "utf-8"),
    );
    const csp = config.globalHeaders["Content-Security-Policy"] as string;
    expect(csp).not.toContain("cloudflareinsights");
    expect(csp).not.toMatch(/script-src|connect-src/);
    expect(csp).toContain("require-trusted-types-for 'script'");
    expect(csp).toContain("trusted-types 'none'");
  });
});
