import { describe, expect, it } from "vitest";
import {
  contentType,
  pagePaths,
  respond,
  type StaticWebAppRules,
} from "./rules.ts";

// The rules of the e2e server (e2e/serve.ts), which stands in for Azure Static Web Apps: it
// applies the build's own staticwebapp.config.json. The server is only wiring around these.

const config: StaticWebAppRules = {
  routes: [
    {
      route: "/_astro/*",
      headers: { "Cache-Control": "public, max-age=31536000, immutable" },
    },
  ],
  responseOverrides: { "404": { rewrite: "/404.html" } },
  globalHeaders: {
    "Content-Security-Policy": "default-src 'self'",
    "Cache-Control": "public, max-age=0, must-revalidate",
  },
};

const files = new Set([
  "index.html",
  "404.html",
  "projects/r04/index.html",
  "_astro/site.abc123.css",
  "robots.txt",
]);
const exists = (file: string) => files.has(file);

describe("which file answers a request", () => {
  it.each([
    ["/", "index.html"],
    ["/projects/r04/", "projects/r04/index.html"],
    // A folder path without its trailing slash serves the folder's index.html too.
    ["/projects/r04", "projects/r04/index.html"],
    ["/robots.txt", "robots.txt"],
    ["/404.html", "404.html"],
    ["/_astro/site.abc123.css", "_astro/site.abc123.css"],
    // The query and the fragment are not part of the path.
    ["/projects/r04/?a=1#b", "projects/r04/index.html"],
    // Percent-encoding is decoded.
    ["/robots%2Etxt", "robots.txt"],
  ])("%s is served from %s with status 200", (path, file) => {
    expect(respond(config, path, exists)).toMatchObject({ status: 200, file });
  });

  it.each([
    "/nope",
    "/nope/",
    "/projects/",
    "/projects/r99/",
    "/index",
    "/_astro/missing.css",
  ])("a missing path (%s) answers 404 with 404.html", (path) => {
    expect(respond(config, path, exists)).toMatchObject({
      status: 404,
      file: "404.html",
    });
  });

  it.each([
    "/../package.json",
    "/projects/../../package.json",
    "/%2e%2e/package.json",
    "/projects/%2e%2e%2f%2e%2e%2fpackage.json",
    "/a%00b",
    "/bad%escape",
    "//etc/passwd",
  ])("a path that leaves the folder or is malformed (%s) is a 404", (path) => {
    expect(respond(config, path, () => true)).toMatchObject({
      status: 404,
      file: "404.html",
    });
  });

  it("answers 404 with no file when the config has no 404 rewrite", () => {
    const { status, file } = respond({}, "/nope", exists);
    expect(status).toBe(404);
    expect(file).toBeUndefined();
  });

  it("answers 404 with no file when the rewrite target is not in the folder", () => {
    const { status, file } = respond(
      config,
      "/nope",
      (f) => f === "index.html",
    );
    expect(status).toBe(404);
    expect(file).toBeUndefined();
  });
});

describe("which headers an answer carries", () => {
  it("sends the global headers on a page", () => {
    expect(respond(config, "/", exists).headers).toEqual({
      "Content-Security-Policy": "default-src 'self'",
      "Cache-Control": "public, max-age=0, must-revalidate",
    });
  });

  it("lets a route's header replace the global one of the same name", () => {
    const { headers } = respond(config, "/_astro/site.abc123.css", exists);
    expect(headers["Cache-Control"]).toBe(
      "public, max-age=31536000, immutable",
    );
    expect(headers["Content-Security-Policy"]).toBe("default-src 'self'");
  });

  it.each(["/%5Fastro/site.abc123.css", "/_astro%2Fsite.abc123.css"])(
    "matches a route on the decoded path that picks the file (%s)",
    (path) => {
      const answer = respond(config, path, exists);
      expect(answer.file).toBe("_astro/site.abc123.css");
      expect(answer.headers["Cache-Control"]).toBe(
        "public, max-age=31536000, immutable",
      );
    },
  );

  it("matches header names without regard to case when replacing", () => {
    const lower: StaticWebAppRules = {
      ...config,
      globalHeaders: { "cache-control": "no-store" },
    };
    const { headers } = respond(lower, "/_astro/site.abc123.css", exists);
    expect(Object.keys(headers)).toHaveLength(1);
    expect(headers["Cache-Control"]).toBe(
      "public, max-age=31536000, immutable",
    );
  });

  it("matches a wildcard route on the path it names, not on a lookalike", () => {
    expect(respond(config, "/_astro", exists).headers["Cache-Control"]).toBe(
      "public, max-age=0, must-revalidate",
    );
    expect(
      respond(config, "/x_astro/a.css", exists).headers,
    ).not.toHaveProperty(
      "Cache-Control",
      "public, max-age=31536000, immutable",
    );
  });

  it("matches an exact route only on that path", () => {
    const exact: StaticWebAppRules = {
      globalHeaders: { A: "global" },
      routes: [{ route: "/robots.txt", headers: { A: "route" } }],
    };
    expect(respond(exact, "/robots.txt", exists).headers.A).toBe("route");
    expect(respond(exact, "/", exists).headers.A).toBe("global");
  });

  it("sends the global headers on the 404 page, not a missing file's route headers", () => {
    const { headers } = respond(config, "/_astro/missing.css", exists);
    expect(headers["Cache-Control"]).toBe("public, max-age=0, must-revalidate");
    expect(headers["Content-Security-Policy"]).toBe("default-src 'self'");
  });

  it("sends no header when the config names none", () => {
    expect(respond({}, "/", exists).headers).toEqual({});
  });
});

describe("content type", () => {
  it.each([
    ["index.html", "text/html; charset=utf-8"],
    ["_astro/a.css", "text/css; charset=utf-8"],
    ["_astro/a.js", "text/javascript; charset=utf-8"],
    ["robots.txt", "text/plain; charset=utf-8"],
    ["sitemap-0.xml", "application/xml; charset=utf-8"],
    ["staticwebapp.config.json", "application/json; charset=utf-8"],
    ["og/home.png", "image/png"],
    ["a.webp", "image/webp"],
    ["_astro/f.woff2", "font/woff2"],
    ["favicon.svg", "image/svg+xml"],
    ["unknown.bin", "application/octet-stream"],
    ["NOEXT", "application/octet-stream"],
  ])("%s is %s", (file, type) => {
    expect(contentType(file)).toBe(type);
  });
});

describe("the pages of a build", () => {
  it("lists every index.html as its folder's path, and the 404 page", () => {
    expect(
      pagePaths([
        "index.html",
        "404.html",
        "projects/r04/index.html",
        "projects/r01/index.html",
        "_astro/site.css",
        "robots.txt",
        "og/home.png",
      ]),
    ).toEqual(["/", "/404.html", "/projects/r01/", "/projects/r04/"]);
  });

  it("accepts Windows separators", () => {
    expect(pagePaths(["projects\\r04\\index.html"])).toEqual([
      "/projects/r04/",
    ]);
  });

  it("does not take another 404.html or an index.html-like name for a page", () => {
    expect(
      pagePaths(["a/404.html", "myindex.html", "index.html.map", "x/old.html"]),
    ).toEqual([]);
  });

  it("is empty for an empty build", () => {
    expect(pagePaths([])).toEqual([]);
  });
});
