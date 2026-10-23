import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  buildCopy,
  copyOfProject,
  removeCopies,
} from "../__tests__/project-copy";
import { expectationFrom, siteOriginFrom, type LiveConfig } from "./live";

// The Live check reads two things from the build it checks: the site's origin from the home
// page's canonical link, and the headers from staticwebapp.config.json. live.test.ts tests the
// rules on made-up pages; this builds the real site, so a change to how the layout writes its
// canonical link (the quotes, the order of attributes, a minified page) fails here, in CI, and
// not in the first production Live check after a merge.
afterAll(removeCopies);

// The test's own address, so the origin is checked to come from the build and not from a default.
const SITE_URL = "https://example.test";

describe("the live check against a real production build", () => {
  let dir = "";
  beforeAll(() => {
    const copy = copyOfProject("live-");
    expect(buildCopy(copy, { DEPLOY_CONTEXT: "production", SITE_URL })).toBe(
      "",
    );
    dir = join(copy, "dist");
  });

  it("reads the site's origin from the home page's canonical link", () => {
    expect(siteOriginFrom(readFileSync(join(dir, "index.html"), "utf-8"))).toBe(
      SITE_URL,
    );
  });

  it("finds the policy it compares in the build's own config", () => {
    const config = JSON.parse(
      readFileSync(join(dir, "staticwebapp.config.json"), "utf-8"),
    ) as LiveConfig;
    expect(expectationFrom(config, "production").csp).not.toBe("");
  });
});
