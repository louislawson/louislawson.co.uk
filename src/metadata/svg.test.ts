import { describe, expect, it } from "vitest";
import { ascii, concat, utf8 } from "./__fixtures__/bytes";
import { png } from "./__fixtures__/containers";
import { TAGS, tiff } from "./__fixtures__/exif";
import { jpeg } from "./__fixtures__/jpeg";
import { checkSvg } from "./svg";

// Authored icons and drawings are committed as SVG. Inkscape writes the name of the file, and
// often the full local path it was exported to, into the file itself.

const svg = (body: string, attributes = "") =>
  utf8(
    `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"${attributes}>${body}</svg>`,
  );

const clean = svg(
  '<title>Arrow</title><desc>An arrow that mentions metadata only in words</desc><path d="M4 12h16m-6-6 6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.6"/>',
);

const inkscape = utf8(`<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg"
  xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"
  xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd"
  viewBox="0 0 24 24"
  sodipodi:docname="icon.svg"
  inkscape:version="1.3"
  inkscape:export-filename="C:\\Users\\louis\\Desktop\\icon.png">
  <path d="M4 12h16"/>
</svg>`);

const located = tiff([{ tag: TAGS.make, text: "Acme Camera" }], {
  gps: [{ tag: TAGS.gpsLatitudeRef, text: "N" }],
});
const dataUri = (mime: string, bytes: Uint8Array) =>
  `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`;

describe("an SVG", () => {
  it("written by hand is clean", async () => {
    expect(await checkSvg(clean)).toEqual([]);
  });

  it("with the word metadata in a title, a description or an attribute is clean", async () => {
    expect(
      await checkSvg(
        svg('<title>Metadata</title><path d="M0 0" aria-label="metadata"/>'),
      ),
    ).toEqual([]);
  });

  it("with a metadata element fails", async () => {
    const found = await checkSvg(
      svg(
        '<metadata><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"/></metadata><path d="M0 0"/>',
      ),
    );
    expect(found).toHaveLength(1);
    expect(found[0]).toContain("<metadata>");
  });

  it("with an empty, self-closing or upper-case metadata element fails", async () => {
    expect((await checkSvg(svg("<metadata/>"))).join("\n")).toContain(
      "<metadata>",
    );
    expect(
      (await checkSvg(svg("<METADATA ></METADATA>"))).join("\n"),
    ).toContain("<metadata>");
  });

  it("with a metadata element under a namespace prefix fails", async () => {
    const found = await checkSvg(
      utf8(
        '<svg:svg xmlns:svg="http://www.w3.org/2000/svg"><svg:metadata><x/></svg:metadata></svg:svg>',
      ),
    );
    expect(found.join("\n")).toContain("<metadata>");
  });

  describe("written by Inkscape", () => {
    it("fails, naming the editor data and the path", async () => {
      const found = (await checkSvg(inkscape)).join("\n");
      expect(found).toContain("sodipodi:docname");
      expect(found).toContain("inkscape:export-filename");
      expect(found).toContain("path-like");
    });

    it("fails on a sodipodi attribute alone", async () => {
      const found = await checkSvg(svg("<path/>", ' sodipodi:docname="a.svg"'));
      expect(found).toHaveLength(1);
      expect(found[0]).toContain("sodipodi:docname");
    });

    it("fails on an inkscape attribute alone, with no path", async () => {
      const found = await checkSvg(svg("<path/>", ' inkscape:version="1.3"'));
      expect(found).toHaveLength(1);
      expect(found[0]).toContain("inkscape:version");
    });

    it("fails on the namespace alone", async () => {
      for (const namespace of [
        ' xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"',
        ' xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd"',
      ]) {
        expect(
          (await checkSvg(svg("<path/>", namespace))).length,
          namespace,
        ).toBe(1);
      }
    });
  });

  describe("with a path-like string anywhere", () => {
    it.each([
      [
        "a Windows path in a comment",
        "<!-- exported to C:\\Users\\louis\\icon.png -->",
      ],
      [
        "a macOS path in a description",
        "<desc>/Users/louis/Desktop/icon.sketch</desc>",
      ],
      ["a Linux path in an attribute", '<path id="/home/louis/icon"/>'],
      [
        "a file URL to a home directory",
        '<image href="file:///home/louis/a.png"/>',
      ],
    ])("fails on %s", async (_name, body) => {
      const found = await checkSvg(svg(body));
      expect(found).toHaveLength(1);
      expect(found[0]).toContain("path-like");
    });

    it("leaves a link whose address merely has /home/ or /Users/ as a path segment alone", async () => {
      expect(
        await checkSvg(
          svg(
            '<a href="https://example.com/home/page"><a href="https://example.com/Users/guide"/></a>',
          ),
        ),
      ).toEqual([]);
    });
  });

  describe("written as UTF-16", () => {
    const utf16 = (text: string) =>
      Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(text, "utf16le")]);

    it("is read, so its metadata and paths are found", async () => {
      const found = (
        await checkSvg(
          utf16(
            '<svg xmlns="http://www.w3.org/2000/svg"><metadata/><path id="C:\\Users\\louis\\a"/></svg>',
          ),
        )
      ).join("\n");
      expect(found).toContain("<metadata>");
      expect(found).toContain("path-like");
    });

    it("is clean when it has none", async () => {
      expect(
        await checkSvg(
          utf16(
            '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg>',
          ),
        ),
      ).toEqual([]);
    });
  });

  describe("with a picture embedded as a data URI", () => {
    it("fails when the photo has a location, saying it is an embedded image", async () => {
      const found = (
        await checkSvg(
          svg(
            `<image href="${dataUri("image/jpeg", jpeg({ exif: located }))}"/>`,
          ),
        )
      ).join("\n");
      expect(found).toContain("an embedded image");
      expect(found).toContain("GPS location data");
    });

    it("is clean when the picture is", async () => {
      expect(
        await checkSvg(svg(`<image href="${dataUri("image/png", png())}"/>`)),
      ).toEqual([]);
    });

    it("fails closed when the picture cannot be read", async () => {
      const found = await checkSvg(
        svg(`<image href="${dataUri("image/png", ascii("not a png"))}"/>`),
      );
      expect(found.join("\n")).toContain("could not be read");
    });

    it("checks every picture, not only the first", async () => {
      const found = (
        await checkSvg(
          svg(
            `<image href="${dataUri("image/png", png())}"/><image href="${dataUri("image/jpeg", jpeg({ exif: located }))}"/>`,
          ),
        )
      ).join("\n");
      expect(found).toContain("GPS location data");
    });

    it("leaves a data URI that is not a raster picture alone", async () => {
      expect(
        await checkSvg(
          svg(
            `<image href="${dataUri("image/svg+xml", concat(ascii("<svg/>")))}"/>`,
          ),
        ),
      ).toEqual([]);
    });
  });

  it("reports every kind of problem at once", async () => {
    const found = (
      await checkSvg(
        svg(
          "<metadata/><!-- C:\\Users\\louis\\a.png -->",
          ' sodipodi:docname="a.svg"',
        ),
      )
    ).join("\n");
    expect(found).toContain("<metadata>");
    expect(found).toContain("sodipodi:docname");
    expect(found).toContain("path-like");
  });
});
