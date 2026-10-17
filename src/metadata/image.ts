import exifr from "exifr";

// Refuses a photo that carries EXIF, XMP or IPTC metadata, except an orientation and a colour
// profile. A phone photo's EXIF holds the location, the device and the time it was taken.
//
// exifr reads JPEG, PNG, TIFF, HEIC and AVIF. It cannot read WebP or GIF, so those are walked
// here: a WebP's EXIF chunk is a TIFF block that exifr does read, and a GIF can only carry XMP.

const EXIFR_OPTIONS = {
  // IFD0 is always read: exifr does not let it be switched off.
  tiff: true,
  exif: true,
  gps: true,
  interop: true,
  ifd1: true,
  iptc: true,
  // The colour profile is allowed, and XMP is found by the byte scan below, which also catches
  // an empty packet and formats exifr cannot read.
  xmp: false,
  icc: false,
  jfif: false,
  mergeOutput: false,
  translateKeys: true,
  translateValues: false,
  reviveValues: false,
  sanitize: false,
  silentErrors: false,
} as const;

/** What the other blocks exifr reports mean, in words for the person who has to remove them. */
const BLOCKS: Record<string, string> = {
  gps: "GPS location data",
  exif: "EXIF camera, lens and date data",
  interop: "EXIF interoperability data",
  ifd1: "an EXIF thumbnail",
  iptc: "an IPTC block",
};

/** The one tag any image may carry, and what a TIFF file needs to be an image at all. */
const ALLOWED_TAGS = ["Orientation"];
const TIFF_STRUCTURE = [
  "ImageWidth",
  "ImageHeight",
  "BitsPerSample",
  "Compression",
  "PhotometricInterpretation",
  "StripOffsets",
  "SamplesPerPixel",
  "RowsPerStrip",
  "StripByteCounts",
  "XResolution",
  "YResolution",
  "PlanarConfiguration",
  "ResolutionUnit",
  "Predictor",
  // An embedded colour profile.
  "ICC",
];

const XMP_BLOCK = "an XMP block";

const XMP_MARKERS = [
  "<?xpacket",
  "<x:xmpmeta",
  "http://ns.adobe.com/xap/1.0/",
  "http://ns.adobe.com/xmp/extension/",
  "XMP DataXMP",
  "XML:com.adobe.xmp",
];

const latin1 = (bytes: Uint8Array) => Buffer.from(bytes).toString("latin1");

function startsWith(bytes: Uint8Array, text: string, at = 0): boolean {
  return latin1(bytes.subarray(at, at + text.length)) === text;
}

const isTiff = (bytes: Uint8Array) =>
  startsWith(bytes, "II*\0") || startsWith(bytes, "MM\0*");
const isWebp = (bytes: Uint8Array) =>
  startsWith(bytes, "RIFF") && startsWith(bytes, "WEBP", 8);
const isGif = (bytes: Uint8Array) => startsWith(bytes, "GIF8");

function describeExif(parsed: unknown, tiffFile: boolean): string[] {
  const problems: string[] = [];
  const allowed = new Set(
    tiffFile ? [...ALLOWED_TAGS, ...TIFF_STRUCTURE] : ALLOWED_TAGS,
  );
  for (const [block, value] of Object.entries(parsed ?? {})) {
    // A PNG header is the image's size and depth, not metadata.
    if (block === "ihdr") continue;
    if (block === "ifd0") {
      const extra = Object.keys(value as object).filter(
        (tag) => !allowed.has(tag),
      );
      if (extra.length > 0) {
        problems.push(`EXIF tags other than Orientation: ${extra.join(", ")}`);
      }
    } else {
      problems.push(BLOCKS[block] ?? `an unrecognised "${block}" block`);
    }
  }
  return problems;
}

/** The EXIF chunk of a WebP, which exifr cannot open itself, and whether there is an XMP chunk. */
function webpChunks(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const chunks: { type: string; data: Uint8Array }[] = [];
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const size = view.getUint32(offset + 4, true);
    if (offset + 8 + size > bytes.length)
      throw new Error("truncated WebP chunk");
    chunks.push({
      type: latin1(bytes.subarray(offset, offset + 4)),
      data: bytes.subarray(offset + 8, offset + 8 + size),
    });
    offset += 8 + size + (size % 2);
  }
  return chunks;
}

/**
 * Everything wrong with an image's metadata, or an empty list if it is clean. An image that cannot
 * be read at all is reported too: a privacy check must not pass what it cannot see into.
 */
export async function checkImage(bytes: Uint8Array): Promise<string[]> {
  // A set, so a problem found by two routes (the byte scan and a WebP chunk) is reported once.
  const problems = new Set<string>();
  const text = latin1(bytes);
  if (XMP_MARKERS.some((marker) => text.includes(marker))) {
    problems.add(XMP_BLOCK);
  }
  // ImageMagick and exiftool keep EXIF, IPTC and XMP in PNG text chunks as "raw profiles".
  if (/Raw profile type (exif|iptc|xmp|APP1)/i.test(text)) {
    problems.add("a raw profile text chunk carrying EXIF, IPTC or XMP");
  }
  try {
    if (isWebp(bytes)) {
      for (const chunk of webpChunks(bytes)) {
        if (chunk.type === "XMP ") problems.add(XMP_BLOCK);
        if (chunk.type === "EXIF") {
          // Some writers put the "Exif\0\0" header of a JPEG in front of the TIFF block.
          const tiffBlock = startsWith(chunk.data, "Exif\0\0")
            ? chunk.data.subarray(6)
            : chunk.data;
          const parsed = await exifr.parse(tiffBlock, EXIFR_OPTIONS);
          for (const problem of describeExif(parsed, false))
            problems.add(problem);
        }
      }
    } else if (isGif(bytes)) {
      // A GIF has no EXIF or IPTC; the XMP scan above is the whole check.
    } else {
      const parsed = await exifr.parse(bytes, EXIFR_OPTIONS);
      for (const problem of describeExif(parsed, isTiff(bytes))) {
        problems.add(problem);
      }
    }
  } catch (error) {
    return [
      `could not be read as an image (${error instanceof Error ? error.message : String(error)}), so it cannot be shown to be free of metadata`,
    ];
  }
  return [...problems];
}
