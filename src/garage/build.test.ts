import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  buildCopy,
  copyOfProject as copyProject,
  removeCopies,
} from "../__tests__/project-copy";
import { checkImage } from "../metadata/image";
import { DITHER_HEIGHT, DITHER_WIDTH } from "./dither";

// A real build of a copy of the project with one photo in src/assets/garage/ and an entry that
// imports it, because what the build publishes can only be seen by building. A photo must come out
// as its optimised copy alone: the original is unlinked but would still be public, full size, and
// counted against the hosting plan's size limit.
const copyOfProject = () => copyProject("garage-build-");

/** Every file under `dir`, as a path relative to it with forward slashes. */
function filesUnder(dir: string): string[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) =>
      relative(dir, join(entry.parentPath, entry.name)).replaceAll("\\", "/"),
    );
}

// A photo as a camera or an editor leaves it: large, with an orientation tag and a colour profile.
const ORIGINAL = { width: 2000, height: 1500 };

let dir: string;
let original: Buffer;
let files: string[];
let html: string;

/** A photo as a camera or an editor leaves it. */
async function makeOriginal(): Promise<Buffer> {
  return sharp({
    create: {
      ...ORIGINAL,
      channels: 3,
      background: { r: 200, g: 60, b: 40 },
    },
  })
    .composite([
      {
        input: await sharp({
          create: {
            width: 900,
            height: 700,
            channels: 3,
            background: "#101010",
          },
        })
          .png()
          .toBuffer(),
        left: 300,
        top: 400,
      },
    ])
    .withMetadata({ orientation: 1, icc: "p3" })
    .jpeg({ quality: 90 })
    .toBuffer();
}

/** Puts photos in the copy's src/assets/garage/, and one entry that uses test-car.jpg. */
function addPhotosAndEntry(
  dir: string,
  photos: Record<string, Buffer>,
  // An entry whose photo is real and whose note, alt and caption are still placeholders is left
  // out of production, with the section when it is the only one.
  text: "finished" | "placeholders" = "finished",
) {
  mkdirSync(join(dir, "src", "assets", "garage"), { recursive: true });
  for (const [name, bytes] of Object.entries(photos)) {
    writeFileSync(join(dir, "src", "assets", "garage", name), bytes);
  }

  const profile = join(dir, "src", "data", "profile.ts");
  const source = readFileSync(profile, "utf-8");
  const words =
    text === "finished"
      ? {
          note: "A note about the test cars.",
          alt: "A red car with a dark window.",
          caption: "A test event, a test car",
        }
      : {
          note: "TODO: a line on the interest",
          alt: "TODO: describe the photo",
          caption: "TODO: event and vehicle",
        };
  const entry = `  garage: [
    {
      name: "Test cars",
      note: "${words.note}",
      photo: testCar,
      alt: "${words.alt}",
      caption: "${words.caption}",
    },
  ],
});`;
  const withEntry = source.replace(
    / {2}garage: \[[\s\S]*?\n {2}\],\n\}\);/,
    entry,
  );
  expect(
    withEntry,
    "src/data/profile.ts changed shape: update this test",
  ).not.toBe(source);
  writeFileSync(
    profile,
    withEntry.replace(
      'import { parseProfile } from "../content/schema";',
      'import { parseProfile } from "../content/schema";\nimport testCar from "../assets/garage/test-car.jpg";',
    ),
  );
}

/**
 * Builds the copy in production, the strictest context: an entry with a placeholder is left out.
 * Returns what a failed build printed ("" if it succeeded).
 */
function build(dir: string): string {
  return buildCopy(dir, { DEPLOY_CONTEXT: "production" });
}

/** Builds a copy that is meant to build, and says what the build printed when it does not. */
function buildOrThrow(dir: string) {
  const output = build(dir);
  if (output !== "") throw new Error(`the build failed:\n${output}`);
}

beforeAll(async () => {
  dir = copyOfProject();
  original = await makeOriginal();
  addPhotosAndEntry(dir, { "test-car.jpg": original });
  buildOrThrow(dir);
  files = filesUnder(join(dir, "dist"));
  html = readFileSync(join(dir, "dist", "index.html"), "utf-8");
});

afterAll(removeCopies);

