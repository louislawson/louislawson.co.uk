import { bodyContainsTodo } from "./todo.ts";

// Logic for `npm run placeholders` (scripts/placeholders.ts), kept here so Vitest can test it. It
// imports nothing but todo.ts, so CI can run the script under plain Node without an install.

export interface PlaceholderHit {
  file: string;
  /** Counting from 1. */
  line: number;
  /** The line, trimmed. */
  text: string;
}

const CONTENT_EXTENSIONS = /\.(md|mdx|json|ya?ml)$/;

/**
 * The content files: the Markdown and data files under src/content, and the profile. The
 * TypeScript that implements the content model is not content, and mentions TODO in its own text.
 */
export function isContentFile(path: string): boolean {
  const file = path.replaceAll("\\", "/");
  if (file === "src/data/profile.ts") return true;
  return file.startsWith("src/content/") && CONTENT_EXTENSIONS.test(file);
}

/** A comment line explains a placeholder without being one. Only code files have them. */
function isCommentLine(file: string, line: string): boolean {
  return /\.tsx?$/.test(file) && /^(\/\/|\/\*|\*)/.test(line.trimStart());
}

/** Every line of a file that holds a placeholder, by the same rule the body check uses. */
export function findPlaceholders(
  file: string,
  source: string,
): PlaceholderHit[] {
  return source
    .split(/\r?\n/)
    .flatMap((line, index) =>
      bodyContainsTodo(line) && !isCommentLine(file, line)
        ? [{ file, line: index + 1, text: line.trim() }]
        : [],
    );
}

const plural = (count: number, word: string) =>
  `${count} ${word}${count === 1 ? "" : "s"}`;

/** One GitHub warning with the count, or nothing when there are none. GitHub shows at most 10 annotations per step. */
export function annotation(hits: PlaceholderHit[]): string | undefined {
  if (hits.length === 0) return undefined;
  const verb = hits.length === 1 ? "remains" : "remain";
  return `::warning title=Placeholders::${plural(hits.length, "placeholder")} ${verb} in the content. The full list is in the job summary.`;
}

const cell = (text: string) =>
  text.replaceAll("|", "\\|").replaceAll("`", "'").replaceAll("<", "&lt;");

/** The job summary: the count and every placeholder as file:line. */
export function summary(hits: PlaceholderHit[]): string {
  if (hits.length === 0) {
    return "## Placeholders\n\nNo placeholders remain in the content.\n";
  }
  return [
    "## Placeholders",
    "",
    `${plural(hits.length, "placeholder")} remain in the content. Production leaves them out, and the launch gate fails while the required ones remain.`,
    "",
    "| Where | Text |",
    "| --- | --- |",
    ...hits.map((hit) => `| \`${hit.file}:${hit.line}\` | ${cell(hit.text)} |`),
    "",
  ].join("\n");
}
