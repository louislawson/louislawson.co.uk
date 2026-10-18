export interface BuildInfo {
  /** The workflow run number: a plain positive count. */
  number: string;
  /** The short commit the build was made from: lower-case hex. */
  commit: string;
}

/**
 * What the deploy workflow says about this build: BUILD_NUMBER (the run number) and GIT_SHA (the
 * short head commit). A build with either missing or not in the shape a run number or a commit
 * has is a local one, and is nothing here: no half a statement, and nothing odd from the
 * environment reaches the page.
 */
export function parseBuildInfo(
  env: Record<string, string | undefined>,
): BuildInfo | undefined {
  const number = env.BUILD_NUMBER?.trim();
  const commit = env.GIT_SHA?.trim();
  if (number === undefined || commit === undefined) return undefined;
  if (!/^[1-9]\d{0,9}$/.test(number)) return undefined;
  if (!/^[0-9a-f]{7,40}$/.test(commit)) return undefined;
  return { number, commit };
}

/** The line the trace panel shows: "build 412 · commit 0af5e05", or "local build". */
export function buildLabel(info: BuildInfo | undefined): string {
  return info ? `build ${info.number} · commit ${info.commit}` : "local build";
}

/** This build's, read once from the environment. */
export const buildInfo = parseBuildInfo(process.env);
