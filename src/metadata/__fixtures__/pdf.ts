import { ascii, concat } from "./bytes";

// A hand-built PDF with only the parts a test asks for, so a test can give it the metadata a
// real tool would leave behind. The cross-reference offsets are real, so a strict reader accepts it.

const pdfString = (value: string) =>
  `(${value.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)")})`;

const infoDict = (info: Record<string, string>) =>
  `<< ${Object.entries(info)
    .map(([key, value]) => `/${key} ${pdfString(value)}`)
    .join(" ")} >>`;

export interface PdfOptions {
  /** The document-info dictionary: Title, Producer, Author, Creator, CreationDate, ... */
  info?: Record<string, string>;
  /** An XMP packet for the catalog's Metadata stream. */
  xmp?: string;
  /** An incremental update that replaces the info dictionary, leaving the old one in the file. */
  update?: { info: Record<string, string> };
}

function xrefEntry(offset: number): string {
  return `${String(offset).padStart(10, "0")} 00000 n \n`;
}

export function pdf(options: PdfOptions = {}): Uint8Array {
  const objects: string[] = [
    `<< /Type /Catalog /Pages 2 0 R${options.xmp ? " /Metadata 5 0 R" : ""} >>`,
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] >>",
    options.info ? infoDict(options.info) : "<< >>",
    options.xmp
      ? `<< /Type /Metadata /Subtype /XML /Length ${options.xmp.length} >>\nstream\n${options.xmp}\nendstream`
      : "<< >>",
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
