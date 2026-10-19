import sharp from "sharp";
import { describe, expect, it } from "vitest";
import {
  DITHER_HEIGHT,
  DITHER_RAMP,
  DITHER_WIDTH,
  brightnessToText,
  ditherPhoto,
  placeholderDither,
} from "./dither";

const lines = (text: string) => text.replace(/\n$/, "").split("\n");

/** A solid image, built in memory: no photo is a file in these tests. */
const solid = (
  width: number,
  height: number,
  background: string,
  channels: 3 | 4 = 3,
) => sharp({ create: { width, height, channels, background } });

/** An image whose left part is one colour and whose right part is another. */
async function split(
  width: number,
  height: number,
  left: string,
  right: string,
  at = width / 2,
) {
  const rightPart = await solid(width - at, height, right)
    .png()
    .toBuffer();
  return solid(width, height, left)
    .composite([{ input: rightPart, left: at, top: 0 }])
    .jpeg({ quality: 100, chromaSubsampling: "4:4:4" });
}

describe("the dither's size and ramp", () => {
  it("is 72 columns by 26 rows, from a ramp of eight characters, dark to bright", () => {
    expect(DITHER_WIDTH).toBe(72);
    expect(DITHER_HEIGHT).toBe(26);
    expect(DITHER_RAMP).toBe(" .:-=+*#");
  });
});

describe("brightnessToText", () => {
  it("is a space for black and the brightest character for white", () => {
    expect(brightnessToText([0, 255], 2, 1)).toBe(" #\n");
  });

  it("gives each eighth of the brightness range its own character, in order", () => {
    const eighths = [0, 32, 64, 96, 128, 160, 192, 224].map((v) => v + 16);
    expect(brightnessToText(eighths, 8, 1)).toBe(" .:-=+*#\n");
  });

  it("changes character exactly at each eighth", () => {
    expect(brightnessToText([31, 32], 2, 1)).toBe(" .\n");
    expect(brightnessToText([223, 224], 2, 1)).toBe("*#\n");
  });

  it("ends each row with a line break, and reads the pixels row by row", () => {
    expect(brightnessToText([0, 255, 255, 0], 2, 2)).toBe(" #\n# \n");
  });

  it("rejects a pixel list that is not width times height", () => {
    expect(() => brightnessToText([0, 1, 2], 2, 2)).toThrow(/4/);
  });

  it("clamps a value outside 0 to 255 instead of going off the ramp", () => {
    expect(brightnessToText([-5, 300], 2, 1)).toBe(" #\n");
  });
});

