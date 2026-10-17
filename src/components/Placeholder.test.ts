import { readFileSync } from "node:fs";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { describe, expect, it } from "vitest";
import Placeholder from "./Placeholder.astro";

async function render(props: Record<string, unknown>): Promise<string> {
  const container = await AstroContainer.create();
  return container.renderToString(Placeholder, { props });
}

describe("<Placeholder>", () => {
  it("hatches a placeholder on a preview, with a hidden label for screen readers", async () => {
    const html = await render({
      value: "TODO: Two sentences in your own words",
      context: "preview",
    });
    expect(html).toMatch(/class="ph[ "]/);
    expect(html).toMatch(/class="vh[ "][^>]*>Placeholder: <\/span>/);
    expect(html).toContain("Two sentences in your own words");
    expect(html).not.toContain("TODO:");
  });

  it("adds no whitespace of its own, so text and punctuation can sit against it", async () => {
    const html = await render({
      value: "TODO: Two sentences in your own words",
      context: "preview",
    });
    expect(html).toMatch(
      /^<span class="ph"[^>]*><span class="vh"[^>]*>Placeholder: <\/span>Two sentences in your own words<\/span>$/,
    );
  });

  it("hatches a placeholder in a local build too", async () => {
    const html = await render({ value: "TODO: a title", context: "local" });
    expect(html).toMatch(/class="ph[ "]/);
  });

  it("renders nothing for a placeholder on production", async () => {
    const html = await render({
      value: "TODO: a title",
      context: "production",
    });
    expect(html).toBe("");
  });

  it.each(["local", "preview", "production"])(
    "shows a real value as plain text on %s",
    async (context) => {
      const html = await render({ value: "A real title", context });
      expect(html).toBe("A real title");
    },
  );

  it("hides its label with the shared .vh class from global.css, and defines no copy of it", () => {
    const source = readFileSync(
      new URL("./Placeholder.astro", import.meta.url),
      "utf-8",
    );
    const style = /<style>([\s\S]*)<\/style>/.exec(source)?.[1] ?? "";
    expect(style).not.toMatch(/\.vh\b/);
  });

  it("escapes what it shows", async () => {
    const html = await render({
      value: "TODO: <b>bold</b>",
      context: "preview",
    });
    expect(html).toContain("&lt;b&gt;bold&lt;/b&gt;");
    expect(html).not.toContain("<b>");
  });
});
