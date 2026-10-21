import { describe, expect, it } from "vitest";
import {
  ANALYTICS_TOKEN,
  beaconToken,
  parseDeployContext,
  resolveSite,
  shouldNoindex,
} from "./site";

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

// A made-up token: the real one is public, but a test has no business depending on it.
const TEST_TOKEN = "0123456789abcdef0123456789abcdef";

describe("beaconToken", () => {
  it("gives a production build its token", () => {
    expect(
      beaconToken({ deployContext: "production", token: TEST_TOKEN }),
    ).toBe(TEST_TOKEN);
  });

  it("leaves the beacon out of previews and local builds, however real the token", () => {
    expect(beaconToken({ deployContext: "preview", token: TEST_TOKEN })).toBe(
      undefined,
    );
    expect(beaconToken({ deployContext: "local", token: TEST_TOKEN })).toBe(
      undefined,
    );
  });

  it("leaves the beacon out while the token is a placeholder", () => {
    expect(
      beaconToken({ deployContext: "production", token: "TODO: token" }),
    ).toBe(undefined);
  });

  it("fails the build on a token that is neither a placeholder nor 32 hex digits", () => {
    for (const token of [
      "",
      "abc",
      TEST_TOKEN.toUpperCase(),
      TEST_TOKEN + "0",
      '"}<script>',
    ]) {
      expect(() => beaconToken({ deployContext: "production", token })).toThrow(
        /ANALYTICS_TOKEN/,
      );
    }
  });

  it("checks the token in every context, so a mistake shows in a preview first", () => {
    expect(() =>
      beaconToken({ deployContext: "preview", token: "abc" }),
    ).toThrow(/ANALYTICS_TOKEN/);
  });
});

describe("resolveSite and the analytics beacon", () => {
  it("is the real token that production gets, and no other build", () => {
    expect(ANALYTICS_TOKEN).toMatch(/^[0-9a-f]{32}$/);
    expect(resolveSite({ DEPLOY_CONTEXT: "production" }).beaconToken).toBe(
      ANALYTICS_TOKEN,
    );
    expect(resolveSite({ DEPLOY_CONTEXT: "preview" }).beaconToken).toBe(
      undefined,
    );
    expect(resolveSite({}).beaconToken).toBe(undefined);
  });
});
