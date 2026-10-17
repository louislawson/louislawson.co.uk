import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { describe, expect, it } from "vitest";
import Icon from "./Icon.astro";

async function render(props: Record<string, unknown>): Promise<string> {
  const container = await AstroContainer.create();
  return container.renderToString(Icon, { props });
}

/** The value of one attribute on the first tag, or undefined if it is not there. */
function attr(html: string, name: string): string | undefined {
  const tag = /<svg\b[^>]*>/.exec(html)?.[0] ?? "";
  const match = new RegExp(`\\s${name}(?:="([^"]*)")?(?=[\\s>/])`).exec(tag);
  return match ? (match[1] ?? "") : undefined;
}

describe("<Icon>", () => {
  it("draws on a 24px grid in the current text colour with a 1.6 stroke and square ends", async () => {
    const html = await render({ name: "arrow" });
    expect(attr(html, "viewBox")).toBe("0 0 24 24");
    expect(attr(html, "fill")).toBe("none");
    expect(attr(html, "stroke")).toBe("currentColor");
    expect(attr(html, "stroke-width")).toBe("1.6");
    expect(attr(html, "stroke-linecap")).toBe("square");
  });

  it("is 24px unless a size is given, and the size is an attribute, not a style", async () => {
    const plain = await render({ name: "arrow" });
    expect(attr(plain, "width")).toBe("24");
    expect(attr(plain, "height")).toBe("24");

    const small = await render({ name: "arrow", size: 16 });
    expect(attr(small, "width")).toBe("16");
    expect(attr(small, "height")).toBe("16");
    expect(small).not.toContain("style=");
  });

  it("is hidden from assistive technology when it has no label", async () => {
    const html = await render({ name: "external" });
    expect(attr(html, "aria-hidden")).toBe("true");
    expect(attr(html, "role")).toBeUndefined();
    expect(attr(html, "aria-label")).toBeUndefined();
  });

  it("is an image with a name when it has a label", async () => {
    const html = await render({
      name: "external",
      label: "opens in a new tab",
    });
    expect(attr(html, "role")).toBe("img");
    expect(attr(html, "aria-label")).toBe("opens in a new tab");
    expect(attr(html, "aria-hidden")).toBeUndefined();
  });

  it("draws a different shape for each icon", async () => {
    const arrow = await render({ name: "arrow" });
    const external = await render({ name: "external" });
    const paths = (html: string) => [...html.matchAll(/ d="([^"]+)"/g)];
    expect(paths(arrow).length).toBeGreaterThan(0);
    expect(paths(external).length).toBeGreaterThan(0);
    expect(paths(arrow)).not.toEqual(paths(external));
  });

  it("fails loudly for an icon that does not exist", async () => {
    await expect(render({ name: "no-such-icon" })).rejects.toThrow(
      /no-such-icon/,
    );
  });
});
