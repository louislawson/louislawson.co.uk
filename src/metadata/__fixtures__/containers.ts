import { deflateSync } from "node:zlib";
import { ascii, concat, crc, u16, u32, utf8 } from "./bytes";

// Minimal PNG, WebP, GIF and HEIF/AVIF files. They carry just the blocks a test asks for: enough
// for a metadata reader, not for an image viewer.

// ---- PNG

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const body = concat(ascii(type), data);
  return concat(u32(data.length), body, crc(body));
}

export interface PngText {
  type: "tEXt" | "zTXt" | "iTXt";
  keyword: string;
  text: string;
}

function pngTextChunk({ type, keyword, text }: PngText): Uint8Array {
  const key = concat(ascii(keyword), new Uint8Array(1));
  if (type === "tEXt") return pngChunk(type, concat(key, ascii(text)));
  if (type === "zTXt") {
    // Compression method 0, then the text deflated.
    return pngChunk(
      type,
      concat(
        key,
        new Uint8Array([0]),
        new Uint8Array(deflateSync(ascii(text))),
      ),
    );
  }
  // Uncompressed: flag 0, method 0, an empty language tag and translated keyword, then the text.
  return pngChunk(type, concat(key, new Uint8Array([0, 0, 0, 0]), utf8(text)));
}

/**
 * A 1 x 1 PNG. `exif` is a TIFF block (the eXIf chunk); `xmp` is an XMP packet (an iTXt chunk);
 * `text` adds tEXt, zTXt or iTXt chunks, where tools write an author, a comment or a software name.
 */
export function png(
  parts: {
    exif?: Uint8Array;
    xmp?: string;
    exifAfterData?: boolean;
    text?: PngText[];
  } = {},
): Uint8Array {
  const header = concat(u32(1), u32(1), new Uint8Array([8, 0, 0, 0, 0]));
  const xmp = parts.xmp
    ? pngChunk(
        "iTXt",
        concat(
          ascii("XML:com.adobe.xmp\0"),
          new Uint8Array([0, 0]),
          ascii("\0\0"),
          utf8(parts.xmp),
        ),
      )
    : new Uint8Array(0);
  return concat(
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", header),
    parts.exif && !parts.exifAfterData
      ? pngChunk("eXIf", parts.exif)
      : new Uint8Array(0),
    xmp,
    ...(parts.text ?? []).map(pngTextChunk),
    pngChunk("IDAT", new Uint8Array(deflateSync(new Uint8Array([0, 0])))),
    // The PNG specification lets eXIf come anywhere before IEND, including after the image data.
    parts.exif && parts.exifAfterData
      ? pngChunk("eXIf", parts.exif)
      : new Uint8Array(0),
    pngChunk("IEND", new Uint8Array(0)),
  );
}

// ---- WebP

function riffChunk(type: string, data: Uint8Array): Uint8Array {
  const padded = data.length % 2 ? concat(data, new Uint8Array(1)) : data;
  return concat(ascii(type), u32(data.length, true), padded);
}

/** A WebP in the extended layout, with an EXIF chunk (a TIFF block) and an XMP chunk if asked. */
export function webp(
  parts: { exif?: Uint8Array; xmp?: string } = {},
): Uint8Array {
  const flags = (parts.exif ? 0x08 : 0) | (parts.xmp ? 0x04 : 0);
  const body = concat(
    ascii("WEBP"),
    riffChunk(
      "VP8X",
      concat(new Uint8Array([flags, 0, 0, 0]), new Uint8Array(6)),
    ),
    riffChunk("VP8L", new Uint8Array([0x2f, 0, 0, 0, 0])),
    parts.exif ? riffChunk("EXIF", parts.exif) : new Uint8Array(0),
    parts.xmp ? riffChunk("XMP ", utf8(parts.xmp)) : new Uint8Array(0),
  );
  return concat(ascii("RIFF"), u32(body.length, true), body);
}

// ---- GIF

