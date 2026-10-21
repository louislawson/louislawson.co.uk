import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { describe, expect, it } from "vitest";
import { REPOSITORY_URL } from "../config/site";
import Footer from "./Footer.astro";
import { INSPECT_LABELS } from "./inspect-labels";

async function render(props: Record<string, unknown> = {}): Promise<string> {
  const container = await AstroContainer.create();
  return (await container.renderToString(Footer, { props })).replace(
    /\s+/g,
    " ",
  );
}

describe("<Footer>", () => {
  it("shows when the site was last updated, as the date is written", async () => {
    const html = await render({ updated: "2026-10-17" });
    expect(html).toContain("updated 2026-10-17");
  });

  it("leaves the date out when there is none, rather than guessing", async () => {
    const html = await render();
    expect(html).not.toContain("updated");
  });

  it("says what it is built with and links to the source", async () => {
    const html = await render();
    expect(html).toContain("built with Astro, hosted on Azure Static Web Apps");
    expect(html).toMatch(
      new RegExp(`<a href="${REPOSITORY_URL}"[^>]*>source on GitHub</a>`),
    );
  });

  it("says there are no cookies and only anonymous visit and load-time stats", async () => {
    const html = await render();
    expect(html).toContain("no cookies · anonymous visit and load-time stats");
  });

  it("holds the keyboard-shortcut switch", async () => {
    const html = await render();
    expect(html).toContain("data-shortcuts-switch");
    expect(html).toContain("keyboard shortcuts:");
  });

  it("is a footer landmark, with the outline wordmark hidden from assistive technology", async () => {
    const html = await render();
    expect(html).toMatch(/^<footer\b/);
    expect(html).toMatch(/aria-hidden="true"[^>]*>LAWSON</);
  });

  it("is labelled for inspect mode, with how it is served", async () => {
    const html = await render();
    expect(html).toMatch(/^<footer[^>]*\sdata-inspect=/);
    expect(html).toContain(`data-inspect="${INSPECT_LABELS.footer}"`);
  });

  it("has no inline style", async () => {
    expect(await render({ updated: "2026-10-17" })).not.toContain("style=");
  });
});
