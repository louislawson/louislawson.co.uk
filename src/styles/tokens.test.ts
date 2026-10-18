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
  // The hatch is a hi-vis stripe over whatever the placeholder sits on. Its strength is read from
  // the component that paints it, so changing it there changes what is measured here.
  const placeholder = readFileSync(
    new URL("../components/Placeholder.astro", import.meta.url),
    "utf-8",
  );
  const stripe =
    /color-mix\(in srgb, var\(--hivis\) (\d+)%, transparent\)/.exec(
      placeholder,
    );
  if (!stripe) throw new Error("Placeholder.astro paints no hi-vis stripe");
  const hatch = (ground: string) =>
    over(colour("hivis"), Number(stripe[1]) / 100, colour(ground));

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
    // Motion is cut short, not removed, so what an animation or a transition ends on still shows.
    for (const declaration of [
      "animation-duration: 0.01ms !important",
      "animation-iteration-count: 1 !important",
      "transition-duration: 0.01ms !important",
    ]) {
      expect(css).toMatch(
        new RegExp(
          `@media \\(prefers-reduced-motion: reduce\\) \\{[^@]*${declaration}`,
        ),
      );
    }
    expect(css).not.toMatch(/animation: none/);
    expect(css).not.toMatch(/transition: none/);
  });

  it("has one visually hidden utility with the full pattern, for the placeholder label, the skip link and key hints", () => {
    const hidden = rule(".vh");
    for (const declaration of [
      "position: absolute",
      "width: 1px",
      "height: 1px",
      "margin: -1px",
      "padding: 0",
      "border: 0",
      "overflow: hidden",
      "clip-path: inset(50%)",
      "white-space: nowrap",
    ]) {
      expect(hidden).toContain(declaration);
    }
  });

  it("has the navigation bar's height as one token, which the bar, its dropdown and the scroll offset share", () => {
    expect(token("nav-height")).toBe("58px");
    // A link to a section lands below the sticky bar, with the 38px the mock leaves under it.
    expect(rule("html")).toContain(
      "scroll-padding-top: calc(var(--nav-height) + 38px)",
    );
  });

  it("keeps the footer at the foot of a short page", () => {
    const body = rule("body");
    expect(body).toContain("display: flex");
    expect(body).toContain("flex-direction: column");
    expect(body).toContain("min-height: 100dvh");
    expect(rule("main")).toContain("flex: 1 0 auto");
  });

  it("has the page's width and gutters in one class", () => {
    const wrap = rule(".wrap");
    expect(wrap).toContain("padding-inline: var(--gutter)");
    expect(wrap).toContain("max-width: var(--wrap-max)");
    expect(wrap).toContain("margin-inline: auto");
  });

  it("shows the skip link, in hi-vis, only while it has focus", () => {
    // It starts as the visually hidden utility (the markup carries both classes) and this is
    // what it becomes on focus. The page is dark, so the link is a hi-vis block: bg on hi-vis.
    const focused = rule(".skip:focus");
    for (const declaration of [
      "background: var(--hivis)",
      "color: var(--bg)",
      "clip-path: none",
      "overflow: visible",
      "width: auto",
      "height: auto",
    ]) {
      expect(focused).toContain(declaration);
    }
  });

  it("does not outline <main> when the skip link moves focus there", () => {
    expect(rule("main:focus-visible")).toContain("outline: none");
  });

  it("lets the hidden attribute win over a component's display rule", () => {
    expect(rule("[hidden]")).toContain("display: none !important");
  });

  it("sets controls in the page font instead of the browser's", () => {
    const controls = rule("button,\ninput,\ntextarea,\nselect");
    expect(controls).toContain("font: inherit");
  });
});

describe("the action button", () => {
  it("is at least 48px tall, square, with a 1px line", () => {
    const button = rule(".btn");
    expect(button).toContain("min-height: 48px");
    expect(button).toContain("border: 1px solid var(--line-strong)");
    expect(button).not.toContain("border-radius");
    expect(button).not.toContain("box-shadow");
  });

  it("has a hi-vis form with dark text, which is the page's one main action", () => {
    const hv = rule(".btn--hv");
    expect(hv).toContain("background: var(--hivis)");
    expect(hv).toContain("color: var(--bg)");
    // The hover state keeps the dark text, which a plain link's hover colour would override.
    expect(rule(".btn--hv:hover")).toContain("color: var(--bg)");
  });

  it("moves its arrow on hover, which the reduced-motion rule cuts short", () => {
    expect(rule(".btn:hover svg")).toContain("transform: translateX(3px)");
  });
});

