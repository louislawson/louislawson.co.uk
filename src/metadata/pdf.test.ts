import { describe, expect, it } from "vitest";
import { ascii } from "./__fixtures__/bytes";
import { pdf } from "./__fixtures__/pdf";
import { checkPdf } from "./pdf";

const xmp = (fields: string) =>
  `<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?><x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:xmp="http://ns.adobe.com/xap/1.0/" xmlns:pdf="http://ns.adobe.com/pdf/1.3/" xmlns:stEvt="http://ns.adobe.com/xap/1.0/sType/ResourceEvent#">${fields}</rdf:Description></rdf:RDF></x:xmpmeta><?xpacket end="w"?>`;

describe("a clean PDF", () => {
  it("with no metadata is clean", async () => {
    expect(await checkPdf(pdf())).toEqual([]);
  });

  it("with only a Title and a Producer is clean", async () => {
    expect(
      await checkPdf(pdf({ info: { Title: "CV", Producer: "qpdf 12" } })),
    ).toEqual([]);
  });

  it("with XMP that names no creator or tool is clean", async () => {
    expect(
      await checkPdf(pdf({ xmp: xmp("<dc:title>CV</dc:title>") })),
    ).toEqual([]);
  });
});

describe("the document-info dictionary", () => {
  it.each([
    "Author",
    "Creator",
    "Subject",
    "Keywords",
    "CreationDate",
    "ModDate",
    "Trapped",
    "Company",
  ])("fails on %s, naming it", async (key) => {
    const found = await checkPdf(
      pdf({ info: { Title: "CV", Producer: "qpdf", [key]: "x" } }),
    );
    expect(found).toHaveLength(1);
    expect(found[0]).toContain(key);
    expect(found[0]).toContain("Title and Producer");
  });

  it("names every extra key at once", async () => {
    const found = await checkPdf(
      pdf({ info: { Author: "x", Creator: "y", CreationDate: "z" } }),
    );
    expect(found.join("\n")).toMatch(/Author.*Creator.*CreationDate/);
  });
});

describe("XMP creator and tool fields", () => {
  it.each([
    [
      "dc:creator",
      "<dc:creator><rdf:Seq><rdf:li>Louis</rdf:li></rdf:Seq></dc:creator>",
    ],
    ["xmp:CreatorTool", "<xmp:CreatorTool>Word</xmp:CreatorTool>"],
    [
      "stEvt:softwareAgent",
      "<stEvt:softwareAgent>Acrobat</stEvt:softwareAgent>",
    ],
  ])("fails on %s as an element", async (name, fields) => {
    const found = await checkPdf(pdf({ xmp: xmp(fields) }));
    expect(found).toHaveLength(1);
    expect(found[0]).toContain(name);
  });

  it("fails on a creator or tool written as an attribute", async () => {
    const packet = xmp("").replace(
      'rdf:about=""',
      'rdf:about="" xmp:CreatorTool="Word"',
    );
    const found = await checkPdf(pdf({ xmp: packet }));
    expect(found.join("\n")).toContain("xmp:CreatorTool");
  });

  it("does not mind the Producer, which the info dictionary may also hold", async () => {
    expect(
      await checkPdf(pdf({ xmp: xmp("<pdf:Producer>qpdf 12</pdf:Producer>") })),
    ).toEqual([]);
  });
});

describe("revisions", () => {
  it("fails on an incremental update, which keeps the old metadata readable", async () => {
    const found = await checkPdf(
      pdf({
        info: { Title: "CV" },
        update: { info: { Title: "CV" } },
      }),
    );
    expect(found).toHaveLength(1);
    expect(found[0]).toContain("revision");
    expect(found[0]).toContain("2");
  });

  it("counts the old Author even though the newest info dictionary has none", async () => {
    const found = await checkPdf(
      pdf({
        info: { Title: "CV", Author: "Louis" },
        update: { info: { Title: "CV" } },
      }),
    );
    expect(found.join("\n")).toContain("revision");
  });
});

describe("path-like strings", () => {
  it.each([
    ["a Windows path", "C:\\Users\\louis\\Documents\\cv.docx"],
    ["a macOS path", "/Users/louis/Documents/cv.pages"],
    ["a Linux path", "/home/louis/cv.odt"],
  ])("fails on %s in the Title", async (_name, path) => {
    const found = await checkPdf(pdf({ info: { Title: path } }));
    expect(found).toHaveLength(1);
    expect(found[0]).toContain("path-like");
  });

  it("fails on one in the Producer", async () => {
    const found = await checkPdf(
      pdf({ info: { Producer: "/home/louis/bin/tool" } }),
    );
    expect(found.join("\n")).toContain("path-like");
  });

  it("fails on one in the XMP", async () => {
    const found = await checkPdf(
      pdf({ xmp: xmp("<dc:title>C:\\Users\\louis\\cv.docx</dc:title>") }),
    );
    expect(found.join("\n")).toContain("path-like");
  });

  it("leaves an ordinary title alone", async () => {
    expect(
      await checkPdf(pdf({ info: { Title: "Louis Lawson: CV (2026)" } })),
    ).toEqual([]);
  });
});

describe("a file that is not a readable PDF", () => {
  it("fails closed: it cannot be shown to be clean", async () => {
    const found = await checkPdf(ascii("this is not a pdf"));
    expect(found).toHaveLength(1);
    expect(found[0]).toContain("could not be read");
  });

  it("fails closed when it is empty", async () => {
    expect((await checkPdf(new Uint8Array(0)))[0]).toContain(
      "could not be read",
    );
  });
});

describe("reports everything at once", () => {
  it("lists each kind of problem it finds", async () => {
    const found = (
      await checkPdf(
        pdf({
          info: { Title: "C:\\Users\\louis\\cv.docx", Author: "Louis" },
          xmp: xmp("<xmp:CreatorTool>Word</xmp:CreatorTool>"),
          update: { info: { Title: "CV" } },
        }),
      )
    ).join("\n");
    expect(found).toContain("revision");
    expect(found).toContain("xmp:CreatorTool");
  });
});
