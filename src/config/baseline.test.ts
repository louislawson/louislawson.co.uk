import { readFileSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";

// The committed baseline that every deploy starts from (BUILD-PLAN PR 1.5). The build adds the
// robots header on top of it; see staticwebapp.test.ts.
const path = new URL("../../public/staticwebapp.config.json", import.meta.url);
const config = JSON.parse(readFileSync(path, "utf-8")) as {
  globalHeaders: Record<string, string>;
  routes: { route: string; headers?: Record<string, string> }[];
  responseOverrides: Record<string, { rewrite?: string }>;
};

function header(name: string): string | undefined {
  const key = Object.keys(config.globalHeaders).find(
    (k) => k.toLowerCase() === name.toLowerCase(),
  );
  return key === undefined ? undefined : config.globalHeaders[key];
}

describe("public/staticwebapp.config.json", () => {
  it("stays under the 20 KB limit Static Web Apps enforces", () => {
    expect(statSync(path).size).toBeLessThan(20 * 1024);
  });

  it("starts the content security policy at default-src 'self' and forbids framing", () => {
    const csp = header("Content-Security-Policy") ?? "";
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it("allows no inline or eval script, and no wildcard source, in the policy", () => {
    const csp = header("Content-Security-Policy") ?? "";
    expect(csp).not.toMatch(/unsafe-inline|unsafe-eval/);
    expect(csp).not.toMatch(/(^|[\s;])\*([\s;]|$)/);
  });

  it("sends HSTS for at least a year", () => {
    const hsts = header("Strict-Transport-Security") ?? "";
    const maxAge = Number(/max-age=(\d+)/.exec(hsts)?.[1] ?? 0);
    expect(maxAge).toBeGreaterThanOrEqual(31536000);
  });

  it("sends the referrer, permissions and content-type headers", () => {
    expect(header("Referrer-Policy")).toBeTruthy();
    expect(header("Permissions-Policy")).toBeTruthy();
    expect(header("X-Content-Type-Options")).toBe("nosniff");
  });

  it("leaves the robots header to the build", () => {
    expect(header("X-Robots-Tag")).toBeUndefined();
  });

  it("serves the 404 page for missing files", () => {
    expect(config.responseOverrides["404"]?.rewrite).toBe("/404.html");
  });

  it("caches hashed assets for a year and makes everything else revalidate", () => {
    const assets = config.routes.find((r) => r.route === "/_astro/*");
    const cacheControl = assets?.headers?.["Cache-Control"] ?? "";
    expect(cacheControl).toContain("immutable");
    expect(
      Number(/max-age=(\d+)/.exec(cacheControl)?.[1] ?? 0),
    ).toBeGreaterThanOrEqual(31536000);
    expect(header("Cache-Control")).toMatch(/no-cache|max-age=0/);
  });
});
