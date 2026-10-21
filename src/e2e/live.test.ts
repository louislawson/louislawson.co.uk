import { describe, expect, it } from "vitest";
import {
  checkLive,
  expectationFrom,
  parseLiveUrl,
  retry,
  type LiveExpectation,
  type LiveFetch,
} from "./live";

// The rules of scripts/check-live.ts, which checks a deployed site against the build that was
// uploaded. The script is only wiring around these: it reads its arguments and calls fetch.

const CSP = "default-src 'self'; require-trusted-types-for 'script'";
const HSTS = "max-age=31536000";

const config = (headers: Record<string, string>) => ({
  globalHeaders: { "Content-Security-Policy": CSP, ...headers },
});

describe("expectationFrom", () => {
  it("takes the policy and the robots header from the build's own config", () => {
    expect(
      expectationFrom(config({ "X-Robots-Tag": "noindex" }), "production"),
    ).toEqual({ csp: CSP, robots: "noindex", context: "production" });
  });

  it("expects no robots header from a build that sends none", () => {
    expect(expectationFrom(config({}), "production").robots).toBeUndefined();
  });

  it("finds the headers whatever their case", () => {
    const lower = {
      globalHeaders: {
        "content-security-policy": CSP,
        "x-robots-tag": "noindex",
      },
    };
    expect(expectationFrom(lower, "preview")).toEqual({
      csp: CSP,
      robots: "noindex",
      context: "preview",
    });
  });

  it("refuses a config with no policy, which would make the check pass on nothing", () => {
    expect(() => expectationFrom({ globalHeaders: {} }, "production")).toThrow(
      /Content-Security-Policy/,
    );
  });

  it("refuses a preview build that is not noindex, whatever its config says", () => {
    expect(() => expectationFrom(config({}), "preview")).toThrow(/noindex/);
  });
});

describe("parseLiveUrl", () => {
  it("accepts an https origin, with or without a trailing slash", () => {
    expect(parseLiveUrl("https://a-b.example.test")).toBe(
      "https://a-b.example.test",
    );
    expect(parseLiveUrl("https://a-b.example.test/")).toBe(
      "https://a-b.example.test",
    );
  });

  it.each([
    ["", "nothing"],
    ["not a url", "not a URL"],
    ["http://a.example.test", "plain http"],
    ["https://a.example.test/some/path", "a path"],
    ["https://a.example.test/?q=1", "a query"],
    ["https://user:pw@a.example.test", "credentials"],
  ])("refuses %j (%s)", (value) => {
    expect(() => parseLiveUrl(value)).toThrow(/URL/);
  });
});

const EXPECTED: LiveExpectation = {
  csp: CSP,
  robots: "noindex",
  context: "production",
};

/** A fake fetch that answers the home page and a made-up path as given. */
function site(
  home: { status?: number; headers?: Record<string, string> },
  missing: { status?: number } = {},
): { fetch: LiveFetch; asked: string[] } {
  const asked: string[] = [];
  const fetch: LiveFetch = async (url) => {
    asked.push(url);
    const isHome = new URL(url).pathname === "/";
    const answer = isHome ? home : missing;
    const headers = new Headers(isHome ? home.headers : {});
    return { status: answer.status ?? (isHome ? 200 : 404), headers };
  };
  return { fetch, asked };
}

/** The good headers without one of them. */
const without = (name: string) =>
  Object.fromEntries(Object.entries(GOOD).filter(([key]) => key !== name));

const GOOD = {
  "Content-Security-Policy": CSP,
  "Strict-Transport-Security": HSTS,
  "X-Robots-Tag": "noindex",
};

