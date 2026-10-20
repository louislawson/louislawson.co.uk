import { Resvg } from "@resvg/resvg-js";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import satori from "satori";
import {
  CARD_HEIGHT,
  CARD_WIDTH,
  type Card,
  type HomeCard,
  type ProjectCard,
} from "./card-content";

export { CARD_HEIGHT, CARD_WIDTH };

/** The site's colours (the tokens in src/styles/global.css, which a test pins these to). */
export const CARD_COLOURS = {
  bg: "#0d0e0c",
  line: "#2b2e28",
  bone: "#e9e7e0",
  dim: "#a3a59b",
  hivis: "#ff6b1a",
  ok: "#9bdc6e",
};

const FONT_FAMILY = "Martian Mono";
const PAD_X = 72;
const PAD_Y = 56;
// The least space between the body and the rules above and below it.
const BODY_GAP = 24;

// satori reads WOFF but not WOFF2, so the cards use the non-variable package's WOFF files. They
// are read from the project's node_modules, from the folder the build runs in (as the launch gate
// reads public/), and are only ever used here at build, never sent to a visitor.
const FONT_FILES = [
  { weight: 400, file: "martian-mono-latin-400-normal.woff" },
  { weight: 800, file: "martian-mono-latin-800-normal.woff" },
] as const;

let fonts:
  | { name: string; data: Buffer; weight: 400 | 800; style: "normal" }[]
  | undefined;

function loadFonts() {
  fonts ??= FONT_FILES.map(({ weight, file }) => ({
    name: FONT_FAMILY,
    data: readFileSync(
      join(
        process.cwd(),
        "node_modules",
        "@fontsource",
        "martian-mono",
        "files",
        file,
      ),
    ),
    weight,
    style: "normal" as const,
  }));
  return fonts;
}

type Style = Record<string, string | number>;
type Child = Element | string | undefined;
interface Element {
  type: string;
  props: { style: Style; children?: Child | Child[] };
}

/** An element in the shape satori reads, without JSX. A child that is undefined is left out. */
function el(type: string, style: Style, ...children: Child[]): Element {
  const kept = children.filter((child) => child !== undefined);
  return {
    type,
    props: { style, ...(kept.length === 0 ? {} : { children: kept }) },
  };
}

/** satori needs every element with more than one child to say it is a flex container. */
const column: Style = { display: "flex", flexDirection: "column" };
const row: Style = { display: "flex", flexDirection: "row" };
/** The middle of a card, which keeps its distance from the rules above and below. */
const bodyBox: Style = {
  ...column,
  marginTop: BODY_GAP,
  marginBottom: BODY_GAP,
};

/** The marker beside a status, as <Status> draws it: filled for in service and complete. */
const MARKERS: Record<string, { colour: string; filled: boolean }> = {
  "in-service": { colour: CARD_COLOURS.ok, filled: true },
  commissioning: { colour: CARD_COLOURS.hivis, filled: false },
  complete: { colour: CARD_COLOURS.bone, filled: true },
  archived: { colour: CARD_COLOURS.dim, filled: false },
};

function statusRow(status: NonNullable<ProjectCard["status"]>): Element {
  const marker = MARKERS[status.key];
  // A status the schema gains must be given its marker here, not drawn as another's.
  if (marker === undefined) {
    throw new Error(`The card has no marker for the status "${status.key}"`);
  }
  return el(
    "div",
    { ...row, alignItems: "center", marginTop: 24 },
    el("div", {
      width: 22,
      height: 22,
      border: `4px solid ${marker.colour}`,
      backgroundColor: marker.filled ? marker.colour : "transparent",
      marginRight: 18,
    }),
    el("div", { fontSize: 34, color: marker.colour }, status.label),
  );
}

/**
 * The brand at the top left, written as the nav's wordmark is: the dot in hi-vis. Each piece is
 * its own box in a row, which in a monospace font sets them as one word.
 */
function brandRow(brand: string): Element {
  const [first = "", ...rest] = brand.split(".");
  return el(
    "div",
    {
      ...row,
      fontSize: 30,
      paddingBottom: 24,
      borderBottom: `2px solid ${CARD_COLOURS.line}`,
    },
    el("div", {}, first),
    el("div", { color: CARD_COLOURS.hivis }, "."),
    el("div", {}, rest.join(".")),
  );
}

function homeBody(card: HomeCard): Element {
  const [first, last] = card.name;
  return el(
    "div",
    bodyBox,
    el(
      "div",
      { ...column, fontSize: 112, fontWeight: 800, lineHeight: 0.98 },
      el("div", {}, first),
      el("div", {}, last),
    ),
    card.role === undefined
      ? undefined
      : el(
          "div",
          {
            display: "block",
            lineClamp: 2,
            marginTop: 24,
            fontSize: 34,
            color: CARD_COLOURS.dim,
          },
          card.role,
        ),
  );
}

function projectBody(card: ProjectCard): Element {
  return el(
    "div",
    bodyBox,
    el(
      "div",
      { fontSize: 40, fontWeight: 800, color: CARD_COLOURS.hivis },
      card.code,
    ),
    // The title may take two lines and the headline (two to five words) one, which with the status
    // is the most the card holds between its rules.
    card.title === undefined
      ? undefined
      : el(
          "div",
          {
            display: "block",
            lineClamp: 2,
            marginTop: 20,
            fontSize: 64,
            fontWeight: 800,
            lineHeight: 1.05,
          },
          card.title,
        ),
    card.headline === undefined
      ? undefined
      : el(
          "div",
          { display: "block", lineClamp: 1, marginTop: 20, fontSize: 36 },
          card.headline,
        ),
    card.status === undefined ? undefined : statusRow(card.status),
  );
}

/** The element tree of a card, which satori turns into an SVG. */
export function cardElement(card: Card): Element {
  // The padding is on an inner box that grows to fill the card: satori adds a box's padding to its
  // width and height, so padding on the 1200 × 630 box itself would push the foot off the card.
  return el(
    "div",
    {
      ...row,
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      backgroundColor: CARD_COLOURS.bg,
      color: CARD_COLOURS.bone,
      fontFamily: FONT_FAMILY,
      fontWeight: 400,
    },
    el(
      "div",
      {
        ...column,
        flexGrow: 1,
        justifyContent: "space-between",
        padding: `${PAD_Y}px ${PAD_X}px`,
      },
      brandRow(card.brand),
      card.kind === "home" ? homeBody(card) : projectBody(card),
      el(
        "div",
        {
          fontSize: 28,
          color: CARD_COLOURS.dim,
          paddingTop: 24,
          borderTop: `2px solid ${CARD_COLOURS.line}`,
        },
        card.address,
      ),
    ),
  );
}

/** A card as the response an endpoint returns, which Astro writes out as a .png file. */
export async function cardResponse(card: Card): Promise<Response> {
  // Copied into a plain Uint8Array: the renderer's Buffer is not a body type TypeScript accepts.
  return new Response(new Uint8Array(await renderCard(card)), {
    headers: { "Content-Type": "image/png" },
  });
}

/** A card as a PNG. satori draws the text as outlines, so resvg needs no font of its own. */
export async function renderCard(card: Card): Promise<Uint8Array> {
  const svg = await satori(cardElement(card) as never, {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    fonts: loadFonts(),
  });
  // Rendered at the SVG's own size, so a size that satori and this file disagree on shows as a
  // card of the wrong size (the tests check 1200 × 630) and is not rescaled to hide it.
  return new Resvg(svg).render().asPng();
}
