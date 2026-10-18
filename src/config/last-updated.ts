import { execFileSync } from "node:child_process";

/**
 * The date git prints for `--format=%cs` (YYYY-MM-DD), or nothing when the output is anything else,
 * including a date that does not exist.
 */
export function parseCommitDate(output: string): string | undefined {
  const date = output.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return undefined;
  const [year, month, day] = [match[1], match[2], match[3]].map(Number) as [
    number,
    number,
    number,
  ];
  const parsed = new Date(Date.UTC(year, month - 1, day));
  const exists =
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day;
  return exists ? date : undefined;
}

function gitLog(cwd: string): string {
  return execFileSync("git", ["log", "-1", "--format=%cs"], {
    cwd,
    encoding: "utf-8",
    // Nothing from git may reach the build's output, and a hung git must not hang the build.
    stdio: ["ignore", "pipe", "ignore"],
    timeout: 10_000,
  });
}

/**
 * The date of the last commit, as the footer shows it. The build runs from the project root. When
 * git is missing or the folder is not a repository (the temporary copies the build tests make have
 * no .git), there is no date and the footer leaves it out; this never throws.
 */
export function lastCommitDate(
  opts: { cwd?: string; run?: (cwd: string) => string } = {},
): string | undefined {
  const { cwd = process.cwd(), run = gitLog } = opts;
  try {
    return parseCommitDate(run(cwd));
  } catch {
    return undefined;
  }
}