describe("checkLive", () => {
  const url = "https://live.example.test";

  it("passes a site that answers as the build says it should", async () => {
    const { fetch } = site({ headers: GOOD });
    expect(await checkLive({ url, expectation: EXPECTED, fetch })).toEqual([]);
  });

  it("asks the given address for the home page and for a made-up path, and nowhere else", async () => {
    const { fetch, asked } = site({ headers: GOOD });
    await checkLive({ url, expectation: EXPECTED, fetch });
    expect(asked).toHaveLength(2);
    expect(asked[0]).toBe(`${url}/`);
    const missing = new URL(asked[1]!);
    expect(missing.origin).toBe(url);
    expect(missing.pathname).toMatch(/^\/no-such-page-[a-z0-9]+$/);
  });

  it("uses a different made-up path each time, so no cache can answer for it", async () => {
    const first = site({ headers: GOOD });
    const second = site({ headers: GOOD });
    await checkLive({ url, expectation: EXPECTED, fetch: first.fetch });
    await checkLive({ url, expectation: EXPECTED, fetch: second.fetch });
    expect(first.asked[1]).not.toBe(second.asked[1]);
  });

  it("fails a policy that is not exactly the build's, showing both", async () => {
    const { fetch } = site({
      headers: { ...GOOD, "Content-Security-Policy": "default-src *" },
    });
    const failures = await checkLive({ url, expectation: EXPECTED, fetch });
    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain("Content-Security-Policy");
    expect(failures[0]).toContain(CSP);
    expect(failures[0]).toContain("default-src *");
  });

  it("fails a policy that only contains the build's", async () => {
    const { fetch } = site({
      headers: { ...GOOD, "Content-Security-Policy": `${CSP}; img-src *` },
    });
    expect(await checkLive({ url, expectation: EXPECTED, fetch })).toHaveLength(
      1,
    );
  });

  it("fails a missing policy", async () => {
    const { fetch } = site({ headers: without("Content-Security-Policy") });
    const failures = await checkLive({ url, expectation: EXPECTED, fetch });
    expect(failures.join("\n")).toMatch(/Content-Security-Policy.*missing/);
  });

  it("fails a missing HSTS header, and one with no lifetime", async () => {
    for (const headers of [
      without("Strict-Transport-Security"),
      { ...GOOD, "Strict-Transport-Security": "includeSubDomains" },
    ]) {
      const { fetch } = site({ headers });
      const failures = await checkLive({ url, expectation: EXPECTED, fetch });
      expect(failures.join("\n")).toContain("Strict-Transport-Security");
    }
  });

  it("fails a robots header that is not the one the context expects", async () => {
    const { fetch } = site({ headers: { ...GOOD, "X-Robots-Tag": "all" } });
    const failures = await checkLive({ url, expectation: EXPECTED, fetch });
    expect(failures.join("\n")).toContain("X-Robots-Tag");
  });

  it("fails a noindex that the build does not send, and a missing one that it does", async () => {
    const indexable: LiveExpectation = { ...EXPECTED, robots: undefined };
    const sends = site({ headers: GOOD });
    expect(
      (
        await checkLive({
          url,
          expectation: indexable,
          fetch: sends.fetch,
        })
      ).join("\n"),
    ).toContain("X-Robots-Tag");

    const omits = site({ headers: without("X-Robots-Tag") });
    expect(
      (
        await checkLive({ url, expectation: EXPECTED, fetch: omits.fetch })
      ).join("\n"),
    ).toContain("X-Robots-Tag");
    // And a site that rightly sends none passes.
    expect(
      await checkLive({
        url,
        expectation: indexable,
        fetch: site({ headers: without("X-Robots-Tag") }).fetch,
      }),
    ).toEqual([]);
  });

  it("fails a home page that is not status 200, without trusting its headers", async () => {
    const { fetch } = site({ status: 302, headers: GOOD });
    const failures = await checkLive({ url, expectation: EXPECTED, fetch });
    expect(failures.join("\n")).toMatch(/status 302/);
  });

  it("fails a made-up path that does not answer 404", async () => {
    const { fetch } = site({ headers: GOOD }, { status: 200 });
    const failures = await checkLive({ url, expectation: EXPECTED, fetch });
    expect(failures.join("\n")).toMatch(/404.*200|200.*404/);
  });

  it("reports every failure at once, not only the first", async () => {
    const { fetch } = site(
      { headers: { "Content-Security-Policy": "x" } },
      { status: 200 },
    );
    expect(await checkLive({ url, expectation: EXPECTED, fetch })).toHaveLength(
      4,
    );
  });

  it("gives every request a time limit and never follows a redirect, so a hung edge cannot stall a retry", async () => {
    const inits: unknown[] = [];
    const fetch: LiveFetch = async (_url, init) => {
      inits.push(init);
      return { status: 200, headers: new Headers() };
    };
    await checkLive({ url, expectation: EXPECTED, fetch });
    expect(inits).toHaveLength(2);
    for (const init of inits) {
      const { redirect, signal } = init as RequestInit;
      expect(redirect).toBe("manual");
      expect(signal).toBeInstanceOf(AbortSignal);
      expect(signal?.aborted).toBe(false);
    }
  });

  it("reports a request that fails as a failure, not an exception", async () => {
    const fetch: LiveFetch = async () => {
      throw new Error("getaddrinfo ENOTFOUND");
    };
    const failures = await checkLive({ url, expectation: EXPECTED, fetch });
    expect(failures.join("\n")).toContain("ENOTFOUND");
    expect(failures.length).toBeGreaterThan(0);
  });
});

describe("retry", () => {
  const noWait = async () => {};

  it("returns at once when the first attempt has no failures", async () => {
    let calls = 0;
    const failures = await retry(
      async () => {
        calls++;
        return [];
      },
      { attempts: 5, wait: noWait },
    );
    expect(failures).toEqual([]);
    expect(calls).toBe(1);
  });

  it("tries again after a failure, because a deploy can take a moment to reach every edge", async () => {
    let calls = 0;
    const failures = await retry(async () => (++calls < 3 ? ["not yet"] : []), {
      attempts: 5,
      wait: noWait,
    });
    expect(failures).toEqual([]);
    expect(calls).toBe(3);
  });

  it("gives up after the last attempt and returns that attempt's failures", async () => {
    let calls = 0;
    const failures = await retry(async () => [`failure ${++calls}`], {
      attempts: 3,
      wait: noWait,
    });
    expect(calls).toBe(3);
    expect(failures).toEqual(["failure 3"]);
  });

  it("waits between attempts and not after the last", async () => {
    const waits: number[] = [];
    await retry(async () => ["no"], {
      attempts: 3,
      delayMs: 7,
      wait: async (ms) => {
        waits.push(ms);
      },
    });
    expect(waits).toEqual([7, 7]);
  });
});
