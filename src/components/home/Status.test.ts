import { readFileSync } from "node:fs";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { describe, expect, it } from "vitest";
import Status from "./Status.astro";

async function render(props: Record<string, unknown>): Promise<string> {
  const container = await AstroContainer.create();
  const html = await container.renderToString(Status, { props });
  return html.replace(/\s+/g, " ");
}

const style = () =>
  /<style>([\s\S]*)<\/style>/.exec(
    readFileSync(new URL("./Status.astro", import.meta.url), "utf-8"),
  )?.[1] ?? "";

describe("<Status>", () => {
  it.each([
    ["in-service", "in service"],
    ["commissioning", "commissioning"],
    ["complete", "complete"],
    ["archived", "archived"],
  ])(
    "shows %s as the word %s, with a marker, in the cell the layout places",
    async (status, word) => {
      const html = await render({ status });
      expect(html).toMatch(/^<span class="run__status"/);
      expect(html).toMatch(
        new RegExp(`class="status status--${status}"[^>]*>\\s*${word}\\s*<`),
      );
    },
  );

  it("hatches a placeholder in the same cell, with no marker", async () => {
    const html = await render({
      status: "TODO: status",
      context: "preview",
    });
    expect(html).toMatch(/^<span class="run__status"[^>]*>\s*<span class="ph"/);
    expect(html).not.toContain("status--");
  });

  it("shows nothing but the empty cell for a placeholder on production", async () => {
    const html = await render({
      status: "TODO: status",
      context: "production",
    });
    expect(html).not.toContain('class="ph"');
    expect(html).not.toContain("TODO:");
  });

  it("draws every marker with a border as well as any fill, so forced colours, which drop a background, still show all four", () => {
    // Windows High Contrast removes background colours and keeps borders: a marker that is only a
    // background would vanish, and the four states would no longer look alike.
    for (const status of [
      "in-service",
      "commissioning",
      "complete",
      "archived",
    ]) {
      const rule = new RegExp(
        `\\.status--${status}::before\\s*\\{([^}]*)\\}`,
      ).exec(style())?.[1];
      expect(rule, `no marker rule for ${status}`).toMatch(
        /border:\s*2px solid/,
      );
    }
  });

  it("uses green only for in service", () => {
    const green = style().match(/var\(--ok\)/g) ?? [];
    // The colour of the word and the fill and the border of the marker, all of one rule pair.
    const rules = [
      ...style().matchAll(
        /(\.status--[\w-]+(?:::before)?)\s*\{[^}]*var\(--ok\)/g,
      ),
    ].map((m) => m[1]);
    expect(green.length).toBeGreaterThan(0);
    for (const selector of rules) expect(selector).toContain("in-service");
  });

  it("breaks the word rather than run out of its column at twice the text size", () => {
    const rule = /\.status\s*\{([^}]*)\}/.exec(style())?.[1] ?? "";
    // No nowrap: the cell is as wide as its own text, up to the width of its column.
    expect(rule).not.toContain("white-space: nowrap");
    expect(rule).toContain("max-width: 100%");
    expect(rule).toContain("overflow-wrap: anywhere");
  });
});
