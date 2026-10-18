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
  nav: "plain links, one per section with content · script adds the menu, number keys and current mark",
  footer:
    "served by Azure Static Web Apps · HTML revalidated on every load, hashed assets cached for a year",
  notFound:
    "static page · Static Web Apps serves it for any address that does not exist",
} as const;
