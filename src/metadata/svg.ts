import { PATH_LIKE, PATH_LIKE_MESSAGE } from "./paths.ts";

// Refuses an SVG that carries editor data or a local path. Phase 3 commits authored SVG icons, and
// Inkscape writes the name of the file (sodipodi:docname) and often the full local path it was
// exported to (inkscape:export-filename) into the file itself.

/** A metadata element, in any case, with or without content. */
const METADATA_ELEMENT = /<metadata[\s/>]/i;

/** An Inkscape or Sodipodi attribute or namespace, such as inkscape:version or xmlns:inkscape. */
const EDITOR_DATA =
  /\b(?:sodipodi|inkscape):[\w.-]+|xmlns:(?:sodipodi|inkscape)\b|sodipodi\.sourceforge\.net|inkscape\.org\/namespaces/gi;

/** Everything wrong with an SVG's metadata, or an empty list if it is clean. */
export function checkSvg(bytes: Uint8Array): string[] {
  const text = Buffer.from(bytes).toString("utf8");
  const problems: string[] = [];
  if (METADATA_ELEMENT.test(text)) problems.push("a <metadata> element");
  const editorData = [...new Set(text.match(EDITOR_DATA) ?? [])];
  if (editorData.length > 0) {
    problems.push(`Inkscape editor data (${editorData.join(", ")})`);
  }
  if (PATH_LIKE.test(text)) problems.push(`${PATH_LIKE_MESSAGE} in the file`);
  return problems;
}
