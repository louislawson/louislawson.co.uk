import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFRawStream,
  PDFStream,
  decodePDFRawStream,
  type PDFRef,
} from "@cantoo/pdf-lib";
import { checkImage } from "./image.ts";
import { PATH_LIKE, PATH_LIKE_MESSAGE } from "./paths.ts";

// Refuses a PDF that carries who made it, with what, or where from. A CV exported from a word
// processor keeps the author, the application and often the file path in its metadata, and a
// photo in it keeps the photo's own EXIF: a JPEG in a PDF is stored as the original file.

/** The only document-info keys a PDF may carry: the title, and the tool that wrote the file. */
const ALLOWED_INFO_KEYS = ["Title", "Producer"];

/**
 * An XMP element or attribute that names a person or the software behind the file. "Author" is
 * the XMP twin of the info dictionary's Author key, which is not allowed either.
 */
const CREATOR_OR_TOOL = /creator|author|tool|softwareagent/i;

/** Image filters that store a whole image file, header blocks included. */
const FILE_FILTERS = ["DCTDecode", "JPXDecode"];

const latin1 = (bytes: Uint8Array) => Buffer.from(bytes).toString("latin1");

const METADATA = PDFName.of("Metadata");
const FILTER = PDFName.of("Filter");
const DECODE_PARMS = PDFName.of("DecodeParms");

/** The text of the catalog's XMP metadata stream, decoded however it was compressed. */
function xmpText(doc: PDFDocument): string | undefined {
  const reference = doc.catalog.get(METADATA);
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

function filterNames(dict: PDFDict): PDFName[] {
  const filter = dict.lookup(FILTER);
  if (filter instanceof PDFName) return [filter];
  if (filter instanceof PDFArray) {
    return Array.from({ length: filter.size() }, (_, index) =>
      filter.lookup(index, PDFName),
    );
  }
  return [];
}

/**
 * An image stream's bytes with every filter before the last one undone. The last filter of a
 * photo is DCTDecode (JPEG) or JPXDecode (JPEG 2000), which the library cannot decode and need
 * not: what is left is the image file itself.
 */
function imageFile(
  doc: PDFDocument,
  stream: PDFRawStream,
  filters: PDFName[],
): Uint8Array {
  const before = filters.slice(0, -1);
  if (before.length === 0) return stream.contents;
  const dict = PDFDict.withContext(doc.context);
  dict.set(FILTER, doc.context.obj(before));
  const parms = stream.dict.lookup(DECODE_PARMS);
  if (parms instanceof PDFArray) {
    dict.set(
      DECODE_PARMS,
      doc.context.obj(parms.asArray().slice(0, before.length)),
    );
  }
  return decodePDFRawStream(PDFRawStream.of(dict, stream.contents)).decode();
}

/**
 * Problems in the objects of the document other than its catalog: XMP attached to a page or an
 * image, and photos whose own metadata came with them.
 */
async function checkObjects(doc: PDFDocument): Promise<string[]> {
  const problems: string[] = [];
  const root = doc.context.trailerInfo.Root as PDFRef | undefined;
  for (const [reference, object] of doc.context.enumerateIndirectObjects()) {
    const dict =
      object instanceof PDFStream
        ? object.dict
        : object instanceof PDFDict
          ? object
          : undefined;
    if (!dict) continue;
    const where = `object ${reference.objectNumber}`;

    if (reference.objectNumber !== root?.objectNumber && dict.has(METADATA)) {
      problems.push(
        `XMP metadata on an object other than the catalog (${where})`,
      );
    }

    if (
      object instanceof PDFRawStream &&
      dict.lookup(PDFName.of("Subtype")) === PDFName.of("Image")
    ) {
      const filters = filterNames(dict);
      const last = filters.at(-1)?.decodeText();
      if (last && FILE_FILTERS.includes(last)) {
        for (const problem of await checkImage(
          imageFile(doc, object, filters),
        )) {
          problems.push(`an embedded image (${where}): ${problem}`);
        }
      }
    }
  }
  return problems;
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
      problems.push(`${PATH_LIKE_MESSAGE} in the metadata`);
    }

    problems.push(...(await checkObjects(doc)));
  } catch (error) {
    return [
      `could not be read as a PDF (${error instanceof Error ? error.message : String(error)}), so it cannot be shown to be free of metadata`,
    ];
  }
  return problems;
}
