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

/**
 * Sets directives in a policy, replacing a directive of the same name, so a baseline that already
 * has one does not end up with it twice (a browser ignores the second, which would hide a mistake).
 */
function withDirectives(
  policy: string,
  directives: [string, string][],
): string {
  const names = new Set(directives.map(([name]) => name));
  const kept = policy
    .split(";")
    .map((directive) => directive.trim())
    .filter((directive) => directive && !names.has(directive.split(/\s+/)[0]!));
  return [
    ...kept,
    ...directives.map(([name, value]) => `${name} ${value}`),
  ].join("; ");
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
  const additions: [string, string][] = [];
  if (opts.beacon) {
    additions.push(
      ["script-src", `'self' ${BEACON_SCRIPT_ORIGIN}`],
      ["connect-src", `'self' ${BEACON_REPORT_ORIGIN}`],
    );
  }
  additions.push(
    ["require-trusted-types-for", "'script'"],
    ["trusted-types", "'none'"],
  );
  headers[cspName] = withDirectives(headers[cspName]!, additions);

  return { ...baseline, globalHeaders: headers };
}
