import { describe, expect, it } from "vitest";
import { ascii, concat } from "./__fixtures__/bytes";
import { gif, heif, png, webp } from "./__fixtures__/containers";
import { TAGS, tiff } from "./__fixtures__/exif";
import { jpeg, xmpPacket } from "./__fixtures__/jpeg";
import { checkImage } from "./image";

// Every fixture is built in memory; none is a file. Each format gets a clean file, a file with only
// an orientation (allowed), and files that carry what the check must refuse.

const orientation = tiff([{ tag: TAGS.orientation, short: 6 }]);
const camera = tiff([{ tag: TAGS.make, text: "Acme Camera" }]);
const located = tiff([{ tag: TAGS.make, text: "Acme Camera" }], {
  gps: [{ tag: TAGS.gpsLatitudeRef, text: "N" }],
});
const dated = tiff([], {
  exif: [{ tag: TAGS.dateTimeOriginal, text: "2026:10:17 12:00:00" }],
});
const xmp = xmpPacket(
  "<rdf:Description xmlns:dc='http://purl.org/dc/elements/1.1/'><dc:creator>Louis</dc:creator></rdf:Description>",
);
const emptyXmp = xmpPacket("");

type Builder = (parts: { exif?: Uint8Array; xmp?: string }) => Uint8Array;

const withExif: [string, Builder][] = [
  ["JPEG", (parts) => jpeg(parts)],
  ["PNG", (parts) => png(parts)],
  ["WebP", (parts) => webp(parts)],
  ["HEIC", (parts) => heif("heic", parts)],
  ["AVIF", (parts) => heif("avif", parts)],
];

describe.each(withExif)("a %s", (_name, build) => {
  it("with no metadata is clean", async () => {
    expect(await checkImage(build({}))).toEqual([]);
  });

  it("with only an orientation is clean", async () => {
    expect(await checkImage(build({ exif: orientation }))).toEqual([]);
  });

  it("with camera details fails, naming the tag", async () => {
    const found = await checkImage(build({ exif: camera }));
    expect(found).toHaveLength(1);
    expect(found[0]).toContain("Make");
  });

  it("with a location fails, saying so", async () => {
    const found = (await checkImage(build({ exif: located }))).join("\n");
    expect(found).toContain("GPS");
  });

  it("with an orientation and one other tag fails, naming only the other tag", async () => {
    const found = await checkImage(
      build({
        exif: tiff([
          { tag: TAGS.orientation, short: 6 },
          { tag: TAGS.software, text: "Editor 1.0" },
        ]),
      }),
    );
    expect(found).toHaveLength(1);
    expect(found[0]).toContain("Software");
    expect(found[0]).toMatch(/: Software$/);
  });

  it("with an XMP block fails, even one with no fields in it", async () => {
    for (const packet of [xmp, emptyXmp]) {
      const found = (await checkImage(build({ xmp: packet }))).join("\n");
      expect(found).toContain("XMP");
    }
  });
});

describe("a JPEG", () => {
  it("with a colour profile is clean: it describes colour, not the person or the place", async () => {
    expect(await checkImage(jpeg({ icc: true }))).toEqual([]);
    expect(await checkImage(jpeg({ icc: true, exif: orientation }))).toEqual(
      [],
    );
  });

  it("with an IPTC block fails", async () => {
    const found = (await checkImage(jpeg({ iptc: "A caption" }))).join("\n");
    expect(found).toContain("IPTC");
  });

  it("with an EXIF date block fails", async () => {
    const found = await checkImage(jpeg({ exif: dated }));
    expect(found.length).toBeGreaterThan(0);
  });

  it("reports every kind of metadata it finds, not just the first", async () => {
    const found = (
      await checkImage(jpeg({ exif: located, xmp, iptc: "A caption" }))
    ).join("\n");
    expect(found).toContain("Make");
    expect(found).toContain("GPS");
    expect(found).toContain("XMP");
    expect(found).toContain("IPTC");
  });
});

describe("a PNG", () => {
  // The eXIf chunk is where modern tools put EXIF. It is found wherever it sits in the file.
  it("with an eXIf chunk after the image data fails", async () => {
    const found = await checkImage(png({ exif: located, exifAfterData: true }));
    expect(found.join("\n")).toContain("Make");
    expect(found.join("\n")).toContain("GPS");
  });

  it("with an eXIf chunk and a bad checksum still fails, rather than slipping past", async () => {
    const bytes = png({ exif: camera });
    // The checksum of the eXIf chunk is the last four bytes before IDAT's length field.
    const at = Buffer.from(bytes).indexOf("IDAT") - 4 - 1;
    bytes[at] = (bytes[at] ?? 0) ^ 0xff;
    expect((await checkImage(bytes)).join("\n")).toContain("Make");
  });

  it("with a raw profile text chunk that carries EXIF fails", async () => {
    const bytes = concat(png(), ascii("Raw profile type exif"));
    expect((await checkImage(bytes)).join("\n")).toContain("raw profile");
  });

  it("with a raw colour profile text chunk is clean", async () => {
    const bytes = concat(png(), ascii("Raw profile type icc"));
    expect(await checkImage(bytes)).toEqual([]);
  });
});

describe("a GIF", () => {
  it("with no metadata is clean", async () => {
    expect(await checkImage(gif())).toEqual([]);
  });

  it("with an XMP block fails", async () => {
    expect((await checkImage(gif({ xmp }))).join("\n")).toContain("XMP");
  });
});

describe("a TIFF", () => {
  const structure = [
    { tag: TAGS.imageWidth, long: 1 },
    { tag: TAGS.imageLength, long: 1 },
    { tag: TAGS.bitsPerSample, short: 8 },
    { tag: TAGS.compression, short: 1 },
    { tag: TAGS.photometric, short: 1 },
  ];

  it("with only the tags that describe the image, and an orientation, is clean", async () => {
    expect(
      await checkImage(
        tiff([...structure, { tag: TAGS.orientation, short: 1 }]),
      ),
    ).toEqual([]);
  });

  it("with the device, software, artist or copyright fails", async () => {
    for (const [tag, name] of [
      [TAGS.make, "Make"],
      [TAGS.software, "Software"],
      [TAGS.artist, "Artist"],
      [TAGS.copyright, "Copyright"],
    ] as const) {
      const found = await checkImage(
        tiff([...structure, { tag, text: "Louis" }]),
      );
      expect(found.join("\n"), name).toContain(name);
    }
  });

  it("with a location fails", async () => {
    const found = await checkImage(
      tiff(structure, { gps: [{ tag: TAGS.gpsLatitudeRef, text: "N" }] }),
    );
    expect(found.join("\n")).toContain("GPS");
  });
});

describe("a file that is not a readable image", () => {
  it("fails closed: it cannot be shown to be clean", async () => {
    const found = await checkImage(ascii("this is not an image"));
    expect(found).toHaveLength(1);
    expect(found[0]).toContain("could not be read");
  });

  it("fails closed when it is empty", async () => {
    expect((await checkImage(new Uint8Array(0)))[0]).toContain(
      "could not be read",
    );
  });
});
