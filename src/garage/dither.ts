// The garage's photos as text: a photo becomes a grid of characters from its brightness, at build,
// so the page does no image processing of its own. Everything here runs when the site is built.
import sharp from "sharp";

/** From dark to bright. */
export const DITHER_RAMP = " .:-=+*#";
export const DITHER_WIDTH = 72;
export const DITHER_HEIGHT = 26;

/**
 * Text from greyscale brightness (0 to 255), row by row, each row ended by a line break. Each eighth
 * of the range is one character of the ramp; a value off the scale is held to its end.
 */
export function brightnessToText(
  pixels: ArrayLike<number>,
  width: number,
  height: number,
): string {
  if (pixels.length !== width * height) {
    throw new Error(
      `${pixels.length} pixels do not fill a grid of ${width} by ${height} (${width * height})`,
    );
  }
  let text = "";
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const brightness = pixels[y * width + x]!;
      const level = Math.floor((brightness / 256) * DITHER_RAMP.length);
      text += DITHER_RAMP[Math.min(DITHER_RAMP.length - 1, Math.max(0, level))];
    }
    text += "\n";
  }
  return text;
}

/**
 * A photo as DITHER_WIDTH by DITHER_HEIGHT characters. The photo is turned the way up it was taken,
 * laid on black where it is transparent, and cropped to fit the grid, never squashed. The grid's
 * shape is the card's 4 : 3 once a character is taken as twice as tall as it is wide.
 */
export async function ditherPhoto(bytes: Uint8Array): Promise<string> {
  const { data, info } = await sharp(bytes)
    .rotate()
    .flatten({ background: "#000" })
    .resize(DITHER_WIDTH, DITHER_HEIGHT, { fit: "cover" })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (info.channels !== 1) {
    throw new Error(`expected one greyscale channel, got ${info.channels}`);
  }
  return brightnessToText(data, info.width, info.height);
}

/**
 * A stand-in for a photo that is not there yet, so a preview shows the look: a vehicle's outline on
 * a ground, with a little noise. It is drawn from the seed alone, so the same seed is the same text.
 */
export function placeholderDither(seed: number): string {
  let text = "";
  for (let y = 0; y < DITHER_HEIGHT; y++) {
    const row: number[] = [];
    for (let x = 0; x < DITHER_WIDTH; x++) {
      const nx = x / DITHER_WIDTH - 0.5;
      const ny = (y / DITHER_HEIGHT - 0.55) * 1.4;
      const ground = y > DITHER_HEIGHT * 0.72 ? 0.35 : 0;
      const body =
        Math.exp(-((nx * 1.6) ** 2 + (ny * 2.4 - 0.1) ** 2) * 6) * 0.9;
      const wheel1 =
        Math.exp(-(((nx + 0.24) * 9) ** 2 + ((ny - 0.32) * 9) ** 2)) * 1.2;
      const wheel2 =
        Math.exp(-(((nx - 0.24) * 9) ** 2 + ((ny - 0.32) * 9) ** 2)) * 1.2;
      const n = Math.sin((x + seed * 7) * 12.9898 + y * 78.233) * 43758.5453;
      const noise = (n - Math.floor(n)) * 0.18;
      const v = Math.min(
        0.999,
        Math.max(0, ground + body + wheel1 + wheel2 + noise - 0.08),
      );
      row.push(Math.floor(v * 256));
    }
    text += brightnessToText(row, DITHER_WIDTH, 1);
  }
  return text;
}
