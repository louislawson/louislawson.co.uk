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

  it("with a comment segment fails, even one with only a name or a path in it", async () => {
    for (const comment of [
      "Louis Lawson",
      "C:\\Users\\louis\\Pictures\\car.jpg",
    ]) {
      const found = await checkImage(jpeg({ comment }));
      expect(found, comment).toHaveLength(1);
      expect(found[0]).toContain("comment");
    }
  });

  it("finds a comment in a second image appended to the file, as multi-picture JPEGs have", async () => {
    const found = await checkImage(concat(jpeg(), jpeg({ comment: "Louis" })));
    expect(found.join("\n")).toContain("comment");
  });

  it("does not mistake trailing data that is not a JPEG for a comment", async () => {
    const trailer = new Uint8Array([0xff, 0xfe, 0x00, 0x05, 1, 2, 3]);
    expect(await checkImage(concat(jpeg(), trailer))).toEqual([]);
  });

  it("with a comment segment after an EXIF block reports both", async () => {
    const found = (
      await checkImage(jpeg({ exif: camera, comment: "Louis" }))
    ).join("\n");
    expect(found).toContain("Make");
    expect(found).toContain("comment");
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

  it("with a raw profile text chunk that carries EXIF fails, once", async () => {
    const found = await checkImage(
      png({
        text: [{ type: "zTXt", keyword: "Raw profile type exif", text: "x" }],
      }),
    );
    expect(found).toHaveLength(1);
    expect(found[0]).toContain("raw profile");
  });

  it("with a raw colour profile text chunk is still clean", async () => {
    const found = await checkImage(
      png({
        text: [{ type: "zTXt", keyword: "Raw profile type icc", text: "x" }],
      }),
    );
    expect(found).toEqual([]);
  });

  describe("raw profile text chunks", () => {
    const rawProfile = (name: string) =>
      png({
        text: [
          { type: "zTXt", keyword: `Raw profile type ${name}`, text: "x" },
        ],
      });

    it("allows only a colour profile: icc, and icm which ImageMagick also uses for one", async () => {
      expect(await checkImage(rawProfile("icc"))).toEqual([]);
      expect(await checkImage(rawProfile("icm"))).toEqual([]);
    });

    it.each(["8bim", "generic", "APP1", "iptc", "exif", "xmp"])(
      "fails on %s, which can hold anything",
      async (name) => {
        expect((await checkImage(rawProfile(name))).length).toBeGreaterThan(0);
      },
    );
  });

  describe("text chunks", () => {
    it.each(["tEXt", "zTXt", "iTXt"] as const)(
      "a %s chunk fails, naming its keyword",
      async (type) => {
        const found = await checkImage(
          png({ text: [{ type, keyword: "Author", text: "Louis Lawson" }] }),
        );
        expect(found).toHaveLength(1);
        expect(found[0]).toContain("Author");
        expect(found[0]).toContain(type);
      },
    );

    it("fails on a comment that holds a path", async () => {
      const found = await checkImage(
        png({
          text: [
            {
              type: "tEXt",
              keyword: "Comment",
              text: "C:\\Users\\louis\\icon.png",
            },
          ],
        }),
      );
      expect(found.join("\n")).toContain("Comment");
    });

    it("fails on Software too: there is no exception, and the README's exiftool command removes it", async () => {
      const found = await checkImage(
        png({
          text: [{ type: "tEXt", keyword: "Software", text: "Editor 1.0" }],
        }),
      );
      expect(found.join("\n")).toContain("Software");
    });

    it("names every chunk it finds", async () => {
      const found = (
        await checkImage(
          png({
            text: [
              { type: "tEXt", keyword: "Author", text: "x" },
              { type: "tEXt", keyword: "Title", text: "y" },
            ],
          }),
        )
      ).join("\n");
      expect(found).toContain("Author");
      expect(found).toContain("Title");
    });

    it("finds them wherever they sit, after the image data included", async () => {
      const bytes = png({
        text: [{ type: "tEXt", keyword: "Author", text: "x" }],
      });
      // Move the chunk after IDAT: it is allowed anywhere before IEND.
      const text = Buffer.from(bytes);
      const start = text.indexOf("tEXt") - 4;
      const end = start + 4 + 4 + "Author\0x".length + 4;
      const chunk = text.subarray(start, end);
      const idatEnd = text.indexOf("IEND") - 4;
      const moved = Buffer.concat([
        text.subarray(0, start),
        text.subarray(end, idatEnd),
        chunk,
        text.subarray(idatEnd),
      ]);
      expect((await checkImage(moved)).join("\n")).toContain("Author");
    });
  });
});

describe("a GIF", () => {
  it("with no metadata is clean", async () => {
    expect(await checkImage(gif())).toEqual([]);
  });

  it("with an XMP block fails, and is not mistaken for a comment", async () => {
    const found = await checkImage(gif({ xmp }));
    expect(found.join("\n")).toContain("XMP");
    expect(found.join("\n")).not.toContain("comment");
  });

  it("with a comment extension fails", async () => {
    const found = await checkImage(gif({ comment: "Made by Louis" }));
    expect(found).toHaveLength(1);
    expect(found[0]).toContain("comment");
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
