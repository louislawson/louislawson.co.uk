/**
 * What inspect mode says about each labelled part: one line above it, in the console's lower case,
 * with the parts of a sentence joined by "·". Every label states a fact about the real build, and
 * inspect-labels.test.ts holds the ones about a setting to that setting.
 *
 * The labels are section-level, never per element. This file holds the shell's: the bar, the
 * footer and the 404 page's content, and then each section of the home page, added as it is built.
 */
export const INSPECT_LABELS = {
  hero: "h1 · Martian Mono 800 · static HTML, no JavaScript",
  trace:
    "measured in your browser by the Navigation Timing API · the trace sends nothing",
  projects: "generated at build from src/content/projects/*.md",
  skills: "from profile.ts · 'seen in' codes checked at build",
  certifications:
    "from profile.ts · every verify link checked as a web address at build",
  garage: "photos: metadata stripped before commit · Metadata check in CI",
  contact: "mailto only · no forms, no backend, no cookies",
  nav: "plain links, one per section with content · script adds the menu, number keys and current mark",
  footer:
    "served by Azure Static Web Apps · HTML revalidated on every load, hashed assets cached for a year",
  notFound:
    "static page · Static Web Apps serves it for any address that does not exist",
} as const;

/**
 * A project page's label: the page is made from one file, so the label names it. The name is the
 * file's own, taken from its path (the id is the name slugged, which differs for a name with
 * capitals or spaces), and the folder is the loader's.
 */
export function projectPageLabel(entry: {
  id: string;
  filePath?: string | undefined;
}): string {
  const file = entry.filePath?.split(/[\\/]/).pop() ?? `${entry.id}.md`;
  return `generated at build from src/content/projects/${file}`;
}
