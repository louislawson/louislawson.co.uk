import { ascii, concat, u16, u32 } from "./bytes";

// A little-endian TIFF structure: the container EXIF uses, and what a TIFF image file is.

const ASCII = 2;
const SHORT = 3;
const LONG = 4;

export type Tag =
  | { tag: number; short: number }
  | { tag: number; long: number }
  | { tag: number; text: string };

interface Built {
  entries: Uint8Array;
  extra: Uint8Array;
}

/** Entries for one IFD whose first byte is at `ifdOffset`, with out-of-line values after it. */
function buildIfd(tags: Tag[], ifdOffset: number): Uint8Array {
  const sorted = [...tags].sort((a, b) => a.tag - b.tag);
  const headerSize = 2 + sorted.length * 12 + 4;
  const built: Built = { entries: new Uint8Array(0), extra: new Uint8Array(0) };
  for (const entry of sorted) {
    let record: Uint8Array;
    if ("short" in entry) {
      record = concat(
        u16(entry.tag, true),
        u16(SHORT, true),
        u32(1, true),
        u16(entry.short, true),
        u16(0),
      );
    } else if ("long" in entry) {
      record = concat(
        u16(entry.tag, true),
        u16(LONG, true),
        u32(1, true),
        u32(entry.long, true),
      );
    } else {
      const text = concat(ascii(entry.text), new Uint8Array(1));
      if (text.length <= 4) {
        const inline = new Uint8Array(4);
        inline.set(text);
        record = concat(
          u16(entry.tag, true),
          u16(ASCII, true),
          u32(text.length, true),
          inline,
        );
      } else {
        const at = ifdOffset + headerSize + built.extra.length;
        record = concat(
          u16(entry.tag, true),
          u16(ASCII, true),
          u32(text.length, true),
          u32(at, true),
        );
        built.extra = concat(built.extra, text);
      }
    }
    built.entries = concat(built.entries, record);
  }
  return concat(
    u16(sorted.length, true),
    built.entries,
    u32(0, true),
    built.extra,
  );
}

export const TAGS = {
  imageWidth: 0x0100,
  imageLength: 0x0101,
  bitsPerSample: 0x0102,
  compression: 0x0103,
  photometric: 0x0106,
  make: 0x010f,
  model: 0x0110,
  orientation: 0x0112,
  software: 0x0131,
  dateTime: 0x0132,
  artist: 0x013b,
  copyright: 0x8298,
  exifPointer: 0x8769,
  gpsPointer: 0x8825,
  dateTimeOriginal: 0x9003,
  gpsLatitudeRef: 0x0001,
} as const;

/**
 * A TIFF block with the given IFD0 tags. `exif` adds an Exif sub-IFD and `gps` a GPS sub-IFD, the
 * places a camera puts the date, device and location.
 */
export function tiff(
  ifd0: Tag[],
  sub: { exif?: Tag[]; gps?: Tag[] } = {},
): Uint8Array {
  const header = concat(ascii("II"), u16(42, true), u32(8, true));
  const pointers: Tag[] = [];
  // Lay IFD0 out first, then each sub-IFD after it; pointers need the offsets, so size IFD0 once.
  const probe = [...ifd0];
  if (sub.exif) probe.push({ tag: TAGS.exifPointer, long: 0 });
  if (sub.gps) probe.push({ tag: TAGS.gpsPointer, long: 0 });
  let next = 8 + buildIfd(probe, 8).length;
  const subBlocks: Uint8Array[] = [];
  for (const [tags, pointer] of [
    [sub.exif, TAGS.exifPointer],
    [sub.gps, TAGS.gpsPointer],
  ] as const) {
    if (!tags) continue;
    pointers.push({ tag: pointer, long: next });
    const block = buildIfd(tags, next);
    subBlocks.push(block);
    next += block.length;
  }
  return concat(header, buildIfd([...ifd0, ...pointers], 8), ...subBlocks);
}
