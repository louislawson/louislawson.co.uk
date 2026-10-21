import { isPlaceholder } from "../content/todo.ts";

export type DeployContext = "local" | "preview" | "production";

const DEPLOY_CONTEXTS: readonly string[] = ["preview", "production"];

/** Flip to true at launch (Phase 8). While false, every build is noindex. */
const LAUNCH = false;

const DEFAULT_SITE_URL = "https://louislawson.co.uk";

/** The public repository, which the footer links to. */
export const REPOSITORY_URL =
  "https://github.com/louislawson/louislawson.co.uk";

/**
 * The token of the Cloudflare Web Analytics site for louislawson.co.uk. It is public: it ships in
 * every production page, so it is not a secret and lives here, not in PRIVATE-NOTES.md. While it is
 * a "TODO:" placeholder the beacon is left out.
 */
export const ANALYTICS_TOKEN = "5a3dff7ef1dd4aeeb0e9723ff20467fc";

function parseSiteUrl(value: string | undefined): string {
  const raw = value === undefined || value === "" ? DEFAULT_SITE_URL : value;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`SITE_URL must be an absolute http(s) URL, got "${raw}"`);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(`SITE_URL must be an absolute http(s) URL, got "${raw}"`);
  }
  // Only the origin is used (canonical URLs, the sitemap), so a path would be dropped silently.
  if (url.pathname !== "/" || url.search !== "" || url.hash !== "") {
    throw new Error(
      `SITE_URL must be an origin with no path, query or fragment, got "${raw}"`,
    );
  }
  return url.origin;
}

/**
 * Search engines may index only the launched production build. Preview URLs are public and
 * served from a different host, so after launch they would be indexed as duplicates of the real
 * site; a local build is never deployed, so it is never indexable either.
 */
export function shouldNoindex(opts: {
  launch: boolean;
  deployContext: DeployContext;
}): boolean {
  return !opts.launch || opts.deployContext !== "production";
}

/** Reads DEPLOY_CONTEXT, which the deploy workflow sets. An unset value is a local build. */
export function parseDeployContext(value: string | undefined): DeployContext {
  if (value === undefined || value === "") return "local";
  if (DEPLOY_CONTEXTS.includes(value)) return value as DeployContext;
  throw new Error(
    `DEPLOY_CONTEXT must be "preview" or "production" (or unset for a local build), got "${value}"`,
  );
}

/**
 * The token to put in the analytics beacon, or undefined when the page gets no beacon: only the
 * production build counts visits, and not while the token is still a placeholder. A token that is
 * neither is a mistake and fails the build in every context, because it is written into a page.
 */
export function beaconToken(opts: {
  deployContext: DeployContext;
  token: string;
}): string | undefined {
  const { deployContext, token } = opts;
  if (isPlaceholder(token)) return undefined;
  if (!/^[0-9a-f]{32}$/.test(token)) {
    throw new Error(
      `ANALYTICS_TOKEN must be 32 lower-case hex digits (or a "TODO:" placeholder), got "${token}"`,
    );
  }
  return deployContext === "production" ? token : undefined;
}

export interface Site {
  launch: boolean;
  url: string;
  deployContext: DeployContext;
  noindex: boolean;
  /** The analytics token for the beacon; undefined when this build has no beacon. */
  beaconToken: string | undefined;
}

/** Resolves the site configuration from the build environment. */
export function resolveSite(env: Record<string, string | undefined>): Site {
  const deployContext = parseDeployContext(env.DEPLOY_CONTEXT);
  return {
    launch: LAUNCH,
    url: parseSiteUrl(env.SITE_URL),
    deployContext,
    noindex: shouldNoindex({ launch: LAUNCH, deployContext }),
    beaconToken: beaconToken({ deployContext, token: ANALYTICS_TOKEN }),
  };
}

export const site: Site = resolveSite(process.env);
