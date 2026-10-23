// The rules of the post-deploy check (scripts/check-live.ts), kept apart from it so Vitest can test
// them. The check asks a deployed site for its home page and for a path that does not exist, and
// compares what comes back with the staticwebapp.config.json the build generated. Nothing the
// site's build reads imports this, and Node runs the script on this file directly, so it imports
// nothing. It names no host: the address is the deploy step's output, and the site's own origin
// is read from the build.

export type LiveContext = "preview" | "production";

/** What the check needs to know about the build that was uploaded. */
export interface LiveExpectation {
  /** The policy the build generated, which the site must send unchanged. */
  csp: string;
  /** The X-Robots-Tag the build generated; none when the build sends none. */
  robots: string | undefined;
  context: LiveContext;
}

/** The part of the build's staticwebapp.config.json that the check reads. */
export interface LiveConfig {
  globalHeaders?: Record<string, string>;
}

/** The part of a response the check reads, which a real `fetch` response has. */
export interface LiveResponse {
  status: number;
  headers: Headers;
}

/** `fetch`, as far as the check uses it: a redirect is a result, never followed. */
export type LiveFetch = (
  url: string,
  init?: { redirect: "manual"; signal: AbortSignal },
) => Promise<LiveResponse>;

function headerOf(
  headers: Record<string, string> | undefined,
  name: string,
): string | undefined {
  const key = Object.keys(headers ?? {}).find(
    (candidate) => candidate.toLowerCase() === name.toLowerCase(),
  );
  return key === undefined ? undefined : headers?.[key];
}

/**
 * What the site must send, read from the build's own config. A config with no policy is an error,
 * not an expectation of none: the check would pass on a site that sent no policy at all.
 */
export function expectationFrom(
  config: LiveConfig,
  context: LiveContext,
): LiveExpectation {
  const csp = headerOf(config.globalHeaders, "Content-Security-Policy");
  if (csp === undefined || csp === "") {
    throw new Error(
      "the build's staticwebapp.config.json has no Content-Security-Policy header to check against",
    );
  }
  const robots = headerOf(config.globalHeaders, "X-Robots-Tag");
  // A preview's address is public, and a search engine must never index it, whatever the config
  // says: this does not trust the build to have got it right.
  if (context === "preview" && robots !== "noindex") {
    throw new Error(
      `a preview build must send X-Robots-Tag: noindex, but its config sends ${robots === undefined ? "none" : `"${robots}"`}`,
    );
  }
  return { csp, robots, context };
}

/** The site's origin from the deploy step's output: https, and nothing but a host. */
export function parseLiveUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`the live URL must be an https URL, got "${value}"`);
  }
  if (
    url.protocol !== "https:" ||
    url.username !== "" ||
    url.password !== "" ||
    url.pathname !== "/" ||
    url.search !== "" ||
    url.hash !== ""
  ) {
    throw new Error(
      `the live URL must be an https URL with no credentials, path, query or fragment, got "${value}"`,
    );
  }
  return url.origin;
}

/**
 * The origin the build was made for, read from its home page's canonical link: the build's own
 * record of where it is meant to be served, so the check keeps no second copy of the site's
 * address. A page without one is an error rather than a reason to trust any redirect.
 */
export function siteOriginFrom(html: string): string {
  const link = html.match(/<link\b[^>]*\brel="canonical"[^>]*>/)?.[0];
  const href = link?.match(/\bhref="([^"]*)"/)?.[1];
  if (href === undefined) {
    throw new Error(
      "the build's home page has no canonical link to read the site's origin from",
    );
  }
  try {
    return parseLiveUrl(href);
  } catch {
    throw new Error(
      `the build's canonical link must be an https address, got "${href}"`,
    );
  }
}

/** A path nothing is served at, different every time so that no cache can have an answer for it. */
function madeUpPath(): string {
  return `/no-such-page-${Math.random().toString(36).slice(2, 10)}`;
}

/** Long enough for a slow edge, short enough that a stalled connection leaves time to try again. */
const REQUEST_TIMEOUT_MS = 10_000;

async function request(
  fetch: LiveFetch,
  url: string,
): Promise<LiveResponse | string> {
  try {
    return await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    const reason =
      error instanceof Error
        ? [error.message, (error.cause as Error | undefined)?.message]
            .filter(Boolean)
            .join(": ")
        : String(error);
    return `the request for ${url} failed: ${reason}`;
  }
}

