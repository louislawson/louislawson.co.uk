import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Vitest does not run e2e/, but it can read it. Every spec gets its `test` from e2e/test.ts, which
// answers requests to Cloudflare's analytics with an empty 204 so that no test reaches the network.
// A spec that imported `test` from Playwright itself would load the real beacon from a production
// page, and send Cloudflare a visit from a test run.
const folder = new URL("../../e2e/", import.meta.url);
const read = (name: string) => readFileSync(new URL(name, folder), "utf-8");
const specs = readdirSync(folder).filter((name) => name.endsWith(".spec.ts"));

/** Importing `test` or `expect` as a value from Playwright (a type import is harmless). */
const FROM_PLAYWRIGHT =
  /import\s*(?!type\b)\{[^}]*(?<![\w])(?<!type\s)(?:test|expect)\b[^}]*\}\s*from\s*["']@playwright\/test["']/;

describe("the e2e specs", () => {
  it("finds the specs it is meant to check", () => {
    expect(specs.length).toBeGreaterThan(5);
  });

  it.each(specs)("%s takes test from the shared fixture", (name) => {
    expect(read(name)).not.toMatch(FROM_PLAYWRIGHT);
  });

  it("recognises a spec that imports test from Playwright", () => {
    expect(
      'import { expect, test, type Page } from "@playwright/test";',
    ).toMatch(FROM_PLAYWRIGHT);
    expect('import type { Page } from "@playwright/test";').not.toMatch(
      FROM_PLAYWRIGHT,
    );
    expect('import { test } from "./test.ts";').not.toMatch(FROM_PLAYWRIGHT);
  });
});

// bypassCSP switches the site's policy off for a browser context. No test may use it: every check,
// the text-spacing ones included (they add a constructed stylesheet, which the policy allows), sees
// the page under the CSP and Trusted Types a visitor gets.
describe("bypassCSP", () => {
  const files = readdirSync(folder).filter((name) => name.endsWith(".ts"));

  it("finds the specs and helpers it is meant to check", () => {
    expect(files).toEqual(
      expect.arrayContaining(["reflow.spec.ts", "test.ts"]),
    );
  });

  it.each(files)("%s does not use it", (name) => {
    expect(read(name)).not.toMatch(/bypassCSP/);
  });

  it("is not set in the Playwright config", () => {
    const config = readFileSync(
      new URL("../../playwright.config.ts", import.meta.url),
      "utf-8",
    );
    expect(config).not.toMatch(/bypassCSP/);
  });
});

describe("the shared fixture", () => {
  const fixture = read("test.ts");

  it("answers every request to Cloudflare's analytics hosts, subdomains included, without the network", () => {
    expect(fixture).toContain("cloudflareinsights");
    expect(fixture).toMatch(/route\.fulfill\(/);
    expect(fixture).toMatch(/status: 204/);
    expect(fixture).not.toMatch(/route\.(continue|fallback)\(/);
  });

  it("applies to every test without being asked for", () => {
    expect(fixture).toMatch(/auto: true/);
  });
});
