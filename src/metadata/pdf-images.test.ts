import { deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { ascii, concat } from "./__fixtures__/bytes";
import { TAGS, tiff } from "./__fixtures__/exif";
import { jpeg, xmpPacket } from "./__fixtures__/jpeg";
import {
  pdfWithAttachment,
  pdfWithImageStream,
  pdfWithImageStreams,
  pdfWithJpeg,
} from "./__fixtures__/pdf-images";
import { checkPdf } from "./pdf";

// A JPEG inside a PDF keeps its own EXIF, so a CV with a headshot can carry the photo's location.
// Rewriting the PDF copies the image unchanged, so the check has to look inside.

const located = tiff([{ tag: TAGS.make, text: "Acme Camera" }], {
  gps: [{ tag: TAGS.gpsLatitudeRef, text: "N" }],
});

describe("a PDF with a photo in it", () => {
  it("with a clean photo is clean", async () => {
    expect(await checkPdf(await pdfWithJpeg(jpeg()))).toEqual([]);
  });

  it("with a photo that has only an orientation is clean", async () => {
    const orientation = tiff([{ tag: TAGS.orientation, short: 6 }]);
    expect(
      await checkPdf(await pdfWithJpeg(jpeg({ exif: orientation }))),
    ).toEqual([]);
  });

  it("fails when the photo has a location, naming the object", async () => {
    const found = await checkPdf(await pdfWithJpeg(jpeg({ exif: located })));
    const text = found.join("\n");
    expect(text).toMatch(/an embedded image \(object \d+\)/);
    expect(text).toContain("GPS location data");
    expect(text).toContain("Make");
  });

  it("fails when the photo carries an XMP block or an IPTC block", async () => {
    const xmp = (
      await checkPdf(
        await pdfWithJpeg(jpeg({ xmp: xmpPacket("<dc:title>x</dc:title>") })),
      )
    ).join("\n");
    expect(xmp).toContain("an embedded image");
    expect(xmp).toContain("XMP");
    const iptc = (
      await checkPdf(await pdfWithJpeg(jpeg({ iptc: "A caption" })))
    ).join("\n");
    expect(iptc).toContain("IPTC");
  });

  it("fails when a filter before DCTDecode hides the photo, as a Flate-compressed JPEG does", async () => {
    const found = await checkPdf(
      await pdfWithJpeg(jpeg({ exif: located }), { flate: true }),
    );
    expect(found.join("\n")).toContain("GPS location data");
  });

  it("passes a clean photo stored behind a Flate filter", async () => {
    expect(await checkPdf(await pdfWithJpeg(jpeg(), { flate: true }))).toEqual(
      [],
    );
  });

  it("reports an embedded image that cannot be read, rather than passing it", async () => {
    const found = await checkPdf(
      await pdfWithImageStream(["DCTDecode"], ascii("not a jpeg at all")),
    );
    expect(found).toHaveLength(1);
    expect(found[0]).toContain("an embedded image");
    expect(found[0]).toContain("could not be read");
  });

  describe("JPEG 2000 (JPXDecode)", () => {
    it("is checked too: a block of XMP in it fails", async () => {
      const found = await checkPdf(
        await pdfWithImageStream(
          ["JPXDecode"],
          concat(ascii("jP  "), ascii(xmpPacket("<dc:title>x</dc:title>"))),
        ),
      );
      expect(found.join("\n")).toContain("XMP");
    });

    it("fails closed when it cannot be read, as no reader here opens JPEG 2000", async () => {
      const found = await checkPdf(
        await pdfWithImageStream(["JPXDecode"], ascii("jP  plain")),
      );
      expect(found.join("\n")).toContain("could not be read");
    });
  });

  it("does not treat an image with only a Flate filter as a photo: it is raw pixels", async () => {
    // Raw pixel data can contain any bytes, including ones that look like a marker.
    const pixels = concat(ascii("Exif\0\0II*\0"), ascii("<?xpacket"));
    expect(
      await checkPdf(
        await pdfWithImageStream(
          ["FlateDecode"],
          new Uint8Array(deflateSync(pixels)),
        ),
      ),
    ).toEqual([]);
  });
});

describe("XMP on an object other than the catalog", () => {
  it("fails on one on a page", async () => {
    const found = await checkPdf(await pdfWithJpeg(jpeg(), { pageXmp: true }));
    expect(found).toHaveLength(1);
    expect(found[0]).toMatch(
      /XMP metadata on an object other than the catalog \(object \d+\)/,
    );
  });

  it("fails on one on an image", async () => {
    const found = await checkPdf(await pdfWithJpeg(jpeg(), { imageXmp: true }));
    expect(found.join("\n")).toMatch(
      /XMP metadata on an object other than the catalog \(object \d+\)/,
    );
  });
});

describe("one bad embedded image does not hide the rest", () => {
  const garbage = ascii("not a deflate stream at all");

  it("reports an image whose filters cannot be undone, labelled with its object", async () => {
    const found = await checkPdf(
      await pdfWithImageStream(["FlateDecode", "DCTDecode"], garbage),
    );
    expect(found).toHaveLength(1);
    expect(found[0]).toMatch(
      /an embedded image \(object \d+\): could not be read/,
    );
  });

  it("still reports the other images and the rest of the document", async () => {
    const found = (
      await checkPdf(
        await pdfWithImageStreams(
          [
            { filter: ["FlateDecode", "DCTDecode"], contents: garbage },
            { filter: ["DCTDecode"], contents: jpeg({ exif: located }) },
          ],
          { author: "Louis Lawson" },
        ),
      )
    ).join("\n");
    expect(found).toContain("could not be read");
    expect(found).toContain("GPS location data");
    expect(found).toContain("Author");
  });
});

describe("a file attached to the PDF", () => {
  it("fails: an attachment is not checked, and could be a photo with a location", async () => {
    const found = await checkPdf(
      await pdfWithAttachment(jpeg({ exif: located })),
    );
    expect(found).toHaveLength(1);
    expect(found[0]).toMatch(/an attached file \(object \d+\)/);
  });
});
