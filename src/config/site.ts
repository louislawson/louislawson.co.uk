export type DeployContext = "local" | "preview" | "production";

const DEPLOY_CONTEXTS: readonly string[] = ["preview", "production"];

/** Flip to true at launch (Phase 8). While false, every build is noindex. */
const LAUNCH = false;

const DEFAULT_SITE_URL = "https://louislawson.co.uk";

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

export interface Site {
  launch: boolean;
  url: string;
  deployContext: DeployContext;
  noindex: boolean;
}

/** Resolves the site configuration from the build environment. */
export function resolveSite(env: Record<string, string | undefined>): Site {
  const deployContext = parseDeployContext(env.DEPLOY_CONTEXT);
  return {
    launch: LAUNCH,
    url: parseSiteUrl(env.SITE_URL),
    deployContext,
    noindex: shouldNoindex({ launch: LAUNCH, deployContext }),
  };
}

export const site: Site = resolveSite(process.env);
