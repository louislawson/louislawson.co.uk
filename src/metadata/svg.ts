import { decodeText } from "./bytes.ts";
import { checkImage } from "./image.ts";
import { PATH_LIKE, PATH_LIKE_MESSAGE } from "./paths.ts";

// Refuses an SVG that carries editor data, a local path or a photo with its own metadata. Phase 3
// commits authored SVG icons, and Inkscape writes the name of the file (sodipodi:docname) and
// often the full local path it was exported to (inkscape:export-filename) into the file itself.

/** A metadata element, in any case, with or without a namespace prefix and with or without content. */
const METADATA_ELEMENT = /<(?:[\w.-]+:)?metadata[\s/>]/i;

/** An Inkscape or Sodipodi attribute or namespace, such as inkscape:version or xmlns:inkscape. */
const EDITOR_DATA =
  /\b(?:sodipodi|inkscape):[\w.-]+|xmlns:(?:sodipodi|inkscape)\b|sodipodi\.sourceforge\.net|inkscape\.org\/namespaces/gi;

/** A raster picture embedded as a base64 data URI, such as a photo pasted into a drawing. */
const RASTER_DATA_URI =
  /data:image\/(?:jpe?g|png|gif|webp|avif|tiff|heic|heif);base64,([A-Za-z0-9+/=\s]+)/gi;

/** Everything wrong with an SVG's metadata, or an empty list if it is clean. */
export async function checkSvg(bytes: Uint8Array): Promise<string[]> {
  const problems: string[] = [];
  const text = decodeText(bytes);

  // Judge the pictures by what they carry, and leave their payload out of the text checks.
  const pictures = [...text.matchAll(RASTER_DATA_URI)];
  for (const [index, picture] of pictures.entries()) {
    const image = Buffer.from(
      (picture[1] ?? "").replaceAll(/\s/g, ""),
      "base64",
    );
    for (const problem of await checkImage(image)) {
      problems.push(`an embedded image (data URI ${index + 1}): ${problem}`);
    }
  }
  const markup = text.replaceAll(RASTER_DATA_URI, "");

  const own: string[] = [];
  if (METADATA_ELEMENT.test(markup)) own.push("a <metadata> element");
  const editorData = [...new Set(markup.match(EDITOR_DATA) ?? [])];
  if (editorData.length > 0) {
    own.push(`Inkscape editor data (${editorData.join(", ")})`);
  }
  if (PATH_LIKE.test(markup)) own.push(`${PATH_LIKE_MESSAGE} in the file`);
  return [...own, ...problems];
}
