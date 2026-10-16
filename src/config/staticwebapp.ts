/** The parts of staticwebapp.config.json this site uses. Other keys pass through untouched. */
export interface StaticWebAppConfig {
  globalHeaders?: Record<string, string>;
  routes?: unknown[];
  responseOverrides?: Record<string, unknown>;
  [key: string]: unknown;
}

const ROBOTS_HEADER = "x-robots-tag";

/**
 * Applies the build-dependent part of the Static Web Apps configuration to the committed
 * baseline in public/staticwebapp.config.json: the X-Robots-Tag header, which the deploy
 * context and the launch switch decide (see shouldNoindex in site.ts).
 */
export function buildStaticWebAppConfig(
  baseline: StaticWebAppConfig,
  opts: { noindex: boolean },
): StaticWebAppConfig {
  const headers = Object.fromEntries(
    Object.entries(baseline.globalHeaders ?? {}).filter(
      ([name]) => name.toLowerCase() !== ROBOTS_HEADER,
    ),
  );
  if (opts.noindex) headers["X-Robots-Tag"] = "noindex";
  return { ...baseline, globalHeaders: headers };
}
