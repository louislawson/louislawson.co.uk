import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { describe, expect, it } from "vitest";
import type { Section } from "../../content/visibility";
import Certifications from "./Certifications.astro";

const all: Section[] = [
  { id: "projects", number: 1 },
  { id: "skills", number: 2 },
  { id: "certifications", number: 3 },
  { id: "garage", number: 4 },
  { id: "contact", number: 5 },
];

interface Cert {
  title: string;
  issuer: string;
  date: string;
  verify?: string;
}

const checked: Cert = {
  title: "Azure Administrator Associate",
  issuer: "Microsoft",
  date: "2025-06",
  verify: "https://example.com/verify/abc",
};
const unchecked: Cert = {
  title: "Platform Engineering Practitioner",
  issuer: "An issuer",
  date: "2024",
};

async function render(props: Record<string, unknown>): Promise<string> {
  const container = await AstroContainer.create();
  const html = await container.renderToString(Certifications, { props });
  return html.replace(/\s+/g, " ");
}

/**
 * The text of every element with this class, tags taken out. A hatched value nests spans inside
 * the span, so the end of an element is found by counting the tags of its own name.
 */
function text(html: string, className: string): string[] {
  const start = new RegExp(
    `<(\\w+)[^>]*class="[^"]*\\b${className}\\b[^"]*"[^>]*>`,
    "g",
  );
  return [...html.matchAll(start)].map((open) => {
    const name = open[1]!;
    const tags = new RegExp(`<(/?)${name}\\b[^>]*>`, "g");
    tags.lastIndex = open.index + open[0].length;
    let depth = 1;
    let end = html.length;
    for (let tag = tags.exec(html); tag; tag = tags.exec(html)) {
      depth += tag[1] ? -1 : 1;
      if (depth === 0) {
        end = tag.index;
        break;
      }
    }
    return html
      .slice(open.index + open[0].length, end)
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();
  });
}

/** The `<li>` of each row, so a test can look at one row alone. */
const rows = (html: string) =>
  [...html.matchAll(/<li\b[^>]*class="cert"[^>]*>.*?<\/li>/g)].map((m) => m[0]);

