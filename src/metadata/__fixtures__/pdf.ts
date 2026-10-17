import { ascii, concat } from "./bytes";

// A hand-built PDF with only the parts a test asks for, so a test can give it the metadata a
// real tool would leave behind. The cross-reference offsets are real, so a strict reader accepts it.

const pdfString = (value: string) =>
  `(${value.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)")})`;

const infoDict = (
  info: Record<string, string>,
  indirect: Record<string, number> = {},
) =>
  `<< ${Object.entries(info)
    .map(([key, value]) =>
      key in indirect
        ? `/${key} ${indirect[key]} 0 R`
        : `/${key} ${pdfString(value)}`,
    )
    .join(" ")} >>`;

export interface PdfOptions {
  /** The document-info dictionary: Title, Producer, Author, Creator, CreationDate, ... */
  info?: Record<string, string>;
  /** Info keys whose value is a separate object ("/Producer 6 0 R") rather than a direct string. */
  indirect?: string[];
  /** An XMP packet for the catalog's Metadata stream. */
  xmp?: string;
  /** Write the XMP packet as UTF-16 with a byte-order mark, which the XMP specification allows. */
  xmpUtf16?: boolean;
  /** An incremental update that replaces the info dictionary, leaving the old one in the file. */
  update?: { info: Record<string, string> };
}

function xrefEntry(offset: number): string {
  return `${String(offset).padStart(10, "0")} 00000 n \n`;
}

/** UTF-16 little-endian with a byte-order mark, as latin1 characters one byte each. */
const utf16le = (text: string) =>
  `\xff\xfe${[...text].map((char) => `${char}\0`).join("")}`;

export function pdf(options: PdfOptions = {}): Uint8Array {
  const xmp = options.xmp
    ? options.xmpUtf16
      ? utf16le(options.xmp)
      : options.xmp
    : undefined;
  const indirectKeys = options.indirect ?? [];
  // Objects 1 to 5 are fixed; each indirect info value is an object after them.
  const indirectNumbers = Object.fromEntries(
    indirectKeys.map((key, index) => [key, 6 + index]),
  );
  const objects: string[] = [
    `<< /Type /Catalog /Pages 2 0 R${xmp ? " /Metadata 5 0 R" : ""} >>`,
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] >>",
    options.info ? infoDict(options.info, indirectNumbers) : "<< >>",
    xmp
      ? `<< /Type /Metadata /Subtype /XML /Length ${xmp.length} >>\nstream\n${xmp}\nendstream`
      : "<< >>",
    ...indirectKeys.map((key) => pdfString(options.info?.[key] ?? "")),
  ];
  let text = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, index) => {
    offsets.push(text.length);
    text += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefAt = text.length;
  text += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map(xrefEntry).join("")}`;
  text += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R${options.info ? " /Info 4 0 R" : ""} >>\nstartxref\n${xrefAt}\n%%EOF\n`;

  if (options.update) {
    const newObject = objects.length + 1;
    const objectAt = text.length;
    text += `${newObject} 0 obj\n${infoDict(options.update.info)}\nendobj\n`;
    const updateXrefAt = text.length;
    text += `xref\n${newObject} 1\n${xrefEntry(objectAt)}`;
    text += `trailer\n<< /Size ${newObject + 1} /Root 1 0 R /Info ${newObject} 0 R /Prev ${xrefAt} >>\nstartxref\n${updateXrefAt}\n%%EOF\n`;
  }
  return concat(ascii(text));
}
