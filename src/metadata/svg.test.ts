import { describe, expect, it } from "vitest";
import { utf8 } from "./__fixtures__/bytes";
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

describe("an SVG", () => {
  it("written by hand is clean", () => {
    expect(checkSvg(clean)).toEqual([]);
  });

  it("with the word metadata in a title, a description or an attribute is clean", () => {
    expect(
      checkSvg(
        svg('<title>Metadata</title><path d="M0 0" aria-label="metadata"/>'),
      ),
    ).toEqual([]);
  });

  it("with a metadata element fails", () => {
    const found = checkSvg(
      svg(
        '<metadata><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"/></metadata><path d="M0 0"/>',
      ),
    );
    expect(found).toHaveLength(1);
    expect(found[0]).toContain("<metadata>");
  });

  it("with an empty or self-closing metadata element fails", () => {
    expect(checkSvg(svg("<metadata/>")).join("\n")).toContain("<metadata>");
    expect(checkSvg(svg("<METADATA ></METADATA>")).join("\n")).toContain(
      "<metadata>",
    );
  });

  describe("written by Inkscape", () => {
    it("fails, naming the editor data and the path", () => {
      const found = checkSvg(inkscape).join("\n");
      expect(found).toContain("sodipodi:docname");
      expect(found).toContain("inkscape:export-filename");
      expect(found).toContain("path-like");
    });

    it("fails on a sodipodi attribute alone", () => {
      const found = checkSvg(svg("<path/>", ' sodipodi:docname="a.svg"'));
      expect(found).toHaveLength(1);
      expect(found[0]).toContain("sodipodi:docname");
    });

    it("fails on an inkscape attribute alone, with no path", () => {
      const found = checkSvg(svg("<path/>", ' inkscape:version="1.3"'));
      expect(found).toHaveLength(1);
      expect(found[0]).toContain("inkscape:version");
    });

    it("fails on the namespace alone", () => {
      for (const namespace of [
        ' xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"',
        ' xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd"',
      ]) {
        expect(checkSvg(svg("<path/>", namespace)).length, namespace).toBe(1);
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
    ])("fails on %s", (_name, body) => {
      const found = checkSvg(svg(body));
      expect(found).toHaveLength(1);
      expect(found[0]).toContain("path-like");
    });
  });

  it("reports every kind of problem at once", () => {
    const found = checkSvg(
      svg(
        "<metadata/><!-- C:\\Users\\louis\\a.png -->",
        ' sodipodi:docname="a.svg"',
      ),
    ).join("\n");
    expect(found).toContain("<metadata>");
    expect(found).toContain("sodipodi:docname");
    expect(found).toContain("path-like");
  });
});