describe("<Certifications>", () => {
  it("is a section with the id the navigation links to, headed certifications, with no count", async () => {
    const html = await render({ certifications: [checked], sections: all });
    expect(html).toMatch(/<section[^>]*\sid="certifications"/);
    expect(html).toMatch(/<h2[^>]*>\s*certifications\s*<\/h2>/);
    expect(html).not.toContain('class="n"');
  });

  it("has the fixed intro line, which makes no claims", async () => {
    const html = await render({ certifications: [checked], sections: all });
    expect(html).toMatch(
      /<p[^>]*>\s*Certifications and achievements\.\s*<\/p>/,
    );
  });

  it("has no inspect label of its own: the plan approves none and the mock has none", async () => {
    const html = await render({ certifications: [checked], sections: all });
    expect(html).not.toContain("data-inspect");
  });

  it("is not rendered when the certifications section is not shown, so the nav and the page agree", async () => {
    const html = await render({
      certifications: [checked],
      sections: all.filter((s) => s.id !== "certifications"),
    });
    expect(html.trim()).toBe("");
  });

  it("is not rendered when there are no certifications", async () => {
    expect((await render({ certifications: [], sections: all })).trim()).toBe(
      "",
    );
  });

  describe("a row", () => {
    it("is a list item with the title, the issuer and the date, in that order", async () => {
      const html = await render({ certifications: [checked], sections: all });
      expect(html).toMatch(/<ul[^>]*role="list"/);
      expect(rows(html)).toHaveLength(1);
      expect(text(html, "t")).toEqual(["Azure Administrator Associate"]);
      expect(text(html, "iss")).toEqual(["Microsoft"]);
      expect(text(html, "dt")).toEqual(["2025-06"]);
      const at = (needle: string) => html.indexOf(needle);
      expect(at('class="t"')).toBeLessThan(at('class="g iss"'));
      expect(at('class="g iss"')).toBeLessThan(at('class="g dt"'));
    });

    it.each(["2025", "2025-06"])(
      "shows the date as written (%s)",
      async (date) => {
        const html = await render({
          certifications: [{ ...unchecked, date }],
          sections: all,
        });
        expect(text(html, "dt")).toEqual([date]);
      },
    );

    it("keeps the order of the rows it is given", async () => {
      const html = await render({
        certifications: [unchecked, checked],
        sections: all,
      });
      expect(text(html, "t")).toEqual([unchecked.title, checked.title]);
    });
  });

  describe("the verify link", () => {
    it("is a verify link with the external icon, in the same tab, when verify is set", async () => {
      const html = await render({ certifications: [checked], sections: all });
      const link = /<a\b[^>]*>.*?<\/a>/.exec(html)?.[0];
      expect(link, "no link").toBeDefined();
      expect(link).toContain('href="https://example.com/verify/abc"');
      expect(link).toMatch(/>\s*verify\s*<svg/);
      expect(link).toContain("<svg");
      // The same tab: no target, so the visitor keeps their back button.
      expect(link).not.toContain("target=");
      expect(html.match(/<a\b/g)).toHaveLength(1);
    });

    it("is named for its certification, so a list of links does not read 'verify' again and again", async () => {
      const html = await render({
        certifications: [checked, { ...checked, title: "Another one" }],
        sections: all,
      });
      const links = [...html.matchAll(/<a\b[^>]*aria-labelledby="([^"]+)"/g)];
      expect(links).toHaveLength(2);
      for (const [, ids] of links) {
        const parts = ids!.split(" ");
        expect(parts).toHaveLength(2);
        // Both ids are in the page, and they are different between rows.
        for (const id of parts) expect(html).toContain(`id="${id}"`);
      }
      expect(links[0]![1]).not.toBe(links[1]![1]);
      // The name is "verify", then the title.
      const [verifyId, titleId] = links[0]![1]!.split(" ");
      expect(new RegExp(`id="${verifyId}"[^>]*>\\s*verify`).test(html)).toBe(
        true,
      );
      expect(
        new RegExp(
          `id="${titleId}"[^>]*>\\s*Azure Administrator Associate`,
        ).test(html),
      ).toBe(true);
    });

    it("is left out, and nothing in its place, when verify is not set", async () => {
      const html = await render({ certifications: [unchecked], sections: all });
      expect(html).not.toContain("<a ");
      expect(html).not.toContain("href=");
      expect(html).not.toContain("verify");
      // The rest of the row is there.
      expect(text(html, "t")).toEqual([unchecked.title]);
    });

    it("is on the rows that have a verify link and not on the others", async () => {
      const html = await render({
        certifications: [checked, unchecked],
        sections: all,
      });
      const [first, second] = rows(html);
      expect(first).toContain("<a ");
      expect(second).not.toContain("<a ");
    });
  });

  describe("the deploy context", () => {
    const placeholderVerify: Cert = {
      ...checked,
      verify: "TODO: the verification URL",
    };

    it.each(["preview", "local"])(
      "hatches a placeholder verify link, with no link behind it, on a %s build",
      async (context) => {
        const html = await render({
          certifications: [placeholderVerify],
          sections: all,
          context,
        });
        expect(html.match(/class="ph"/g)).toHaveLength(1);
        expect(html).toContain("Placeholder: ");
        expect(html).not.toContain("TODO:");
        // Not a link: a placeholder is not an address.
        expect(html).not.toContain("<a ");
        expect(html).not.toContain("href=");
        expect(text(html, "t")).toEqual([checked.title]);
      },
    );

    it("leaves a placeholder verify link out on production and keeps the entry, with no link", async () => {
      const html = await render({
        certifications: [placeholderVerify],
        sections: all,
        context: "production",
      });
      expect(html).not.toContain('class="ph"');
      expect(html).not.toContain("Placeholder:");
      expect(html).not.toContain("TODO:");
      expect(html).not.toContain("<a ");
      expect(html).not.toContain("verify");
      expect(text(html, "t")).toEqual([checked.title]);
      expect(text(html, "iss")).toEqual([checked.issuer]);
      expect(text(html, "dt")).toEqual([checked.date]);
    });

    it("hatches a placeholder title and issuer on a preview and shows nothing of them on production", async () => {
      const placeholderRow: Cert = {
        title: "TODO: certification or milestone",
        issuer: "TODO: issuer",
        date: "TODO: YYYY or YYYY-MM",
      };
      const preview = await render({
        certifications: [placeholderRow],
        sections: all,
        context: "preview",
      });
      expect(preview.match(/class="ph"/g)).toHaveLength(3);
      expect(preview).not.toContain("TODO:");
      // The hint is the placeholder's own words, read whole through the nested spans.
      expect(text(preview, "t")).toEqual([
        "Placeholder: certification or milestone",
      ]);
      expect(text(preview, "iss")).toEqual(["Placeholder: issuer"]);
      expect(text(preview, "dt")).toEqual(["Placeholder: YYYY or YYYY-MM"]);
      const production = await render({
        certifications: [placeholderRow],
        sections: all,
        context: "production",
      });
      expect(production).not.toContain('class="ph"');
      expect(production).not.toContain("TODO:");
    });

    it("shows a real row the same in both", async () => {
      const props = { certifications: [checked, unchecked], sections: all };
      expect(await render({ ...props, context: "production" })).toBe(
        await render({ ...props, context: "preview" }),
      );
    });
  });

  it("has no inline style and no script", async () => {
    const html = await render({ certifications: [checked], sections: all });
    expect(html).not.toMatch(/<[a-z][^>]*\sstyle\s*=/i);
    expect(html).not.toContain("<script");
  });
});
