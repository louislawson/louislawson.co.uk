import { describe, expect, it } from "vitest";
import { buildStaticWebAppConfig } from "./staticwebapp";

const base = {
  globalHeaders: { "X-Content-Type-Options": "nosniff" },
  routes: [
    {
      route: "/_astro/*",
      headers: { "Cache-Control": "public, max-age=31536000, immutable" },
    },
  ],
  responseOverrides: { "404": { rewrite: "/404.html" } },
};

describe("buildStaticWebAppConfig", () => {
  it("adds the noindex header to every response when the build is noindex", () => {
    const config = buildStaticWebAppConfig(base, { noindex: true });
    expect(config.globalHeaders?.["X-Robots-Tag"]).toBe("noindex");
  });

  it("keeps the baseline headers, routes and overrides", () => {
    const config = buildStaticWebAppConfig(base, { noindex: true });
    expect(config.globalHeaders?.["X-Content-Type-Options"]).toBe("nosniff");
    expect(config.routes).toEqual(base.routes);
    expect(config.responseOverrides).toEqual(base.responseOverrides);
  });

  it("sends no noindex header when the build may be indexed", () => {
    const config = buildStaticWebAppConfig(base, { noindex: false });
    expect(config.globalHeaders).not.toHaveProperty("X-Robots-Tag");
  });

  it("removes a noindex header that the baseline carries when the build may be indexed", () => {
    const withStray = {
      ...base,
      globalHeaders: { ...base.globalHeaders, "x-robots-tag": "noindex" },
    };
    const config = buildStaticWebAppConfig(withStray, { noindex: false });
    expect(
      Object.keys(config.globalHeaders ?? {}).map((k) => k.toLowerCase()),
    ).not.toContain("x-robots-tag");
  });

  it("works on a baseline with no global headers, and leaves the baseline untouched", () => {
    const bare = { routes: [] };
    const config = buildStaticWebAppConfig(bare, { noindex: true });
    expect(config.globalHeaders).toEqual({ "X-Robots-Tag": "noindex" });
    expect(bare).toEqual({ routes: [] });
  });
});
