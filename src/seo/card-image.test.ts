import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { homeCard, projectCard } from "./card-content";
import {
  CARD_COLOURS,
  CARD_HEIGHT,
  CARD_WIDTH,
  cardElement,
  cardResponse,
  renderCard,
} from "./card-image";

type Node = string | { props: { children?: Node | Node[] } };

/** Every piece of text in an element tree, in order. */
function texts(node: Node | Node[] | undefined): string[] {
  if (node === undefined) return [];
  if (typeof node === "string") return [node];
  if (Array.isArray(node)) return node.flatMap(texts);
  return texts(node.props.children);
}

const real = {
  code: "R04",
  title: "This website",
  headline: "Pipeline-built, pipeline-deployed",
  status: "commissioning",
};

/** The brand as the card draws it: the nav's wordmark, with the dot in its own piece. */
const BRAND = ["louis", ".", "lawson"];

describe("a card's brand", () => {
  /** The colour of the element that holds this text, wherever it is in the tree. */
  function colourOf(tree: unknown, text: string): unknown {
    const node = tree as {
      props: {
        style: Record<string, unknown>;
        children?: unknown;
      };
    };
    const children = [node.props.children].flat();
    if (children.includes(text)) return node.props.style.color;
    for (const child of children) {
      if (typeof child === "object" && child !== null) {
        const found = colourOf(child, text);
        if (found !== undefined) return found;
      }
    }
    return undefined;
  }

  it("has the dot in hi-vis, as the nav's wordmark does, and the rest in the card's own colour", () => {
    for (const card of [homeCard({}), projectCard("x", real)]) {
      const tree = cardElement(card);
      expect(colourOf(tree, ".")).toBe(CARD_COLOURS.hivis);
      expect(colourOf(tree, "louis")).toBeUndefined();
      expect(colourOf(tree, "lawson")).toBeUndefined();
    }
  });

  it("is still louis.lawson to read", () => {
    expect(BRAND.join("")).toBe("louis.lawson");
    expect(homeCard({}).brand).toBe("louis.lawson");
  });
});

describe("a card's text", () => {
  it("home: the brand, the name, the role line and the address, in that order", () => {
    const card = homeCard({ roleLine: "Cloud and DevOps engineer" });
    expect(texts(cardElement(card) as Node)).toEqual([
      ...BRAND,
      "Louis",
      "Lawson",
      "Cloud and DevOps engineer",
      "louislawson.co.uk/",
    ]);
  });

  it("home: no role line while it is a placeholder", () => {
    const card = homeCard({ roleLine: "TODO: role line" });
    expect(texts(cardElement(card) as Node)).toEqual([
      ...BRAND,
      "Louis",
      "Lawson",
      "louislawson.co.uk/",
    ]);
  });

  it("project: the brand, the code, the title, the headline, the status and the address", () => {
    const card = projectCard("this-website", real);
    expect(texts(cardElement(card) as Node)).toEqual([
      ...BRAND,
      "R04",
      "This website",
      "Pipeline-built, pipeline-deployed",
      "commissioning",
      "louislawson.co.uk/projects/this-website/",
    ]);
  });

  it("project: placeholders are left off, never printed", () => {
    const card = projectCard("r01-placeholder", {
      code: "R01",
      title: "TODO: project title",
      headline: "TODO: a headline of two to five words",
      status: "TODO: status",
    });
    expect(texts(cardElement(card) as Node)).toEqual([
      ...BRAND,
      "R01",
      "louislawson.co.uk/projects/r01-placeholder/",
    ]);
  });
});

describe("a card's status marker", () => {
  /** The marker's element: the square before the status word, as <Status> draws it. */
  function marker(key: string) {
    const card = projectCard("x", { ...real, status: key });
    const tree = JSON.stringify(cardElement(card));
    return {
      border: /"border":"4px solid (#[0-9a-f]{6})"/.exec(tree)?.[1],
      filled: /"backgroundColor":"(#[0-9a-f]{6})","marginRight":18/.test(tree),
    };
  }

  it("is drawn as <Status> draws it: green and filled only for in service", () => {
    expect(marker("in-service")).toEqual({
      border: CARD_COLOURS.ok,
      filled: true,
    });
    expect(marker("commissioning")).toEqual({
      border: CARD_COLOURS.hivis,
      filled: false,
    });
    expect(marker("complete")).toEqual({
      border: CARD_COLOURS.bone,
      filled: true,
    });
    expect(marker("archived")).toEqual({
      border: CARD_COLOURS.dim,
      filled: false,
    });
  });

  it("fails the build on a status it has no marker for, rather than drawing another's", () => {
    expect(() =>
      cardElement(projectCard("x", { ...real, status: "paused" })),
    ).toThrow(/no marker for the status "paused"/);
  });
});

describe("a card's picture", () => {
  // The PNG signature, then the IHDR chunk: its width and height are the first eight data bytes.
  function size(png: Uint8Array) {
    const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }

  it("is a 1200 × 630 PNG for the home page", async () => {
    const png = await renderCard(homeCard({ roleLine: "Cloud engineer" }));
    expect([...png.slice(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(size(png)).toEqual({ width: CARD_WIDTH, height: CARD_HEIGHT });
    expect(CARD_WIDTH).toBe(1200);
    expect(CARD_HEIGHT).toBe(630);
  });

  it("is the same size for a project, even with nothing but the code", async () => {
    const full = await renderCard(projectCard("this-website", real));
    const bare = await renderCard(
      projectCard("r01", {
        code: "R01",
        title: "TODO: t",
        headline: "TODO: h",
        status: "TODO: s",
      }),
    );
    expect(size(full)).toEqual({ width: 1200, height: 630 });
    expect(size(bare)).toEqual({ width: 1200, height: 630 });
  });

  it("differs between a card with a title and one without", async () => {
    const full = await renderCard(projectCard("this-website", real));
    const bare = await renderCard(
      projectCard("this-website", { ...real, title: "TODO: t" }),
    );
    expect(Buffer.from(full).equals(Buffer.from(bare))).toBe(false);
  });

  it("copes with a title far longer than the card", async () => {
    const png = await renderCard(
      projectCard("long", { ...real, title: "A very long title ".repeat(12) }),
    );
    expect(size(png)).toEqual({ width: 1200, height: 630 });
  });
});

describe("a card's response", () => {
  it("is a PNG file, which the endpoints publish as it is", async () => {
    const response = await cardResponse(homeCard({}));
    expect(response.headers.get("Content-Type")).toBe("image/png");
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect([...bytes.slice(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  });
});

describe("a card's colours", () => {
  it("are the site's tokens, which a card cannot read from a stylesheet", () => {
    const css = readFileSync("src/styles/global.css", "utf-8");
    const token = (name: string) =>
      new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, "i").exec(css)?.[1];
    expect(CARD_COLOURS).toEqual({
      bg: token("bg"),
      line: token("line"),
      bone: token("bone"),
      dim: token("dim"),
      hivis: token("hivis"),
      ok: token("ok"),
    });
  });
});
