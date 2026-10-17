import {
  PDFDict,
  PDFDocument,
  PDFName,
  PDFRawStream,
  decodePDFRawStream,
} from "@cantoo/pdf-lib";

// Refuses a PDF that carries who made it, with what, or where from. A CV exported from a word
// processor keeps the author, the application and often the file path in its metadata.

/** The only document-info keys a PDF may carry: the title, and the tool that wrote the file. */
const ALLOWED_INFO_KEYS = ["Title", "Producer"];

const PATH_LIKE = /[A-Za-z]:\\|\/Users\/|\/home\//;

/**
 * An XMP element or attribute that names a person or the software behind the file. "Author" is
 * the XMP twin of the info dictionary's Author key, which is not allowed either.
 */
const CREATOR_OR_TOOL = /creator|author|tool|softwareagent/i;

const latin1 = (bytes: Uint8Array) => Buffer.from(bytes).toString("latin1");

/** The text of the catalog's XMP metadata stream, decoded however it was compressed. */
function xmpText(doc: PDFDocument): string | undefined {
  const reference = doc.catalog.get(PDFName.of("Metadata"));
  const stream = reference ? doc.context.lookup(reference) : undefined;
  if (!(stream instanceof PDFRawStream)) return undefined;
  // An XMP packet may be UTF-16, which as UTF-8 has a NUL between every character and would hide
  // every name from the checks below. Dropping the NULs and the byte-order mark undoes that.
  return Buffer.from(decodePDFRawStream(stream).decode())
    .toString("utf8")
    .replaceAll("\0", "")
    .replaceAll(/[\ufeff\ufffd]/g, "");
}

/** The qualified names in an XMP packet that name a creator or a tool, such as dc:creator. */
function creatorAndToolFields(xmp: string): string[] {
  const names = xmp.match(/[A-Za-z][\w.-]*:[A-Za-z][\w.-]*/g) ?? [];
  const fields = names.filter((name) =>
    CREATOR_OR_TOOL.test(name.slice(name.indexOf(":") + 1)),
  );
  return [...new Set(fields)];
}

/**
 * Everything wrong with a PDF's metadata, or an empty list if it is clean. A PDF that cannot be
 * read (damaged, or encrypted) is reported too: a privacy check must not pass what it cannot see.
 */
export async function checkPdf(bytes: Uint8Array): Promise<string[]> {
  const problems: string[] = [];

  // Each incremental update ends in its own %%EOF and leaves the metadata it replaced in the file.
  const revisions = (latin1(bytes).match(/%%EOF/g) ?? []).length;
  if (revisions > 1) {
    problems.push(
      `${revisions} revisions (${revisions} %%EOF markers): an incremental update keeps the old metadata readable, so the file needs a clean rewrite`,
    );
  }

  try {
    const doc = await PDFDocument.load(bytes, { updateMetadata: false });
    const metadata: string[] = [];

    const infoReference = doc.context.trailerInfo.Info;
    const info = infoReference
      ? doc.context.lookup(infoReference, PDFDict)
      : undefined;
    if (info) {
      const extra: string[] = [];
      for (const [key, value] of info.entries()) {
        const name = key.decodeText();
        if (!ALLOWED_INFO_KEYS.includes(name)) extra.push(name);
        // A value may be stored as a separate object ("/Producer 14 0 R"); read what it points to.
        const resolved = doc.context.lookup(value);
        metadata.push(
          resolved &&
            "decodeText" in resolved &&
            typeof resolved.decodeText === "function"
            ? String(resolved.decodeText())
            : String(resolved),
        );
      }
      if (extra.length > 0) {
        problems.push(
          `document-info keys other than Title and Producer: ${extra.join(", ")}`,
        );
      }
    }

    const xmp = xmpText(doc);
    if (xmp !== undefined) {
      metadata.push(xmp);
      const fields = creatorAndToolFields(xmp);
      if (fields.length > 0) {
        problems.push(`XMP creator or tool fields: ${fields.join(", ")}`);
      }
    }

    if (metadata.some((text) => PATH_LIKE.test(text))) {
      problems.push(
        "a path-like string (such as C:\\, /Users/ or /home/) in the metadata",
      );
    }
  } catch (error) {
    return [
      `could not be read as a PDF (${error instanceof Error ? error.message : String(error)}), so it cannot be shown to be free of metadata`,
    ];
  }
  return problems;
}
