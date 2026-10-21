import { describe, expect, it } from "vitest";
import { buildStaticWebAppConfig } from "./staticwebapp";

const CSP = "default-src 'self'; base-uri 'self'; frame-ancestors 'none'";

const base = {
  globalHeaders: {
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": CSP,
  },
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
    const config = buildStaticWebAppConfig(base, {
      noindex: true,
      beacon: false,
    });
    expect(config.globalHeaders?.["X-Robots-Tag"]).toBe("noindex");
  });

  it("keeps the baseline headers, routes and overrides", () => {
    const config = buildStaticWebAppConfig(base, {
      noindex: true,
      beacon: false,
    });
    expect(config.globalHeaders?.["X-Content-Type-Options"]).toBe("nosniff");
    expect(config.routes).toEqual(base.routes);
    expect(config.responseOverrides).toEqual(base.responseOverrides);
  });

  it("sends no noindex header when the build may be indexed", () => {
    const config = buildStaticWebAppConfig(base, {
      noindex: false,
      beacon: false,
    });
    expect(config.globalHeaders).not.toHaveProperty("X-Robots-Tag");
  });

  it("removes a noindex header that the baseline carries when the build may be indexed", () => {
    const withStray = {
      ...base,
      globalHeaders: { ...base.globalHeaders, "x-robots-tag": "noindex" },
    };
    const config = buildStaticWebAppConfig(withStray, {
      noindex: false,
      beacon: false,
    });
    expect(
      Object.keys(config.globalHeaders ?? {}).map((k) => k.toLowerCase()),
    ).not.toContain("x-robots-tag");
  });

  it("fails the build on a baseline with no content security policy, rather than ship none", () => {
    const bare = { routes: [] };
    expect(() =>
      buildStaticWebAppConfig(bare, { noindex: true, beacon: false }),
    ).toThrow(/Content-Security-Policy/);
  });

  it("leaves the baseline untouched", () => {
    const before = structuredClone(base);
    buildStaticWebAppConfig(base, { noindex: true, beacon: true });
    expect(base).toEqual(before);
  });
});

/** The policy a build sends, as directive name to its sources. */
function policy(config: ReturnType<typeof buildStaticWebAppConfig>) {
  const header = config.globalHeaders?.["Content-Security-Policy"] ?? "";
  return new Map(
    header
      .split(";")
      .map((directive) => directive.trim().split(/\s+/))
      .filter(([name]) => name)
      .map(([name, ...sources]) => [name, sources] as const),
  );
}

describe("buildStaticWebAppConfig: the content security policy", () => {
  it("makes every build require Trusted Types for scripts and allow no policy", () => {
    for (const beacon of [false, true]) {
      const csp = policy(
        buildStaticWebAppConfig(base, { noindex: true, beacon }),
      );
      expect(csp.get("require-trusted-types-for")).toEqual(["'script'"]);
      expect(csp.get("trusted-types")).toEqual(["'none'"]);
    }
  });

  it("lets a build without the beacon load scripts and connect to its own origin only", () => {
    const csp = policy(
      buildStaticWebAppConfig(base, { noindex: true, beacon: false }),
    );
    expect(csp.get("default-src")).toEqual(["'self'"]);
    expect(csp.has("script-src")).toBe(false);
    expect(csp.has("connect-src")).toBe(false);
  });

  it("adds Cloudflare's beacon script and its reporting address when the beacon is in", () => {
    const csp = policy(
      buildStaticWebAppConfig(base, { noindex: true, beacon: true }),
    );
    expect(csp.get("script-src")).toEqual([
      "'self'",
      "https://static.cloudflareinsights.com",
    ]);
    expect(csp.get("connect-src")).toEqual([
      "'self'",
      "https://cloudflareinsights.com",
    ]);
  });

  it("keeps the baseline's directives as they were", () => {
    const csp = policy(
      buildStaticWebAppConfig(base, { noindex: true, beacon: true }),
    );
    expect(csp.get("default-src")).toEqual(["'self'"]);
    expect(csp.get("base-uri")).toEqual(["'self'"]);
    expect(csp.get("frame-ancestors")).toEqual(["'none'"]);
  });

  it("does not repeat a directive the baseline already has", () => {
    const already = {
      globalHeaders: {
        "content-security-policy": `${CSP}; require-trusted-types-for 'script'; script-src 'self'`,
      },
    };
    const config = buildStaticWebAppConfig(already, {
      noindex: true,
      beacon: true,
    });
    const header = Object.values(config.globalHeaders ?? {}).find((value) =>
      value.includes("default-src"),
    );
    expect(header?.match(/require-trusted-types-for/g)).toHaveLength(1);
    expect(header?.match(/script-src/g)).toHaveLength(1);
    expect(
      Object.keys(config.globalHeaders ?? {}).filter((k) =>
        /content-security-policy/i.test(k),
      ),
    ).toHaveLength(1);
  });

  it("adds Cloudflare to a script-src or connect-src the baseline already has, keeping its sources", () => {
    const withSources = {
      globalHeaders: {
        "Content-Security-Policy": `${CSP}; script-src self wasm-unsafe-eval; connect-src self https://api.example.test`,
      },
    };
    const csp = policy(
      buildStaticWebAppConfig(withSources, { noindex: true, beacon: true }),
    );
    expect(csp.get("script-src")).toEqual([
      "self",
      "wasm-unsafe-eval",
      "https://static.cloudflareinsights.com",
    ]);
    expect(csp.get("connect-src")).toEqual([
      "self",
      "https://api.example.test",
      "https://cloudflareinsights.com",
    ]);
  });

  it("recognises a baseline directive whatever its case, and never repeats one", () => {
    const shouting = {
      globalHeaders: {
        "Content-Security-Policy": `${CSP}; Script-Src self; TRUSTED-TYPES none`,
      },
    };
    const header =
      buildStaticWebAppConfig(shouting, { noindex: true, beacon: true })
        .globalHeaders?.["Content-Security-Policy"] ?? "";
    expect(header.match(/script-src/gi)).toHaveLength(1);
    expect(header.match(/trusted-types /gi)).toHaveLength(1);
    expect(header).toContain("https://static.cloudflareinsights.com");
  });

  it("replaces a baseline 'none' with the origin, since 'none' beside another source is ignored", () => {
    const none = {
      globalHeaders: {
        "Content-Security-Policy": `${CSP}; script-src 'none'`,
      },
    };
    const csp = policy(
      buildStaticWebAppConfig(none, { noindex: true, beacon: true }),
    );
    expect(csp.get("script-src")).toEqual([
      "https://static.cloudflareinsights.com",
    ]);
  });

  it("does not add the origin twice when the baseline already allows it", () => {
    const already = {
      globalHeaders: {
        "Content-Security-Policy": `${CSP}; script-src self https://static.cloudflareinsights.com`,
      },
    };
    const header =
      buildStaticWebAppConfig(already, { noindex: true, beacon: true })
        .globalHeaders?.["Content-Security-Policy"] ?? "";
    expect(header.match(/static.cloudflareinsights.com/g)).toHaveLength(1);
  });

  it("allows no inline or eval script, and no wildcard source, with the beacon in", () => {
    const header =
      buildStaticWebAppConfig(base, { noindex: true, beacon: true })
        .globalHeaders?.["Content-Security-Policy"] ?? "";
    expect(header).not.toMatch(/unsafe-inline|unsafe-eval/);
    expect(header).not.toMatch(/(^|[\s;])\*([\s;]|$)/);
  });
});
