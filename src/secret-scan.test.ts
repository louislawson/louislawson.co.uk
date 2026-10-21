import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ANALYTICS_TOKEN } from "./config/site";

// The Secret scan job runs gitleaks, whose generic-api-key rule flags any 32-character hex value
// assigned to something called a token. The analytics token is public (it ships in every
// production page), and the tests use a made-up one of the same shape, so both are allowed by
// value in .gitleaks.toml. The allowlist must stay that narrow: a path or a pattern would let a
// real secret in the same place through.
const config = readFileSync(
  new URL("../.gitleaks.toml", import.meta.url),
  "utf-8",
);
const TEST_TOKEN = "0123456789abcdef0123456789abcdef";

/** The entries of the one allowlist's `regexes` array, as the literal strings they are. */
const allowed = [
  ...(/regexes = \[([^\]]*)\]/.exec(config)?.[1] ?? "").matchAll(
    /'''([^']*)'''/g,
  ),
].map((match) => match[1]);

describe(".gitleaks.toml", () => {
  it("keeps gitleaks' own rules", () => {
    expect(config).toMatch(/^\[extend\]\nuseDefault = true$/m);
  });

  it("allows the public analytics token and the made-up test token, by value", () => {
    expect(allowed).toEqual([ANALYTICS_TOKEN, TEST_TOKEN]);
  });

  it("allows nothing by path, rule or pattern", () => {
    expect(config).not.toMatch(
      /^\s*(paths|rules|targetRules|commits|stopwords)\b/m,
    );
    expect(config.match(/^\[+allowlists?\]+/gm)).toHaveLength(1);
  });

  it("allows only values that are 32 hex digits, so no wider pattern can slip in", () => {
    for (const value of allowed) expect(value).toMatch(/^[0-9a-f]{32}$/);
  });

  it("names the test token the tests use", () => {
    expect(
      readFileSync(new URL("./config/site.test.ts", import.meta.url), "utf-8"),
    ).toContain(`const TEST_TOKEN = "${TEST_TOKEN}"`);
  });
});
