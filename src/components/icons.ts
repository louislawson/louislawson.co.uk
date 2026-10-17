/**
 * The site's icons, drawn by hand on a 24px grid: one path string per stroke, no fill. Later pull
 * requests add the ones they need here. There is no icon library.
 */
export const ICONS = {
  /** Points right: actions that go on to something. */
  arrow: ["M4 12h15", "M13 6l6 6-6 6"],
  /** Points up and right: links that leave the site. */
  external: ["M7 17L17 7", "M9 7h8v8"],
} as const satisfies Record<string, readonly string[]>;

export type IconName = keyof typeof ICONS;
