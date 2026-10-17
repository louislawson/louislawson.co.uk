import { ascii, concat, u16, utf8 } from "./bytes";

function segment(marker: number, payload: Uint8Array): Uint8Array {
  return concat(u16(marker), u16(payload.length + 2), payload);
}

export const xmpPacket = (fields: string): string =>
  `<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?><x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">${fields}</rdf:RDF></x:xmpmeta><?xpacket end="w"?>`;

/** IPTC-IIM records as Photoshop stores them: an 8BIM resource 0x0404 inside an APP13 segment. */
function iptcResource(caption: string): Uint8Array {
  const text = utf8(caption);
  const record = concat(
    new Uint8Array([0x1c, 0x02, 0x78]),
    u16(text.length),
    text,
  );
  const padded = record.length % 2 ? concat(record, new Uint8Array(1)) : record;
  return concat(
    ascii("Photoshop 3.0\0"),
    ascii("8BIM"),
    u16(0x0404),
    new Uint8Array([0, 0]),
    new Uint8Array([0, 0, 0, record.length]),
    padded,
  );
}

/** A JPEG made of the segments asked for, a 1 x 1 frame and an end marker. */
export function jpeg(
  parts: {
    exif?: Uint8Array;
    xmp?: string;
    iptc?: string;
    icc?: boolean;
    comment?: string;
  } = {},
): Uint8Array {
  const segments: Uint8Array[] = [u16(0xffd8)];
  if (parts.exif) {
    segments.push(segment(0xffe1, concat(ascii("Exif\0\0"), parts.exif)));
  }
  if (parts.xmp !== undefined) {
    segments.push(
      segment(
        0xffe1,
        concat(ascii("http://ns.adobe.com/xap/1.0/\0"), utf8(parts.xmp)),
      ),
    );
  }
  if (parts.iptc !== undefined) {
    segments.push(segment(0xffed, iptcResource(parts.iptc)));
  }
  if (parts.icc) {
    // A colour profile is allowed: it describes colour, not the person or the place.
    segments.push(
      segment(
        0xffe2,
        concat(
          ascii("ICC_PROFILE\0"),
          new Uint8Array([1, 1]),
          new Uint8Array(128),
        ),
      ),
    );
  }
  if (parts.comment !== undefined) {
    // A COM segment: free text some editors fill with a name, a path or a note.
    segments.push(segment(0xfffe, utf8(parts.comment)));
  }
  // Start of frame (baseline, 1 x 1, one component), then start of scan and its data.
  segments.push(
    segment(0xffc0, new Uint8Array([8, 0, 1, 0, 1, 1, 1, 0x11, 0])),
    segment(0xffda, new Uint8Array([1, 1, 0, 0, 0x3f, 0])),
    new Uint8Array([0x00]),
    u16(0xffd9),
  );
  return concat(...segments);
}