/** The statuses of a redirect that names where to go next. */
const REDIRECTS = new Set([301, 302, 303, 307, 308]);

/**
 * Asks the site for its home page and a made-up path, and lists everything that is not as expected.
 *
 * Once the site's domain is the default on the Static Web App, Azure redirects the deploy address
 * to it, and before then the domain does not resolve at all. So a production check accepts one
 * redirect from the deploy address, and only to exactly the build's site origin (`siteOrigin`),
 * and then checks that origin; with no redirect it checks the deploy address as it always did. A
 * preview has no `siteOrigin` and accepts no redirect: its own address is the one to check.
 */
export async function checkLive(opts: {
  url: string;
  siteOrigin?: string;
  expectation: LiveExpectation;
  fetch: LiveFetch;
}): Promise<string[]> {
  const { expectation, fetch } = opts;
  const failures: string[] = [];
  let url = opts.url;

  let home = await request(fetch, `${url}/`);
  if (
    typeof home !== "string" &&
    REDIRECTS.has(home.status) &&
    expectation.context === "production" &&
    opts.siteOrigin !== undefined &&
    url !== opts.siteOrigin
  ) {
    const location = home.headers.get("Location");
    // The origin compares scheme, host and port whole, so a lookalike host, another scheme or port,
    // and credentials in front of the host all differ from the site's; a relative address resolves
    // to the deploy host itself.
    const target =
      location === null ? undefined : URL.parse(location, `${url}/`)?.origin;
    if (target !== opts.siteOrigin) {
      failures.push(
        `${url}/ redirected to ${location ?? "no address (no Location header)"}, which is not the site origin ${opts.siteOrigin}`,
      );
      return failures;
    }
    url = opts.siteOrigin;
    home = await request(fetch, `${url}/`);
  }

  if (typeof home === "string") {
    failures.push(home);
  } else if (home.status !== 200) {
    // An error page's headers say nothing about the site, so they are not compared.
    failures.push(`${url}/ answered status ${home.status}, not 200`);
  } else {
    const csp = home.headers.get("Content-Security-Policy");
    if (csp === null) {
      failures.push("Content-Security-Policy is missing");
    } else if (csp !== expectation.csp) {
      failures.push(
        `Content-Security-Policy is not the one the build generated\n  expected: ${expectation.csp}\n  received: ${csp}`,
      );
    }

    const hsts = home.headers.get("Strict-Transport-Security");
    if (hsts === null || !/\bmax-age=\d+/i.test(hsts)) {
      failures.push(
        `Strict-Transport-Security is ${hsts === null ? "missing" : `"${hsts}", with no max-age`}`,
      );
    }

    const robots = home.headers.get("X-Robots-Tag");
    if (robots !== (expectation.robots ?? null)) {
      failures.push(
        `X-Robots-Tag is ${robots === null ? "missing" : `"${robots}"`}, but the ${expectation.context} build ${expectation.robots === undefined ? "sends none" : `sends "${expectation.robots}"`}`,
      );
    }
  }

  const missingUrl = `${url}${madeUpPath()}`;
  const missing = await request(fetch, missingUrl);
  if (typeof missing === "string") {
    failures.push(missing);
  } else if (missing.status !== 404) {
    failures.push(`${missingUrl} answered status ${missing.status}, not 404`);
  }

  return failures;
}

/**
 * Runs a check until it finds no failures or the attempts run out, and returns the last attempt's
 * failures. A deploy can take a moment to reach every edge, so a check that fails straight after one
 * is run again; one that still fails after a minute or so is a real failure.
 */
export async function retry(
  attempt: () => Promise<string[]>,
  opts: {
    attempts: number;
    delayMs?: number;
    wait?: (ms: number) => Promise<void>;
  },
): Promise<string[]> {
  const { attempts, delayMs = 15_000 } = opts;
  const wait =
    opts.wait ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  let failures: string[] = [];
  for (let n = 1; n <= attempts; n++) {
    failures = await attempt();
    if (failures.length === 0) return [];
    if (n < attempts) await wait(delayMs);
  }
  return failures;
}
