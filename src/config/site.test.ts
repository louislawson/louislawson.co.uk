import { describe, expect, it } from "vitest";
import { parseDeployContext, resolveSite, shouldNoindex } from "./site";

describe("parseDeployContext", () => {
  it("treats a build with no DEPLOY_CONTEXT as local", () => {
    expect(parseDeployContext(undefined)).toBe("local");
    expect(parseDeployContext("")).toBe("local");
  });

  it("accepts the two contexts the deploy workflow sets", () => {
    expect(parseDeployContext("preview")).toBe("preview");
    expect(parseDeployContext("production")).toBe("production");
  });

  it("fails the build on anything else, naming the value", () => {
    expect(() => parseDeployContext("staging")).toThrow(/staging/);
    expect(() => parseDeployContext("Production")).toThrow(/Production/);
  });
});

describe("shouldNoindex", () => {
  it("is always on while the site is not launched, whatever the context", () => {
    expect(shouldNoindex({ launch: false, deployContext: "production" })).toBe(
      true,
    );
    expect(shouldNoindex({ launch: false, deployContext: "preview" })).toBe(
      true,
    );
    expect(shouldNoindex({ launch: false, deployContext: "local" })).toBe(true);
  });

  it("lets the launched production build be indexed", () => {
    expect(shouldNoindex({ launch: true, deployContext: "production" })).toBe(
      false,
    );
  });

  it("keeps preview builds out of search engines even after launch", () => {
    expect(shouldNoindex({ launch: true, deployContext: "preview" })).toBe(
      true,
    );
  });

  it("never lets a local build be indexed", () => {
    expect(shouldNoindex({ launch: true, deployContext: "local" })).toBe(true);
  });
});

describe("resolveSite", () => {
  it("is not launched yet, so every build is noindex", () => {
    const production = resolveSite({ DEPLOY_CONTEXT: "production" });
    expect(production.launch).toBe(false);
    expect(production.noindex).toBe(true);
    expect(resolveSite({ DEPLOY_CONTEXT: "preview" }).noindex).toBe(true);
    expect(resolveSite({}).noindex).toBe(true);
  });

  it("defaults the site URL to the real domain", () => {
    expect(resolveSite({}).url).toBe("https://louislawson.co.uk");
  });

  it("takes the site URL from SITE_URL, without a trailing slash", () => {
    expect(resolveSite({ SITE_URL: "https://example.test/" }).url).toBe(
      "https://example.test",
    );
    expect(resolveSite({ SITE_URL: "https://example.test" }).url).toBe(
      "https://example.test",
    );
  });

  it("fails the build on a SITE_URL that is not an absolute URL", () => {
    expect(() => resolveSite({ SITE_URL: "louislawson.co.uk" })).toThrow(
      /SITE_URL/,
    );
    expect(() => resolveSite({ SITE_URL: "ftp://example.test" })).toThrow(
      /SITE_URL/,
    );
  });

  it("fails the build on a SITE_URL with a path, query or fragment, which would be dropped", () => {
    expect(() =>
      resolveSite({ SITE_URL: "https://example.test/base" }),
    ).toThrow(/SITE_URL/);
    expect(() =>
      resolveSite({ SITE_URL: "https://example.test/?a=1" }),
    ).toThrow(/SITE_URL/);
    expect(() =>
      resolveSite({ SITE_URL: "https://example.test/#top" }),
    ).toThrow(/SITE_URL/);
  });

  it("fails the build on a bad DEPLOY_CONTEXT", () => {
    expect(() => resolveSite({ DEPLOY_CONTEXT: "staging" })).toThrow(/staging/);
  });
});
// throwaway: a test-only change must not deploy a preview
