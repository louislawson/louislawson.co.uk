import { readFileSync } from "node:fs";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { describe, expect, it } from "vitest";
import type { Project } from "../../content/schema";
import Measured from "./Measured.astro";

const project = (over: Partial<Project> = {}): { data: Project } => ({
  data: {
    code: "R04",
    title: "This website",
    summary: "A summary.",
    headline: "A short result",
    status: "commissioning",
    period: "2026",
    featured: false,
    order: 4,
    setup: "Setup.",
    change: "Change.",
    result: "Result.",
    kind: "open-source",
    stack: ["Astro", "Terraform", "GitHub Actions"],
    links: [],
    ...over,
  } as Project,
});

async function render(props: Record<string, unknown>): Promise<string> {
  const container = await AstroContainer.create();
  const html = await container.renderToString(Measured, { props });
  return html.replace(/\s+/g, " ");
}

describe("<Measured>", () => {
  const measurements = [
    { label: "Time to environment", before: "8", after: "2", unit: "hours" },
    { label: "Incidents caught before users", before: "70", unit: "%" },
  ];

  it("is a region headed measured when the project has measurements, which the prompt hash does not become part of", async () => {
    const html = await render({ project: project({ measurements }) });
    expect(html).toMatch(/<section[^>]*aria-labelledby="measured"/);
    expect(html).toMatch(/<h2[^>]*\sid="measured"[^>]*>\s*measured\s*<\/h2>/);
    const css = readFileSync(
      new URL("../../styles/global.css", import.meta.url),
      "utf-8",
    );
    // The # is decoration, set where the project page's sections share it: the second line gives
    // it an empty alt text.
    expect(css).toMatch(/content:\s*"# ";\s*content:\s*"# "\s*\/\s*"";/);
  });

  it("is headed tools when it has no measurements, so the heading never promises figures that are not there", async () => {
    for (const none of [undefined, []]) {
      const html = await render({ project: project({ measurements: none }) });
      expect(html).toMatch(/<section[^>]*aria-labelledby="tools"/);
      expect(html).toMatch(/<h2[^>]*\sid="tools"[^>]*>\s*tools\s*<\/h2>/);
      expect(html).not.toContain("measured");
      expect(html).not.toContain("<table");
    }
  });

  describe("the measurements", () => {
    const body = (html: string) =>
      /<tbody\b[^>]*>(.*?)<\/tbody>/.exec(html)?.[1] ?? "";
    const rows = (html: string) =>
      [...body(html).matchAll(/<tr\b[^>]*>(.*?)<\/tr>/g)].map((m) => m[1]!);
    const cells = (row: string) => [
      ...row.matchAll(/<(t[hd])\b([^>]*)>(.*?)<\/\1>/g),
    ];
    const text = (html: string) =>
      html
        .replace(/<[^>]+>/g, "")
        .replace(/\s+/g, " ")
        .trim();

    it("are a real table with a caption for screen readers, and columns for the measure, before and after", async () => {
      const html = await render({ project: project({ measurements }) });
      expect(html.match(/<table\b/g)).toHaveLength(1);
      expect(html).toMatch(
        /<caption[^>]*class="vh"[^>]*>\s*Before and after measurements\s*<\/caption>/,
      );
      const head = /<thead\b[^>]*>(.*?)<\/thead>/.exec(html)?.[1] ?? "";
      expect(head.match(/<th scope="col"/g)).toHaveLength(3);
      expect(cells(head).map((m) => text(m[3]!))).toEqual([
        "measure",
        "before",
        "after",
      ]);
      // Each row names its measure as a row header.
      expect(body(html).match(/<th scope="row"/g)).toHaveLength(2);
    });

    it("show a before-and-after row with its unit on each value, in the before and after columns", async () => {
      const html = await render({ project: project({ measurements }) });
      const row = cells(rows(html)[0]!);
      expect(row.map((m) => text(m[3]!))).toEqual([
        "Time to environment",
        "8 hours",
        "2 hours",
      ]);
      expect(row[1]![2]).toMatch(/class="before"/);
      expect(row[2]![2]).toMatch(/class="after"/);
    });

    it("show a measurement with no after once, across both value columns, with its unit", async () => {
      const html = await render({ project: project({ measurements }) });
      const row = cells(rows(html)[1]!);
      expect(row.map((m) => text(m[3]!))).toEqual([
        "Incidents caught before users",
        "70%",
      ]);
      expect(row[1]![2]).toMatch(/colspan="2"/);
      // It is a figure, not a change: neither end of one.
      expect(row[1]![2]).not.toMatch(/class="(before|after)"/);
    });

    it("keep the measurements in the order they were written", async () => {
      const html = await render({
        project: project({ measurements: [...measurements].reverse() }),
      });
      expect(rows(html).map((row) => text(cells(row)[0]![3]!))).toEqual([
        "Incidents caught before users",
        "Time to environment",
      ]);
    });

    it("come before the tools and the links", async () => {
      const html = await render({
        project: project({
          measurements,
          links: [{ label: "Source", url: "https://example.com/repo" }],
        }),
      });
      expect(html.indexOf("</table>")).toBeLessThan(
        html.indexOf('class="stack"'),
      );
      expect(html.indexOf('class="stack"')).toBeLessThan(html.indexOf("<a "));
    });

    it("are the same in both contexts, since a measurement is real or absent", async () => {
      const real = project({ measurements });
      expect(await render({ project: real, context: "production" })).toBe(
        await render({ project: real, context: "preview" }),
      );
    });

    it("are drawn in tokens: before dim, after bone, no red and no green, and markers that are not read out", () => {
      const source = readFileSync(
        new URL("./Measured.astro", import.meta.url),
        "utf-8",
      );
      const rule = (selector: string) =>
        new RegExp(`${selector}\\s*\\{([^}]*)\\}`).exec(source)?.[1] ?? "";
      expect(rule(String.raw`\.before`)).toMatch(/color:\s*var\(--dim\)/);
      expect(rule(String.raw`\.after`)).toMatch(/color:\s*var\(--bone\)/);
      // The mock's red is no token, and green is the contract's for live state alone.
      expect(source).not.toMatch(/#ff8f8f|var\(--ok\)|#[0-9a-f]{3,8}\b/i);
      // The - and + are decoration, given an empty alt text.
      // A no-break space joins each to its value, so a narrow column wraps the value, not the sign
      // away from it. A hyphen may break before a no-break space, so the - also takes a word joiner.
      expect(source).toMatch(/content:\s*"-\\2060\\00a0"\s*\/\s*""/);
      expect(source).toMatch(/content:\s*"\+\\00a0"\s*\/\s*""/);
    });
  });

  describe("the tools", () => {
    it("are the stack, in its order, as a list named for what it is", async () => {
      const html = await render({ project: project() });
      expect(html).toMatch(/<ul[^>]*class="stack"[^>]*aria-label="Tools used"/);
      const items = [...html.matchAll(/<li[^>]*>(.*?)<\/li>/g)].map((m) =>
        m[1]!.replace(/<[^>]+>/g, "").trim(),
      );
      expect(items).toEqual(["Astro", "Terraform", "GitHub Actions"]);
    });

    it("hatch a placeholder tool on a preview, and leave it out on production", async () => {
      const mixed = project({ stack: ["Astro", "TODO: tools used"] });
      const preview = await render({ project: mixed, context: "preview" });
      expect(preview.match(/<li\b/g)).toHaveLength(2);
      expect(preview).toContain('class="ph"');
      expect(preview).not.toContain("TODO:");
      const production = await render({
        project: mixed,
        context: "production",
      });
      expect(production.match(/<li\b/g)).toHaveLength(1);
      expect(production).not.toContain('class="ph"');
      expect(production).not.toContain("TODO:");
    });
  });

  describe("the links", () => {
    const links = [
      { label: "Source", url: "https://github.com/example/repo" },
      { label: "Write-up", url: "https://example.com/post" },
    ];

    it("follow the tools as buttons named by their label, in order, with the external mark", async () => {
      const html = await render({ project: project({ links }) });
      const anchors = [...html.matchAll(/<a\b([^>]*)>(.*?)<\/a>/g)];
      expect(anchors).toHaveLength(2);
      expect(anchors.map((m) => /href="([^"]+)"/.exec(m[1]!)?.[1])).toEqual(
        links.map((link) => link.url),
      );
      expect(anchors.map((m) => m[2]!.replace(/<[^>]+>/g, "").trim())).toEqual([
        "Source",
        "Write-up",
      ]);
      for (const m of anchors) {
        expect(m[1]).toMatch(/class="[^"]*\bbtn\b/);
        // The external arrow: drawn, and hidden from assistive technology.
        expect(m[2]).toMatch(/<svg[^>]*aria-hidden="true"/);
        expect(m[2]).toContain("M7 17L17 7");
      }
      expect(html.indexOf("</ul>")).toBeLessThan(html.indexOf("<a "));
    });

    it("are not there when the project has none", async () => {
      const html = await render({ project: project() });
      expect(html).not.toContain("<a ");
      expect(html).not.toContain("btn");
    });

    it("hatch a placeholder link on a preview as a button that is not a link, and omit it on production", async () => {
      const placeholder = project({
        links: [
          { label: "TODO: link label", url: "TODO: link address" },
          { label: "Source", url: "TODO: link address" },
          { label: "Write-up", url: "https://example.com/post" },
        ],
      });
      const preview = await render({
        project: placeholder,
        context: "preview",
      });
      expect(preview.match(/<a\b/g)).toHaveLength(1);
      expect(preview.match(/<span [^>]*class="btn"/g)).toHaveLength(2);
      expect(preview).toContain('class="ph"');
      expect(preview).not.toContain("TODO:");

      const production = await render({
        project: placeholder,
        context: "production",
      });
      expect(production.match(/<a\b/g)).toHaveLength(1);
      expect(production).not.toContain('class="ph"');
      expect(production).not.toContain("TODO:");
      expect(production.match(/class="btn/g)).toHaveLength(1);
    });
  });

  it("is nothing when there is nothing to show in it: no tools and no links", async () => {
    // Production leaves out a placeholder tool, so a build can reach a project with none left.
    const html = await render({
      project: project({ stack: ["TODO: tools used"] }),
      context: "production",
    });
    expect(html.trim()).toBe("");
  });

  it("shows the label and hatches the address of a link that has only the address missing, and the label alone when it is the label that is missing", async () => {
    const preview = await render({
      project: project({
        links: [
          { label: "Source", url: "TODO: link address" },
          { label: "TODO: link label", url: "https://example.com/post" },
        ],
      }),
      context: "preview",
    });
    expect(preview.match(/<span [^>]*class="btn"/g)).toHaveLength(2);
    expect(preview.match(/class="ph"/g)).toHaveLength(2);
    expect(preview).toContain("Source");
    expect(preview).not.toContain("<a ");
  });

  it("shows a real project the same in both contexts", async () => {
    const real = project({
      links: [{ label: "Source", url: "https://example.com/repo" }],
    });
    expect(await render({ project: real, context: "production" })).toBe(
      await render({ project: real, context: "preview" }),
    );
  });

  it("has no inline style and no script", async () => {
    const html = await render({
      project: project({
        links: [{ label: "Source", url: "https://example.com/repo" }],
      }),
    });
    expect(html).not.toMatch(/<[a-z][^>]*\sstyle\s*=/i);
    expect(html).not.toContain("<script");
  });
});
