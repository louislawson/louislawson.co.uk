import { readFileSync } from "node:fs";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { describe, expect, it } from "vitest";
import WriteUp from "./WriteUp.astro";

async function render(slot = "<p>Words.</p>"): Promise<string> {
  const container = await AstroContainer.create();
  const html = await container.renderToString(WriteUp, {
    slots: { default: slot },
  });
  return html.replace(/\s+/g, " ");
}

const source = readFileSync(
  new URL("./WriteUp.astro", import.meta.url),
  "utf-8",
);

/** The declarations of the first rule whose selector is exactly this. */
function rule(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\>]/g, "\\$&");
  return (
    new RegExp(`(?:^|\\})\\s*${escaped}\\s*\\{([^}]*)\\}`, "m").exec(
      source,
    )?.[1] ?? ""
  );
}

describe("<WriteUp>", () => {
  it("is a region headed write-up, with the Markdown it is given in a prose block", async () => {
    const html = await render("<h3>Context</h3><p>Words.</p>");
    expect(html).toMatch(/<section[^>]*aria-labelledby="writeup"/);
    expect(html).toMatch(/<h2[^>]*\sid="writeup"[^>]*>\s*write-up\s*<\/h2>/);
    expect(html).toMatch(
      /<div[^>]*class="[^"]*\bprose\b[^"]*"[^>]*>\s*<h3>Context<\/h3><p>Words.<\/p>\s*<\/div>/,
    );
    // It sits in the project page's two columns: the heading left, the prose right.
    expect(html).toMatch(/class="[^"]*\bp-cols\b/);
    expect(html).toMatch(/class="[^"]*\bp-section\b/);
  });

  describe("when the whole write-up is a placeholder", () => {
    const placeholder = "TODO: write the run sheet for this project.";

    async function renderPlaceholder(context: "preview" | "production") {
      const container = await AstroContainer.create();
      const html = await container.renderToString(WriteUp, {
        props: { placeholder, context },
        // A slot is not used: the placeholder stands in for the prose.
        slots: { default: "<p>Words.</p>" },
      });
      return html.replace(/\s+/g, " ");
    }

    it("keeps the heading in a preview and hatches the placeholder under it, never printing TODO:", async () => {
      const html = await renderPlaceholder("preview");
      expect(html).toMatch(/<h2[^>]*\sid="writeup"[^>]*>\s*write-up\s*<\/h2>/);
      expect(html).toContain('class="ph"');
      expect(html).toContain("Placeholder: ");
      expect(html).toContain("write the run sheet for this project.");
      expect(html).not.toContain("TODO:");
      expect(html).not.toContain("Words.");
    });

    it("is nothing on production, which leaves a placeholder out and has no heading to put over it", async () => {
      expect((await renderPlaceholder("production")).trim()).toBe("");
    });
  });

  it("puts the heading's # in the shared section style, not in its own", () => {
    // The # in front of the h2 is .p-cols > h2::before, shared with the block above; the test for
    // it is in Measured.test.ts. Redrawing it here would give the page two of them.
    expect(source).not.toMatch(/content:\s*"# "/);
  });

  it("sets the prose to the mock's measure and rhythm: 68ch, 1.75 leading, 1.1em between blocks", () => {
    expect(rule(".prose")).toMatch(/max-width:\s*68ch/);
    expect(rule(".prose")).toMatch(/line-height:\s*1\.75/);
    expect(rule(".prose > :global(* + *)")).toMatch(/margin-top:\s*1\.1em/);
  });

  it("lets a long unbroken word, such as an address, break instead of widening the page", () => {
    expect(rule(".prose")).toMatch(/overflow-wrap:\s*anywhere/);
  });

  it("starts the first block flush with the heading beside it, not 2.2em down", () => {
    expect(rule(".prose > :global(:first-child)")).toMatch(/margin-top:\s*0/);
  });

  it("styles a write-up heading as the mock's sub-heading: bold, tight, with a hi-vis ## that is not read out", () => {
    const heading = rule(".prose :global(h3)");
    expect(heading).toMatch(/margin-top:\s*2\.2em/);
    expect(heading).toMatch(
      /font-size:\s*clamp\(1\.2rem,\s*1rem \+ 0\.8vw,\s*1\.6rem\)/,
    );
    expect(heading).toMatch(/font-weight:\s*700/);
    expect(heading).toMatch(/letter-spacing:\s*-0\.02em/);
    // The ## is decoration: the second line gives it an empty alt text.
    const mark = rule(".prose :global(h3)::before");
    expect(mark).toMatch(/content:\s*"## ";\s*content:\s*"## " \/ ""/);
    expect(mark).toMatch(/color:\s*var\(--hivis\)/);
  });

  it("marks list items with a hi-vis -, and puts strong text in bone", () => {
    expect(rule(".prose :global(ul)")).toMatch(/padding-left:\s*1\.4em/);
    // The reset gives every list list-style: none, which would leave a list with no marker to draw.
    expect(rule(".prose :global(ul)")).toMatch(/list-style:\s*disc/);
    // Numbers stay numbers: only a bullet list is marked with a -.
    expect(rule(".prose :global(ol)")).toMatch(/list-style:\s*decimal/);
    expect(rule(".prose :global(ol)")).toMatch(/padding-left:\s*1\.4em/);
    expect(rule(".prose :global(ol > li)::marker")).toMatch(
      /color:\s*var\(--hivis\)/,
    );
    expect(rule(".prose :global(ol > li)::marker")).not.toMatch(/content/);
    expect(rule(".prose :global(ul > li)::marker")).toMatch(
      /content:\s*"- ";\s*content:\s*"- " \/ ""/,
    );
    expect(rule(".prose :global(ul > li)::marker")).toMatch(
      /color:\s*var\(--hivis\)/,
    );
    expect(rule(".prose :global(strong)")).toMatch(/color:\s*var\(--bone\)/);
    expect(rule(".prose :global(strong)")).toMatch(/font-weight:\s*700/);
  });

  it("draws a code block as plain monospace on the panel colour, from the tokens, and wraps a long line rather than scrolling", () => {
    const block = rule(".prose :global(pre)");
    expect(block).toMatch(/background:\s*var\(--panel\)/);
    expect(block).toMatch(/border:\s*1px solid var\(--line\)/);
    expect(block).toMatch(/font-family:\s*var\(--mono\)/);
    // A scrolling block can't be reached by keyboard, since Markdown gives its pre no tabindex, so
    // a long line wraps instead and the block never scrolls.
    expect(block).toMatch(/white-space:\s*pre-wrap/);
    expect(block).toMatch(/overflow-wrap:\s*anywhere/);
    expect(block).not.toMatch(/overflow-x/);
    // The code inside is the block's own colour, not a second box.
    expect(rule(".prose :global(pre code)")).toMatch(/background:\s*none/);
  });

  it("draws inline code on the panel colour too", () => {
    const inline = rule(".prose :global(:not(pre) > code)");
    expect(inline).toMatch(/background:\s*var\(--panel\)/);
    expect(inline).toMatch(/border:\s*1px solid var\(--line\)/);
  });

  it("keeps a diagram inside the column, on a ground in the tokens' colours, and shows the paragraph after it as its caption", () => {
    const image = rule(".prose :global(img)");
    expect(image).toMatch(/max-width:\s*100%/);
    expect(image).toMatch(/height:\s*auto/);
    expect(image).toMatch(/background:\s*var\(--panel\)/);
    expect(image).toMatch(/border:\s*1px solid var\(--line\)/);
    // A paragraph that is only an image, then the paragraph after it.
    const caption = rule(".prose :global(p:has(> img:only-child) + p)");
    expect(caption).toMatch(/color:\s*var\(--dim\)/);
    expect(caption).toMatch(/font-size:\s*0\.85rem/);
    expect(caption).toMatch(/margin-top:\s*0\.6rem/);
  });

  it("uses no colour that is not a token", () => {
    const css = /<style>([\s\S]*)<\/style>/.exec(source)?.[1] ?? "";
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i);
  });

  it("has no inline style and no script", async () => {
    const html = await render("<h3>Context</h3><p>Words.</p>");
    expect(html).not.toMatch(/<[a-z][^>]*\sstyle\s*=/i);
    expect(html).not.toContain("<script");
  });
});
