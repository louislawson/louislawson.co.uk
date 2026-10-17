import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// The stylesheet is the source of truth for the tokens, so the contrast of every pairing is
// measured from what it declares: a token change that makes text unreadable fails here.
const css = `\n${readFileSync(new URL("./global.css", import.meta.url), "utf-8")}`;

/** The declarations of the first rule with exactly this selector, outside any at-rule. */
function rule(selector: string): string {
  const start = css.indexOf(`\n${selector} {`);
  if (start === -1) throw new Error(`global.css has no rule for ${selector}`);
  return css.slice(css.indexOf("{", start) + 1, css.indexOf("}", start));
}

function token(name: string): string {
  const match = new RegExp(`--${name}:\\s*([^;]+);`).exec(rule(":root"));
  if (!match) throw new Error(`global.css declares no --${name}`);
  return match[1]!.trim();
}

type Rgb = [number, number, number];

function rgb(hex: string): Rgb {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!match) throw new Error(`Not a six-digit hex colour: ${hex}`);
  return [match[1]!, match[2]!, match[3]!].map((h) => parseInt(h, 16)) as Rgb;
}

/** WCAG 2.2 relative luminance. */
function luminance([r, g, b]: Rgb): number {
  const [lr, lg, lb] = [r, g, b].map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as Rgb;
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}

function contrast(a: Rgb, b: Rgb): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light! + 0.05) / (dark! + 0.05);
}

/** A colour painted at some opacity over a ground. */
function over(colour: Rgb, alpha: number, ground: Rgb): Rgb {
  return colour.map((c, i) => c * alpha + ground[i]! * (1 - alpha)) as Rgb;
}

describe("the contrast helper", () => {
  it("measures black on white as 21:1 and a colour on itself as 1:1", () => {
    expect(contrast(rgb("#ffffff"), rgb("#000000"))).toBeCloseTo(21, 5);
    expect(contrast(rgb("#0d0e0c"), rgb("#0d0e0c"))).toBeCloseTo(1, 5);
  });

  it("matches a published WCAG example: #767676 on white is 4.54:1", () => {
    expect(contrast(rgb("#767676"), rgb("#ffffff"))).toBeCloseTo(4.54, 2);
  });
});

describe("the design tokens", () => {
  // The direction contract's OWN-WORLD block, written out here so a drift in either place shows.
  it.each([
    ["bg", "#0d0e0c"],
    ["panel", "#151713"],
    ["line", "#2b2e28"],
    ["line-strong", "#4a4e45"],
    ["bone", "#e9e7e0"],
    ["dim", "#a3a59b"],
    ["hivis", "#ff6b1a"],
    ["ok", "#9bdc6e"],
  ])("--%s is %s", (name, value) => {
    expect(token(name).toLowerCase()).toBe(value);
  });

  it("names Martian Mono Variable first and falls back to the system monospace", () => {
    expect(token("mono")).toBe(
      '"Martian Mono Variable", ui-monospace, monospace',
    );
  });

  it("is dark only", () => {
    expect(rule(":root")).toContain("color-scheme: dark");
  });
});

describe("text contrast", () => {
  const colour = (name: string) => rgb(token(name));
  // The hatch is a hi-vis stripe at 16% over whatever the placeholder sits on.
  const hatch = (ground: string) => over(colour("hivis"), 0.16, colour(ground));

  // WCAG 1.4.3: 4.5:1 for text. Each pair is a text colour on a ground it is used on.
  const TEXT: [string, string, () => Rgb, () => Rgb][] = [
    ["bone", "bg", () => colour("bone"), () => colour("bg")],
    ["bone", "panel", () => colour("bone"), () => colour("panel")],
    ["dim", "bg", () => colour("dim"), () => colour("bg")],
    ["dim", "panel", () => colour("dim"), () => colour("panel")],
    ["hivis", "bg", () => colour("hivis"), () => colour("bg")],
    ["hivis", "panel", () => colour("hivis"), () => colour("panel")],
    ["ok", "bg", () => colour("ok"), () => colour("bg")],
    ["ok", "panel", () => colour("ok"), () => colour("panel")],
    // Selected text, and the label on a hi-vis button.
    ["bg", "hivis", () => colour("bg"), () => colour("hivis")],
    ["bone", "hatch on bg", () => colour("bone"), () => hatch("bg")],
    ["dim", "hatch on bg", () => colour("dim"), () => hatch("bg")],
    ["bone", "hatch on panel", () => colour("bone"), () => hatch("panel")],
    ["dim", "hatch on panel", () => colour("dim"), () => hatch("panel")],
  ];

  it.each(TEXT)("%s on %s is at least 4.5:1", (_text, _ground, fg, bg) => {
    expect(contrast(fg(), bg())).toBeGreaterThanOrEqual(4.5);
  });

  // WCAG 1.4.11: 3:1 for what shows where the keyboard is.
  it.each(["bg", "panel"])("the focus ring on %s is at least 3:1", (ground) => {
    expect(contrast(colour("hivis"), colour(ground))).toBeGreaterThanOrEqual(3);
  });
});

describe("the browser surfaces", () => {
  it("themes the selection and the caret from the palette", () => {
    expect(rule("::selection")).toContain("background: var(--hivis)");
    expect(rule("::selection")).toContain("color: var(--bg)");
    expect(rule("body")).toContain("caret-color: var(--hivis)");
  });

  it("draws the focus ring in hi-vis", () => {
    expect(rule(":focus-visible")).toMatch(/outline: 2px solid var\(--hivis\)/);
  });

  it("themes the scrollbar, the underline offset and the numerals", () => {
    expect(rule("html")).toContain(
      "scrollbar-color: var(--line-strong) var(--bg)",
    );
    expect(rule("a")).toContain("text-underline-offset: 0.25em");
    expect(rule("body")).toContain("font-variant-numeric: tabular-nums");
  });

  it("sets the body in Martian Mono at width 92", () => {
    expect(rule("body")).toContain("font-family: var(--mono)");
    expect(rule("body")).toContain("font-stretch: 92%");
  });

  it("stops motion for people who ask for less of it", () => {
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\) \{[^@]*scroll-behavior: auto/,
    );
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\) \{[^@]*animation: none/,
    );
  });
});

describe("the stylesheet and the content security policy", () => {
  it("loads the font from the package, with no external address", () => {
    expect(css).toContain(
      '@import "@fontsource-variable/martian-mono/wdth.css"',
    );
    expect(css).not.toMatch(/https?:\/\//);
    expect(css).not.toMatch(/url\(\s*["']?data:/);
  });
});
