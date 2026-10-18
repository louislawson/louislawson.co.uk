import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { describe, expect, it } from "vitest";
import type { Section } from "../content/visibility";
import { INSPECT_LABELS } from "./inspect-labels";
import Nav from "./Nav.astro";

const all: Section[] = [
  { id: "projects", number: 1 },
  { id: "skills", number: 2 },
  { id: "certifications", number: 3 },
  { id: "garage", number: 4 },
  { id: "contact", number: 5 },
];

async function render(sections: Section[], path = "/"): Promise<string> {
  const container = await AstroContainer.create();
  const html = await container.renderToString(Nav, {
    props: { sections },
    request: new Request(`http://localhost${path}`),
  });
  return html.replace(/\s+/g, " ");
}

/** Each section link: where it goes, the number it carries, and the name a screen reader gets. */
function links(html: string) {
  return [...html.matchAll(/<a href="(\/#[^"]+)"([^>]*)>(.*?)<\/a>/g)].map(
    ([, href, attributes, inner]) => ({
      href,
      number: /data-number="(\d+)"/.exec(attributes!)?.[1],
      hint: /<kbd[^>]*>(\d+)<\/kbd>/.exec(inner!)?.[1],
      // Hidden content is not part of the name.
      name: inner!
        .replace(/<(\w+)[^>]*aria-hidden="true"[^>]*>.*?<\/\1>/g, "")
        .replace(/<[^>]+>/g, "")
        .trim(),
    }),
  );
}

describe("<Nav>", () => {
  it("has the name linking home, and a landmark for the sections", async () => {
    const html = await render(all);
    expect(html).toMatch(
      /<a class="nav__home" href="\/"[^>]*>louis<span[^>]*>\.<\/span>lawson<\/a>/,
    );
    expect(html).toMatch(/<nav[^>]*aria-label="Sections"/);
  });

  it("links to each section that is shown, in order, from any page", async () => {
    const found = links(await render(all));
    expect(found.map((l) => [l.href, l.name])).toEqual([
      ["/#projects", "projects"],
      ["/#skills", "skills"],
      ["/#certifications", "certs"],
      ["/#garage", "garage"],
      ["/#contact", "contact"],
    ]);
  });

  it("numbers the links from 1 as the sections were numbered, so a hidden section closes the gap", async () => {
    // Skills and the garage are hidden: the numbers are 1 to 3, not 1, 3 and 5.
    const found = links(
      await render([
        { id: "projects", number: 1 },
        { id: "certifications", number: 2 },
        { id: "contact", number: 3 },
      ]),
    );
    expect(found.map((l) => l.href)).toEqual([
      "/#projects",
      "/#certifications",
      "/#contact",
    ]);
    expect(found.map((l) => l.number)).toEqual(["1", "2", "3"]);
    expect(found.map((l) => l.hint)).toEqual(["1", "2", "3"]);
  });

  it("hides the number hint from assistive technology, so a link's name is its label", async () => {
    const html = await render(all);
    expect(html).toMatch(/<kbd[^>]*aria-hidden="true"/);
    expect(links(html).every((l) => !/\d/.test(l.name))).toBe(true);
  });

  it("puts nothing between a hint and its label, or inside the hint, so the gap is the mock's 4px", async () => {
    // compressHTML keeps a line break as a space, which would widen it.
    const html = await render(all);
    expect(html).toMatch(/<kbd[^>]*>1<\/kbd>projects<\/a>/);
    expect(html).toMatch(/<kbd[^>]*>5<\/kbd>contact<\/a>/);
  });

  it("does not announce a shortcut on the server, because without script there is none", async () => {
    expect(await render(all)).not.toContain("aria-keyshortcuts");
  });

  it("has a menu button that says what it opens and whether it is open", async () => {
    const html = await render(all);
    expect(html).toMatch(/<button[^>]*type="button"/);
    expect(html).toMatch(/<button[^>]*aria-expanded="false"/);
    const controls = /<button[^>]*aria-controls="([^"]+)"/.exec(html)?.[1];
    expect(controls).toBeDefined();
    expect(html).toContain(`id="${controls}"`);
  });

  it("marks the home page, where the current section is shown, and no other", async () => {
    expect(await render(all, "/")).toMatch(/<header[^>]*\sdata-home/);
    expect(await render(all, "/projects/example/")).not.toContain("data-home");
    expect(await render(all, "/no-such-page/")).not.toContain("data-home");
  });

  it("has no links and no menu when no section is shown, but still the way home", async () => {
    const html = await render([]);
    expect(links(html)).toEqual([]);
    // No menu to open, though the inspect button is still there.
    expect(html).not.toContain("data-nav-menu");
    expect(html).not.toContain("<nav");
    expect(html).toMatch(/<a class="nav__home" href="\/"/);
  });

  it("labels the bar for inspect mode, below it, since it sits at the top of the window", async () => {
    const html = await render(all);
    expect(html).toContain(`data-inspect="${INSPECT_LABELS.nav}"`);
    expect(html).toMatch(/<header[^>]*\sdata-inspect-below/);
  });

  it("has the inspect button: pressed state, a name that stays the same, and held back until the script runs", async () => {
    const html = await render(all);
    const button = /<button[^>]*data-inspect-toggle[^>]*>.*?<\/button>/.exec(
      html,
    )?.[0];
    expect(button, "no inspect button").toBeDefined();
    expect(button).toMatch(/type="button"/);
    expect(button).toMatch(/aria-pressed="false"/);
    // It keeps its place in the bar without showing until the script, which it needs, has run.
    expect(button).toMatch(/\sdata-pending/);
    // The hint is aria-hidden, so the name is "inspect" in either state.
    const name = button!
      .replace(/<(\w+)[^>]*aria-hidden="true"[^>]*>.*?<\/\1>/g, "")
      .replace(/<[^>]+>/g, "")
      .trim();
    expect(name).toBe("inspect");
    expect(button).toMatch(/<kbd[^>]*>i<\/kbd>inspect/);
    // No shortcut is announced on the server, because without script there is none.
    expect(button).not.toContain("aria-keyshortcuts");
  });

  it("has the inspect button even when no section is shown", async () => {
    expect(await render([])).toContain("data-inspect-toggle");
  });

  it("has no inline style and no inline script", async () => {
    const html = await render(all);
    expect(html).not.toMatch(/<[a-z][^>]*\sstyle\s*=/i);
    expect(html).not.toMatch(/<script(?![^>]*\ssrc=)/);
  });
});