describe("ditherPhoto", () => {
  it("makes a grid of 72 by 26 characters from any size of image", async () => {
    for (const [w, h] of [
      [1600, 1200],
      [300, 900],
      [64, 64],
    ] as const) {
      const text = await ditherPhoto(
        await solid(w, h, "#808080").jpeg().toBuffer(),
      );
      const rows = lines(text);
      expect(rows, `${w}x${h}`).toHaveLength(26);
      for (const row of rows) expect(row, `${w}x${h}`).toHaveLength(72);
      expect(text.endsWith("\n")).toBe(true);
    }
  });

  it("uses only characters of the ramp", async () => {
    const photo = await (
      await split(400, 300, "#202020", "#e0e0e0")
    )
      .jpeg()
      .toBuffer();
    for (const char of (await ditherPhoto(photo)).replace(/\n/g, "")) {
      expect(DITHER_RAMP).toContain(char);
    }
  });

  it("is black as spaces and white as the brightest character", async () => {
    const black = await ditherPhoto(
      await solid(200, 150, "#000").png().toBuffer(),
    );
    const white = await ditherPhoto(
      await solid(200, 150, "#fff").png().toBuffer(),
    );
    expect(new Set(black.replace(/\n/g, ""))).toEqual(new Set([" "]));
    expect(new Set(white.replace(/\n/g, ""))).toEqual(new Set(["#"]));
  });

  it("puts brightness where it is in the photo: a dark left half and a bright right half", async () => {
    const photo = await (await split(800, 600, "#000", "#fff")).toBuffer();
    for (const row of lines(await ditherPhoto(photo))) {
      expect(row.slice(0, 30)).toBe(" ".repeat(30));
      expect(row.slice(42)).toBe("#".repeat(30));
    }
  });

  it("reads greyscale brightness, so a bright colour is brighter than a dark one", async () => {
    const photo = await (
      await split(800, 600, "#ffff00", "#0000ff")
    ).toBuffer();
    const row = lines(await ditherPhoto(photo))[13]!;
    const level = (char: string) => DITHER_RAMP.indexOf(char);
    // Yellow is much brighter than blue.
    expect(level(row[5]!)).toBeGreaterThan(level(row[66]!) + 3);
  });

  it("crops to fit instead of squashing: a tall photo keeps its middle", async () => {
    // 100 x 400, dark at the top and bottom and white in the middle band.
    const band = await solid(100, 100, "#fff").png().toBuffer();
    const tall = await solid(100, 400, "#000")
      .composite([{ input: band, left: 0, top: 150 }])
      .png()
      .toBuffer();
    const rows = lines(await ditherPhoto(tall));
    // Scaled to 72 wide it is 288 tall, and the middle 26 of those rows are the band's centre.
    for (const row of rows) expect(row).toBe("#".repeat(72));
  });

  it("applies the photo's own orientation, so a phone photo is the way up it was taken", async () => {
    // Stored 200 wide by 100 tall with orientation 6 (turn 90 degrees clockwise): shown 100 wide
    // by 200 tall, and the stored left side, here white, is at the top.
    const stored = await (
      await split(200, 100, "#fff", "#000")
    )
      .withMetadata({ orientation: 6 })
      .toBuffer();
    const rows = lines(await ditherPhoto(stored));
    // Cropped to the middle of a 72 by 144 picture: the white half is above the black half.
    expect(rows[0]).toBe("#".repeat(72));
    expect(rows[25]).toBe(" ".repeat(72));
  });

  it("flattens transparency onto black instead of reading what is under it", async () => {
    const clear = await solid(
      100,
      100,
      { r: 255, g: 255, b: 255, alpha: 0 } as never,
      4,
    )
      .png()
      .toBuffer();
    const text = await ditherPhoto(clear);
    expect(new Set(text.replace(/\n/g, ""))).toEqual(new Set([" "]));
  });

  it("is the same text for the same image, every time", async () => {
    const photo = await (
      await split(640, 480, "#303030", "#d0d0d0", 200)
    ).toBuffer();
    expect(await ditherPhoto(photo)).toBe(await ditherPhoto(photo));
  });

  it("rejects bytes that are not an image, with an error that says so", async () => {
    await expect(ditherPhoto(new Uint8Array([1, 2, 3, 4]))).rejects.toThrow();
  });
});

describe("placeholderDither", () => {
  it("is 72 by 26 characters of the ramp, ended by line breaks", () => {
    const text = placeholderDither(1);
    const rows = lines(text);
    expect(rows).toHaveLength(26);
    for (const row of rows) expect(row).toHaveLength(72);
    for (const char of text.replace(/\n/g, "")) {
      expect(DITHER_RAMP).toContain(char);
    }
  });

  it("is the same text for the same seed, so the build does not change between runs", () => {
    expect(placeholderDither(3)).toBe(placeholderDither(3));
  });

  it("differs from seed to seed, so cards side by side are not copies", () => {
    expect(placeholderDither(1)).not.toBe(placeholderDither(2));
  });

  it("has dark and bright parts and not a flat field", () => {
    const used = new Set(placeholderDither(1).replace(/\n/g, ""));
    expect(used.size).toBeGreaterThanOrEqual(5);
    expect(used.has(" ")).toBe(true);
    expect(used.has("#") || used.has("*")).toBe(true);
  });
});
