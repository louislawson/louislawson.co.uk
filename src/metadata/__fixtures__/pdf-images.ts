import {
  PDFDocument,
  PDFName,
  PDFRawStream,
  type PDFRef,
} from "@cantoo/pdf-lib";
import { deflateSync } from "node:zlib";
import { utf8 } from "./bytes";

// PDFs with a photo inside, built with the same library the check reads them with. A JPEG in a PDF
// (/Filter /DCTDecode) is the original file, EXIF and all, so a phone photo's location travels
// inside the document.

const xmpPacket = (fields: string) =>
  `<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?><x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/">${fields}</rdf:Description></rdf:RDF></x:xmpmeta><?xpacket end="w"?>`;

export interface EmbeddedOptions {
  /** Store the image with a FlateDecode filter in front of DCTDecode, as some writers do. */
  flate?: boolean;
  /** An XMP stream on the image object. */
  imageXmp?: boolean;
  /** An XMP stream on the page object. */
  pageXmp?: boolean;
}

/** A one-page PDF with `jpeg` embedded and drawn on the page. No info dictionary, no catalog XMP. */
export async function pdfWithJpeg(
  jpeg: Uint8Array,
  options: EmbeddedOptions = {},
): Promise<Uint8Array> {
  const doc = await PDFDocument.create({ updateMetadata: false });
  const page = doc.addPage([200, 200]);
  let imageRef: PDFRef;
  if (options.flate) {
    const stream = PDFRawStream.of(
      doc.context.obj({
        Type: "XObject",
        Subtype: "Image",
        Width: 1,
        Height: 1,
        ColorSpace: "DeviceGray",
        BitsPerComponent: 8,
        Filter: ["FlateDecode", "DCTDecode"],
      }) as never,
      new Uint8Array(deflateSync(jpeg)),
    );
    // Registered but not drawn: the check walks every object, not only those a page uses.
    imageRef = doc.context.register(stream);
  } else {
    const image = await doc.embedJpg(jpeg);
    // The library writes the image object lazily, on save; make it now so it can be altered.
    await image.embed();
    imageRef = image.ref;
    page.drawImage(image, { x: 0, y: 0, width: 10, height: 10 });
  }

  const xmpStream = () =>
    doc.context.register(
      doc.context.stream(utf8(xmpPacket("<dc:title>x</dc:title>")), {
        Type: "Metadata",
        Subtype: "XML",
      }),
    );
  if (options.imageXmp) {
    const image = doc.context.lookup(imageRef) as PDFRawStream;
    image.dict.set(PDFName.of("Metadata"), xmpStream());
  }
  if (options.pageXmp) {
    page.node.set(PDFName.of("Metadata"), xmpStream());
  }
  return doc.save({ useObjectStreams: false });
}

/** A PDF holding one image stream with the given filters and bytes, placed on no page. */
export async function pdfWithImageStream(
  filter: string[],
  contents: Uint8Array,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create({ updateMetadata: false });
  doc.addPage([200, 200]);
  doc.context.register(
    PDFRawStream.of(
      doc.context.obj({
        Type: "XObject",
        Subtype: "Image",
        Width: 1,
        Height: 1,
        ColorSpace: "DeviceGray",
        BitsPerComponent: 8,
        Filter: filter,
      }) as never,
      contents,
    ),
  );
  return doc.save({ useObjectStreams: false });
}
