// No imports: the placeholder-listing script runs this under plain Node in CI, without an install.

export const PLACEHOLDER_PREFIX = "TODO:";

export function isPlaceholder(value: unknown): boolean {
  return typeof value === "string" && value.startsWith(PLACEHOLDER_PREFIX);
}

/**
 * What a placeholder says is missing: the text after the prefix. A value with nothing after the
 * prefix keeps it, so the hatch still has something to show.
 */
export function placeholderHint(value: string): string {
  if (!isPlaceholder(value)) return value;
  const hint = value.slice(PLACEHOLDER_PREFIX.length).trim();
  return hint === "" ? PLACEHOLDER_PREFIX : hint;
}

/**
 * True when the text mentions TODO or TODOs as a word, in any case. This is the one rule for a
 * half-finished value: the schemas allow it only when the whole value is a placeholder, a
 * project's Markdown body (which no schema covers) must not have it, and the placeholder listing
 * reports every line that does.
 */
export function containsTodo(value: string): boolean {
  return /\btodos?\b/i.test(value);
}