describe("inspect mode", () => {
  it("outlines each labelled part in dashed hi-vis, without taking a sticky part out of its place", () => {
    // :where() has no weight of its own, so the bar's own position: sticky is not overridden.
    const outline = rule(":where(body.inspecting) [data-inspect]");
    expect(outline).toContain("position: relative");
    expect(outline).toContain("outline: 1px dashed var(--hivis)");
    expect(outline).toContain("outline-offset: 4px");
  });

  it("writes the label above its part, from its data-inspect attribute, in a hi-vis tag", () => {
    const label = rule("body.inspecting [data-inspect]::after");
    for (const declaration of [
      "content: attr(data-inspect)",
      "position: absolute",
      "background: var(--hivis)",
      "color: var(--bg)",
      "font: 600 11px/1.35 var(--mono)",
      "font-stretch: 88%",
      "max-width: min(92vw, 40rem)",
      "pointer-events: none",
      "transform: translateY(-100%)",
    ]) {
      expect(label).toContain(declaration);
    }
    // A label wraps, and is never cut short: a fact with its end missing says something else.
    expect(label).not.toContain("text-overflow");
    expect(label).not.toContain("white-space: nowrap");
  });

  it("sets the label's own letter spacing, not the part's: a heading's negative tracking would overprint it", () => {
    // letter-spacing in em is inherited as a length, so the name's -0.04em at 117px reaches the
    // 11px label as about -4.7px.
    expect(rule("body.inspecting [data-inspect]::after")).toContain(
      "letter-spacing: normal",
    );
  });

  it("can write the label below instead, at the right, for a part at the top of the window", () => {
    // Below, because there is no room above the bar; at the right, so it does not sit where the
    // label of the content under the bar goes.
    const below = rule("body.inspecting [data-inspect-below]::after");
    expect(below).toContain("bottom: -4px");
    expect(below).toContain("right: 0");
    expect(below).toContain("left: auto");
    expect(below).toContain("transform: translateY(100%)");
  });

  it("draws a 12-column grid over the page, that clicks pass through", () => {
    // Whitespace as a browser reads it, since the formatter wraps the long values.
    const grid = rule("body.inspecting::before")
      .replace(/\s+/g, " ")
      .replace(/\( /g, "(")
      .replace(/ \)/g, ")");
    expect(grid).toContain("position: fixed");
    expect(grid).toContain("pointer-events: none");
    // One line per column: a 1px rule, tiled at a twelfth of the content box, plus the gap.
    expect(grid).toContain("linear-gradient(90deg");
    expect(grid).toContain(
      "background-size: calc((100% + var(--col-gap)) / 12) 100%",
    );
  });

  it("draws the grid in the same box as .wrap, whatever the scrollbar, from one width token", () => {
    // The overlay is a fixed box with .wrap's width, centred, and its columns are measured in its
    // own content box. Measuring in 100vw instead would include a classic scrollbar's width, and
    // the lines would drift off the real columns.
    expect(token("wrap-max")).toBe("1520px");
    const grid = rule("body.inspecting::before");
    expect(grid).toContain("max-width: var(--wrap-max)");
    expect(grid).toContain("padding-inline: var(--gutter)");
    expect(grid).toContain("margin-inline: auto");
    expect(grid).toContain("background-origin: content-box");
    expect(grid).not.toMatch(/\d+vw/);
    expect(grid).not.toContain("1520px");
  });

  it("moves the page's content down by one rule, for the bar's label and the content's own", () => {
    // The bar's label hangs below it (up to three lines on a phone) and the first content's label
    // sits above that content, so without room they overlap. It is room for both, and only here.
    expect(rule("body.inspecting main")).toContain("padding-top: 6rem");
    expect(rule("main")).not.toContain("padding-top");
  });

  it("styles nothing outside inspect mode, so a visitor never sees a label", () => {
    const selectors = [...css.matchAll(/^([^\n{}]*\[data-inspect[^\n{]*)\{/gm)];
    expect(selectors.length).toBeGreaterThan(0);
    for (const [, selector] of selectors) {
      expect(
        selector,
        "a data-inspect rule not under body.inspecting",
      ).toContain("body.inspecting");
    }
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
