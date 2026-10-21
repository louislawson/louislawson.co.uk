import { readFileSync } from "node:fs";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { describe, expect, it } from "vitest";
import { INSPECT_LABELS } from "../inspect-labels";
import Trace from "./Trace.astro";

async function render(props: Record<string, unknown> = {}): Promise<string> {
  const container = await AstroContainer.create();
  const html = await container.renderToString(Trace, { props });
  return html.replace(/\s+/g, " ");
}

/**
 * The code of a component's one script, whatever attributes its tag has. It fails when there is
 * none or it is empty, so a check on it cannot pass for want of something to look at.
 */
function scriptOf(source: string): string {
  const scripts = [...source.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)];
  expect(scripts, "exactly one <script> block").toHaveLength(1);
  const code = scripts[0]![1]!;
  expect(code.length, "the script is empty").toBeGreaterThan(200);
  return code;
}

/** The opening tag of the first element with this attribute. */
const tagWith = (html: string, attribute: string) =>
  new RegExp(`<[a-z0-9]+[^>]*\\s${attribute}[\\s=>][^>]*>`).exec(html)?.[0];

describe("<Trace>", () => {
  it("is a figure captioned with what it shows, and a place for the total", async () => {
    const html = await render();
    expect(html).toMatch(/^<figure\b[^>]*\sdata-trace\b/);
    expect(html).toMatch(/<figcaption[^>]*>.*how this page reached you/);
    expect(tagWith(html, "data-trace-total")).toBeDefined();
  });

  it("labels the panel for inspect mode: how it is measured, and that nothing is sent", async () => {
    const html = await render();
    expect(html).toMatch(
      new RegExp(`^<figure[^>]*data-inspect="${INSPECT_LABELS.trace}"`),
    );
  });

  it("has a list of the steps, named for assistive technology, empty until the script has measured", async () => {
    const html = await render();
    const list = tagWith(html, "data-trace-hops");
    expect(list).toMatch(/^<ol\b/);
    expect(list).toMatch(/aria-label="Steps this page took to reach you/);
    expect(list).toMatch(/\shidden\b/);
    expect(html).toMatch(/<ol[^>]*>\s*<\/ol>/);
  });

  it("says without JavaScript that the timings need it, rather than showing empty values", async () => {
    const html = await render();
    const note = /<p[^>]*data-trace-nojs[^>]*>(.*?)<\/p>/.exec(html)?.[1];
    expect(note).toMatch(/JavaScript/);
    expect(note).toMatch(/measured in your browser/);
    // Shown by default: it is the script that takes it away.
    expect(tagWith(html, "data-trace-nojs")).not.toMatch(/\shidden\b/);
  });

  it("holds back what only works with the script: the measured note and the replay button", async () => {
    const html = await render();
    expect(tagWith(html, "data-trace-measured")).toMatch(/\shidden\b/);
    const replay = tagWith(html, "data-trace-replay");
    expect(replay).toMatch(/^<button\b/);
    expect(replay).toMatch(/type="button"/);
    expect(replay).toMatch(/\shidden\b/);
    expect(html).toMatch(/<button[^>]*>\s*replay\s*<\/button>/);
  });

  it("shows the build and the commit from the build info", async () => {
    const html = await render({ build: { number: "412", commit: "0af5e05" } });
    expect(html).toContain("build 412 · commit 0af5e05");
    expect(html).not.toContain("local build");
  });

  it("says local build when there is no build info", async () => {
    expect(await render()).toContain("local build");
    expect(await render({ build: undefined })).toContain("local build");
  });

  it("shows the build line without the script: it is not a measurement", async () => {
    const html = await render({ build: { number: "412", commit: "0af5e05" } });
    const build = /<span[^>]*trace__build[^>]*>/.exec(html)?.[0];
    expect(build).toBeDefined();
    expect(build).not.toMatch(/\shidden\b/);
  });

  it("has no inline style and no inline script", async () => {
    const html = await render({ build: { number: "412", commit: "0af5e05" } });
    expect(html).not.toMatch(/<[a-z][^>]*\sstyle\s*=/i);
    expect(html).not.toMatch(/<script(?![^>]*\ssrc=)/);
  });

  it("builds its steps from the page's own script with DOM calls, never from a string of HTML", () => {
    const source = readFileSync(
      new URL("./Trace.astro", import.meta.url),
      "utf-8",
    );
    const script = scriptOf(source);
    expect(script).not.toMatch(/innerHTML|outerHTML|insertAdjacentHTML/);
    // And sets its custom properties through the CSSOM, which the policy allows, not as a style
    // attribute, which it does not.
    expect(script).not.toMatch(/setAttribute\(\s*["']style["']/);
    expect(script).toContain("setProperty");
  });

  it("animates the steps themselves, never a pseudo-element: a browser that ignores that option would animate the whole row", () => {
    const script = scriptOf(
      readFileSync(new URL("./Trace.astro", import.meta.url), "utf-8"),
    );
    expect(script).toContain(".animate(");
    expect(script).not.toContain("pseudoElement");
  });

  it("measures with the Navigation Timing API and the largest paint, in the browser", () => {
    const source = readFileSync(
      new URL("./Trace.astro", import.meta.url),
      "utf-8",
    );
    expect(source).toContain('getEntriesByType("navigation")');
    expect(source).toContain('"largest-contentful-paint"');
  });

  it("lets a long host name break anywhere, so a preview's address stays inside the panel on a phone", () => {
    // "DNS lookup for black-cliff-0bfcda103-41.westeurope.3.azurestaticapps.net" has no space to
    // break at, and would run out of the panel without this.
    const source = readFileSync(
      new URL("./Trace.astro", import.meta.url),
      "utf-8",
    );
    const rule =
      /\.hop__what\)\s*\{([^}]*)\}/.exec(source)?.[1] ??
      /\.hop__what[^{]*\{([^}]*)\}/.exec(source)?.[1] ??
      "";
    expect(rule).toContain("overflow-wrap: anywhere");
  });

  it("keeps the total on one line while it fits, so on a phone it is the caption that wraps", () => {
    const source = readFileSync(
      new URL("./Trace.astro", import.meta.url),
      "utf-8",
    );
    const total = /\.trace__total\s*\{([^}]*)\}/.exec(source)?.[1] ?? "";
    // It never shrinks, so it keeps the width of its own text, and the caption takes what is left.
    expect(total).toContain("flex: none");
    expect(total).not.toContain("flex-shrink");
    expect(total).not.toContain("white-space: nowrap");
    const caption = /\.trace__title\s*\{([^}]*)\}/.exec(source)?.[1] ?? "";
    expect(caption).toContain("flex: 1 1 0");
  });

  it("breaks the total, and moves it to its own row, rather than run out of the panel at twice the text size", () => {
    const source = readFileSync(
      new URL("./Trace.astro", import.meta.url),
      "utf-8",
    );
    const total = /\.trace__total\s*\{([^}]*)\}/.exec(source)?.[1] ?? "";
    expect(total).toContain("max-width: 100%");
    expect(total).toContain("overflow-wrap: anywhere");
    const head = /\.trace__head\s*\{([^}]*)\}/.exec(source)?.[1] ?? "";
    expect(head).toContain("flex-wrap: wrap");
  });

  it("holds the panel still under reduced motion, which the script reads", () => {
    const source = readFileSync(
      new URL("./Trace.astro", import.meta.url),
      "utf-8",
    );
    expect(source).toContain("(prefers-reduced-motion: reduce)");
  });
});
