// Free-text metadata in images: the places editors write a name, a note or a path that is not EXIF,
// XMP or IPTC. Each walker only reads the container structure, and stops quietly at anything
// malformed: checkImage's other checks, and exifr, are what report a file that cannot be read.

const latin1 = (bytes: Uint8Array) => Buffer.from(bytes).toString("latin1");

export interface PngText {
  /** tEXt, zTXt or iTXt. */
  type: string;
  /** The keyword, which is never compressed, even in a zTXt or iTXt chunk. */
  keyword: string;
}

export const isPng = (bytes: Uint8Array) =>
  bytes[0] === 0x89 && latin1(bytes.subarray(1, 8)) === "PNG\r\n\x1a\n";

/** Every text chunk in a PNG, wherever it sits before IEND. */
export function pngTextChunks(bytes: Uint8Array): PngText[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const found: PngText[] = [];
  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const length = view.getUint32(offset);
    const type = latin1(bytes.subarray(offset + 4, offset + 8));
    if (offset + 12 + length > bytes.length) break;
    if (type === "tEXt" || type === "zTXt" || type === "iTXt") {
      const data = bytes.subarray(offset + 8, offset + 8 + length);
      const end = data.indexOf(0);
      found.push({
        type,
        keyword: latin1(data.subarray(0, end < 0 ? data.length : end)),
      });
    }
    if (type === "IEND") break;
    offset += 12 + length;
  }
  return found;
}

export const isJpeg = (bytes: Uint8Array) =>
  bytes[0] === 0xff && bytes[1] === 0xd8;

/** Whether a JPEG has a COM (comment) segment, in the headers or between scans. */
export function hasJpegComment(bytes: Uint8Array): boolean {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let i = 2;
  while (i + 1 < bytes.length) {
    if (bytes[i] !== 0xff) {
      i++;
      continue;
    }
    const marker = bytes[i + 1] ?? 0;
    // Fill bytes, stuffed zeros in scan data, restart markers and bare markers have no length.
    if (marker === 0xff) {
      i++;
    } else if (
      marker === 0x00 ||
      marker === 0x01 ||
      (marker >= 0xd0 && marker <= 0xd8)
    ) {
      i += 2;
    } else if (marker === 0xd9) {
      return false;
    } else if (marker === 0xfe) {
      return true;
    } else {
      if (i + 4 > bytes.length) return false;
      i += 2 + view.getUint16(i + 2);
    }
  }
  return false;
}

export const isGif = (bytes: Uint8Array) =>
  latin1(bytes.subarray(0, 4)) === "GIF8";

/** Whether a GIF has a Comment Extension (0x21 0xFE). */
export function hasGifComment(bytes: Uint8Array): boolean {
  const colourTable = (packed: number) =>
    packed & 0x80 ? 3 * 2 ** ((packed & 7) + 1) : 0;
  const skipSubBlocks = (from: number) => {
    let i = from;
    while (i < bytes.length) {
      const size = bytes[i] ?? 0;
      i += 1 + size;
      if (size === 0) return i;
    }
    return bytes.length;
  };

  let i = 13 + colourTable(bytes[10] ?? 0);
  while (i < bytes.length) {
    const block = bytes[i];
    if (block === 0x3b) return false;
    if (block === 0x21) {
      if (bytes[i + 1] === 0xfe) return true;
      i = skipSubBlocks(i + 2);
    } else if (block === 0x2c) {
      i += 10 + colourTable(bytes[i + 9] ?? 0) + 1;
      i = skipSubBlocks(i);
    } else {
      return false;
    }
  }
  return false;
}
