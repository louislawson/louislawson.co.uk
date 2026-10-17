// No imports: the placeholder-listing script runs this under plain Node in CI, without an install.

export const PLACEHOLDER_PREFIX = "TODO:";

/** Shown to screen readers before a placeholder on preview and local builds. */
export const PLACEHOLDER_LABEL = "Placeholder:";

export function isPlaceholder(value: unknown): boolean {
  return typeof value === "string" && value.startsWith(PLACEHOLDER_PREFIX);
}

/**
 * True when the text mentions TODO as a word anywhere, in any case. The schemas allow that only
 * when the whole value is a placeholder.
 */
export function containsTodo(value: string): boolean {
  return /\btodo\b/i.test(value);
}

/**
 * The same check for a project's Markdown body, which no schema covers, and which also catches
 * "TODOs". A body with a TODO anywhere is not real, so production leaves the project out.
 */
export function bodyContainsTodo(body: string): boolean {
  return /\btodos?\b/i.test(body);
}
