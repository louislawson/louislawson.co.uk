/** The parts of staticwebapp.config.json this site uses. Other keys pass through untouched. */
export interface StaticWebAppConfig {
  globalHeaders?: Record<string, string>;
  routes?: unknown[];
  responseOverrides?: Record<string, unknown>;
  [key: string]: unknown;
}

const ROBOTS_HEADER = "x-robots-tag";
const CSP_HEADER = "content-security-policy";

/** Where Cloudflare Web Analytics loads its script from, and where that script reports to. */
export const BEACON_SCRIPT_ORIGIN = "https://static.cloudflareinsights.com";
export const BEACON_REPORT_ORIGIN = "https://cloudflareinsights.com";

/** A policy as its directives, each a name and its sources; names compare without case. */
function parsePolicy(policy: string): [string, string[]][] {
  return policy
    .split(";")
    .map((directive) => directive.trim().split(/\s+/))
    .filter(([name]) => name)
    .map(([name, ...sources]) => [name!, sources]);
}

const writePolicy = (directives: [string, string[]][]) =>
  directives.map(([name, sources]) => [name, ...sources].join(" ")).join("; ");

const sameName = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/**
 * Sets a directive, replacing one of the same name, so a baseline that already has it does not end
 * up with it twice (a browser ignores the second, which would hide a mistake).
 */
function setDirective(policy: string, name: string, value: string): string {
  const kept = parsePolicy(policy).filter(([other]) => !sameName(other, name));
  return writePolicy([...kept, [name, value.split(" ")]]);
}

/**
 * Allows one more source in a directive, keeping the sources the baseline gives it. A directive
 * the baseline does not have starts at 'self', so it allows no more than default-src did plus
 * the one source.
 */
function allowSource(policy: string, name: string, source: string): string {
  const directives = parsePolicy(policy);
  const existing = directives.find(([other]) => sameName(other, name));
  if (existing === undefined) {
    return writePolicy([...directives, [name, ["'self'", source]]]);
  }
  if (!existing[1].includes(source)) existing[1].push(source);
  return writePolicy(directives);
}

/**
 * Applies the build-dependent part of the Static Web Apps configuration to the committed
 * baseline in public/staticwebapp.config.json:
 *
 * - the X-Robots-Tag header, which the deploy context and the launch switch decide (see
 *   shouldNoindex in site.ts);
 * - the content security policy's Trusted Types rules, which every build gets, and its script and
 *   connect sources for Cloudflare's analytics beacon, which only a build that includes the beacon
 *   gets. The baseline policy stays at `default-src 'self'` for the others.
 */
export function buildStaticWebAppConfig(
  baseline: StaticWebAppConfig,
  opts: { noindex: boolean; beacon: boolean },
): StaticWebAppConfig {
  const headers = Object.fromEntries(
    Object.entries(baseline.globalHeaders ?? {}).filter(
      ([name]) => name.toLowerCase() !== ROBOTS_HEADER,
    ),
  );
  if (opts.noindex) headers["X-Robots-Tag"] = "noindex";

  const cspName = Object.keys(headers).find(
    (name) => name.toLowerCase() === CSP_HEADER,
  );
  if (cspName === undefined) {
    // Adding directives to nothing would send a policy with no default-src, which blocks nothing.
    throw new Error(
      "the baseline staticwebapp.config.json has no Content-Security-Policy header",
    );
  }
  let csp = headers[cspName]!;
  if (opts.beacon) {
    csp = allowSource(csp, "script-src", BEACON_SCRIPT_ORIGIN);
    csp = allowSource(csp, "connect-src", BEACON_REPORT_ORIGIN);
  }
  csp = setDirective(csp, "require-trusted-types-for", "'script'");
  csp = setDirective(csp, "trusted-types", "'none'");
  headers[cspName] = csp;

  return { ...baseline, globalHeaders: headers };
}