describe("a build with a photo in src/assets/garage/", () => {
  it("starts from a photo that has what an original has: its size, an orientation tag and a colour profile", async () => {
    const metadata = await sharp(original).metadata();
    expect([metadata.width, metadata.height]).toEqual([2000, 1500]);
    expect(metadata.orientation).toBe(1);
    expect(metadata.icc).toBeDefined();
  });

  it("shows the entry, so the build used the photo", () => {
    expect(html).toMatch(/<section[^>]*\sid="garage"/);
    expect(html).toContain("Test cars");
    expect(html).toMatch(/<a class="gcard__photo"[^>]*\sdata-photo/);
  });

  it("publishes the optimised copy as a webp named after the photo", () => {
    const published = files.filter((file) =>
      /^_astro\/test-car\.[^/]+\.webp$/.test(file),
    );
    expect(published, files.join("\n")).toHaveLength(1);
  });

  it("does not publish the original: no file named after it, and no jpeg anywhere in the build", () => {
    expect(
      files.filter((file) => /test-car/.test(file) && !file.endsWith(".webp")),
    ).toEqual([]);
    expect(files.filter((file) => /\.jpe?g$/i.test(file))).toEqual([]);
  });

  it("links the page to the optimised copy and to nothing else of the photo", () => {
    const href = /<a class="gcard__photo"[^>]*\shref="([^"]+)"/.exec(html)?.[1];
    expect(href).toMatch(/^\/_astro\/test-car\.[^/]+\.webp$/);
    expect(files).toContain(href!.slice(1));
    expect(html).not.toMatch(/test-car[^"' ]*\.jpe?g/);
  });

  it("makes the optimised copy at most 1600 wide, with no EXIF, XMP, ICC profile or other metadata", async () => {
    const webp = files.find((file) =>
      /^_astro\/test-car\..+\.webp$/.test(file),
    )!;
    const bytes = readFileSync(join(dir, "dist", webp));
    const metadata = await sharp(bytes).metadata();
    expect(metadata.width).toBe(1600);
    expect(metadata.exif).toBeUndefined();
    expect(metadata.xmp).toBeUndefined();
    expect(metadata.icc).toBeUndefined();
    expect(await checkImage(new Uint8Array(bytes))).toEqual([]);
  });

  it("puts the photo's dither in the page, a full grid of it", () => {
    const pre =
      /<a class="gcard__photo"[^>]*><pre aria-hidden="true"[^>]*>([\s\S]*?)<\/pre><\/a>/.exec(
        html,
      )?.[1];
    expect(pre, "no dither in the card's link").toBeDefined();
    const rows = pre!.replace(/\n$/, "").split("\n");
    expect(rows).toHaveLength(DITHER_HEIGHT);
    for (const row of rows) expect(row).toHaveLength(DITHER_WIDTH);
    // The photo is a red field with a dark block, so the grid is not one character.
    expect(new Set(pre!.replace(/\n/g, "")).size).toBeGreaterThan(1);
  });

  it("carries no photo as data in the page or in a script", () => {
    expect(html).not.toContain("<img");
    for (const file of files.filter((f) => f.endsWith(".js"))) {
      expect(readFileSync(join(dir, "dist", file), "utf-8")).not.toMatch(
        /data:image|;base64,/,
      );
    }
  });
});

// Astro publishes every image it imports, and an optimised copy only replaces the original of one
// that was processed. So a photo in the folder that no entry uses is a build error, not a quiet
// full-size file in the site.
describe("a build with a photo in src/assets/garage/ that no entry uses", () => {
  it("fails, naming the file and saying it would be published", async () => {
    const copy = copyOfProject();
    addPhotosAndEntry(copy, {
      "test-car.jpg": await makeOriginal(),
      "stray-tractor.jpg": await makeOriginal(),
    });

    const output = build(copy);

    expect(output, "the build should have failed").not.toBe("");
    expect(output).toContain("stray-tractor.jpg");
    expect(output).toMatch(/no entry in the garage uses/);
    expect(output).toMatch(/published/);
    expect(output).not.toContain("test-car.jpg:");
  });
});

// Astro publishes the original of every imported image that nothing processes. A card is left out
// of production while a part of its entry is a placeholder, and the section with it, so nothing
// would process a photo that was added before the rest of its entry was written.
describe("a production build with a real photo in an entry that still has placeholders", () => {
  let hiddenDir: string;
  let hiddenFiles: string[];
  let hiddenHtml: string;

  beforeAll(async () => {
    hiddenDir = copyOfProject();
    addPhotosAndEntry(
      hiddenDir,
      { "test-car.jpg": await makeOriginal() },
      "placeholders",
    );
    buildOrThrow(hiddenDir);
    hiddenFiles = filesUnder(join(hiddenDir, "dist"));
    hiddenHtml = readFileSync(join(hiddenDir, "dist", "index.html"), "utf-8");
  });

  it("builds, and leaves the entry out with the garage section and its link", () => {
    expect(hiddenHtml).not.toMatch(/<section[^>]*\sid="garage"/);
    expect(hiddenHtml).not.toContain("Test cars");
    expect(hiddenHtml).not.toContain("data-photo");
    expect(hiddenHtml).not.toContain('href="/#garage"');
  });

  it("does not publish the original: no file named after it, and no jpeg anywhere in the build", () => {
    expect(
      hiddenFiles.filter(
        (file) => /test-car/.test(file) && !file.endsWith(".webp"),
      ),
      hiddenFiles.join("\n"),
    ).toEqual([]);
    expect(hiddenFiles.filter((file) => /\.jpe?g$/i.test(file))).toEqual([]);
  });

  it("processes the photo all the same, so its optimised copy is the only one of it in the build", () => {
    expect(
      hiddenFiles.filter((file) =>
        /^_astro\/test-car\.[^/]+\.webp$/.test(file),
      ),
    ).toHaveLength(1);
  });

  it("puts no photo in the page", () => {
    expect(hiddenHtml).not.toContain("<img");
    expect(hiddenHtml).not.toMatch(/test-car/);
  });
});