/**
 * A 1 x 1 GIF. `xmp` becomes the XMP application extension and `comment` a Comment Extension
 * (0x21 0xFE), where some editors write a name or a note.
 */
export function gif(
  parts: { xmp?: string; comment?: string } = {},
): Uint8Array {
  const commentBlock = parts.comment
    ? concat(
        new Uint8Array([0x21, 0xfe, parts.comment.length]),
        ascii(parts.comment),
        new Uint8Array([0x00]),
      )
    : new Uint8Array(0);
  const xmpBlock = parts.xmp
    ? concat(
        new Uint8Array([0x21, 0xff, 0x0b]),
        ascii("XMP DataXMP"),
        utf8(parts.xmp),
        // The "magic trailer" that lets a reader step over the packet as sub-blocks.
        new Uint8Array([
          0x01,
          ...Array.from({ length: 255 }, (_, i) => 255 - i),
          0x00,
          0x00,
        ]),
      )
    : new Uint8Array(0);
  return concat(
    ascii("GIF89a"),
    u16(1, true),
    u16(1, true),
    new Uint8Array([0x00, 0, 0]),
    xmpBlock,
    commentBlock,
    new Uint8Array([
      0x2c, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0x02, 0x02, 0x44, 0x01, 0x00,
    ]),
    new Uint8Array([0x3b]),
  );
}

// ---- HEIF and AVIF (ISO base media file format)

function box(type: string, payload: Uint8Array): Uint8Array {
  return concat(u32(payload.length + 8), ascii(type), payload);
}
const fullBox = (type: string, version: number, payload: Uint8Array) =>
  box(type, concat(new Uint8Array([version, 0, 0, 0]), payload));

/** A HEIC or AVIF file whose Exif item holds `exif` (a TIFF block) and whose XMP item holds `xmp`. */
export function heif(
  brand: "heic" | "avif",
  parts: { exif?: Uint8Array; xmp?: string } = {},
): Uint8Array {
  const items: { id: number; type: string; extra: string; data: Uint8Array }[] =
    [
      {
        id: 1,
        type: brand === "heic" ? "hvc1" : "av01",
        extra: "",
        data: new Uint8Array(4),
      },
    ];
  if (parts.exif) {
    items.push({
      id: 2,
      type: "Exif",
      extra: "",
      data: concat(u32(0), parts.exif),
    });
  }
  if (parts.xmp) {
    items.push({
      id: 3,
      type: "mime",
      extra: "application/rdf+xml\0",
      data: utf8(parts.xmp),
    });
  }

  const ftyp = box(
    "ftyp",
    concat(ascii(brand), u32(0), ascii(brand), ascii("mif1")),
  );
  const hdlr = fullBox(
    "hdlr",
    0,
    concat(u32(0), ascii("pict"), new Uint8Array(12), ascii("\0")),
  );
  const pitm = fullBox("pitm", 0, u16(1));
  const iinf = fullBox(
    "iinf",
    0,
    concat(
      u16(items.length),
      ...items.map((item) =>
        fullBox(
          "infe",
          2,
          concat(
            u16(item.id),
            u16(0),
            ascii(item.type),
            ascii("\0"),
            ascii(item.extra),
          ),
        ),
      ),
    ),
  );
  // Each iloc entry is a fixed size, so its size is known before the offsets are.
  const buildMeta = (dataStart: number) => {
    let at = dataStart;
    const iloc = fullBox(
      "iloc",
      0,
      concat(
        new Uint8Array([0x44, 0x00]),
        u16(items.length),
        ...items.map((item) => {
          const entry = concat(
            u16(item.id),
            u16(0),
            u16(1),
            u32(at),
            u32(item.data.length),
          );
          at += item.data.length;
          return entry;
        }),
      ),
    );
    return fullBox("meta", 0, concat(hdlr, pitm, iinf, iloc));
  };
  const metaLength = buildMeta(0).length;
  const meta = buildMeta(ftyp.length + metaLength + 8);
  return concat(ftyp, meta, box("mdat", concat(...items.map((i) => i.data))));
}
