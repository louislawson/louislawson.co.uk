// The rules for a project's Markdown body, its write-up. No schema covers a body, so these are
// checked on the source. The scan is deliberately small: it knows fenced code, code spans, headings
// and images, which are the only things the rules are about.

/** Quote and list markers in front of a block, which a heading can sit behind: `> # Title`. */
const CONTAINER_PREFIX = /^(?: {0,3}(?:>|[-*+]|\d+[.)])[ \t]*)+/;
/** An ATX heading of one or two `#`s: up to three spaces of indent, then the `#`s and a space or the end. */
const ATX_HEADING = /^ {0,3}(#{1,2})(?=[ \t]|$)/;
/** The line under a setext heading: `===` makes a level 1, `---` a level 2. */
const SETEXT_UNDERLINE = /^ {0,3}(=+|-+)[ \t]*$/;
/** A line that starts a block, so a `---` under its paragraph is a thematic break, not an underline. */
const BLOCK_START = /^ {0,3}(?:[-*+]\s|\d+[.)]\s|#{1,6}(?:\s|$)|>|<)/;
const FENCE = /^ {0,3}(`{3,}|~{3,})/;
/** A heading written as HTML: `<h1>` or `<h2>`, in any case. */
const HTML_HEADING = /<h([12])\b/gi;
/** Alt text may hold escaped characters and one level of brackets: `![Stack [simplified]](a.svg)`. */
const ALT = String.raw`((?:[^\[\]\\]|\\.|\[[^\[\]]*\])*)`;
const INLINE_IMAGE = new RegExp(
  String.raw`!\[${ALT}\]\(\s*(<[^>]*>|[^\s)]*)`,
  "g",
);
const REFERENCE_IMAGE = new RegExp(String.raw`!\[${ALT}\]\[([^\]]*)\]`, "g");
const HTML_IMAGE = /<img\b[^>]*>/gi;
const ALT_ATTRIBUTE = /\balt\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>"']+))/i;
/** A code span, which never runs over a blank line. */
const CODE_SPAN = /(`+)(?:(?!\1)[^\n]|\n(?!\s*\n))*?\1/g;

interface Found {
  line: number;
  column: number;
  problem: string;
}

// The line is the write-up's own, counted from the first line below the frontmatter: the body is
// all the loader keeps, so the file's line is that plus the frontmatter's length.
function where(line: number): string {
  return `write-up line ${line}`;
}

/** A heading of the wrong level, named with the line it is on. */
function headingProblem(line: number, text: string, level: 1 | 2): string {
  return `${where(line)}: "${text.trim()}" is a level-${level} heading, but a write-up's headings start at ### (the page has the h1 and the "# write-up" h2 above it)`;
}

function imageProblem(line: number, what: string): string {
  return `${where(line)}: the image ${what} has no alt text, so describe it in the brackets`;
}

/**
 * The text with every code span filled with `x`, so what is in one is never read as Markdown and an
 * alt text made only of code still has a word in it. Line breaks stay, so a line can be counted.
 */
function withoutCodeSpans(text: string): string {
  return text.replace(CODE_SPAN, (span) => span.replace(/[^\n]/g, "x"));
}

/** Where in the text an index falls: its line, from 1, and its column on that line. */
function position(
  text: string,
  index: number,
): { line: number; column: number } {
  const before = text.slice(0, index);
  const line = before.split("\n").length;
  return { line, column: index - (before.lastIndexOf("\n") + 1) };
}

/**
 * What is wrong with a project's Markdown body, one message per problem, each with its line:
 *
 * - a `#` or `##` heading, because the page already has an h1 (the title) and an h2 ("# write-up"),
 *   so a write-up's own headings start at `###`. Found as an ATX or underlined heading, behind a
 *   quote or list marker, or written as `<h1>` or `<h2>`;
 * - an image with empty alt text, because a diagram a reader cannot see must still be described.
 *   Found as `![](...)`, a reference image, or an `<img>`, on one line or several.
 *
 * Fenced code is skipped, so a shell comment (`# install`) or a Markdown example is left alone, and
 * so are code spans.
 */
export function writeUpProblems(body: string): string[] {
  const found: Found[] = [];
  const kept: string[] = [];
  let fence: { marker: string; length: number } | undefined;
  // The first line of the paragraph being read and the line before this one, both empty between
  // paragraphs. A `---` under a paragraph that began as a list item or a quote is that block's lazy
  // continuation, not an underline.
  let paragraphFirst = "";
  let previous = "";

  body.split(/\r?\n/).forEach((line, index) => {
    const number = index + 1;

    if (fence) {
      // A fence closes on its own marker, at least as long, with nothing after it.
      const close = FENCE.exec(line);
      if (
        close &&
        close[1]![0] === fence.marker &&
        close[1]!.length >= fence.length &&
        line.trim() === close[1]
      ) {
        fence = undefined;
      }
      kept.push("");
      paragraphFirst = previous = "";
      return;
    }
    const open = FENCE.exec(line);
    if (open) {
      fence = { marker: open[1]![0]!, length: open[1]!.length };
      kept.push("");
      paragraphFirst = previous = "";
      return;
    }
    kept.push(line);

    if (line.trim() === "") {
      paragraphFirst = previous = "";
      return;
    }

    const content = line.replace(CONTAINER_PREFIX, "");
    const atx = ATX_HEADING.exec(content);
    if (atx) {
      found.push({
        line: number,
        column: 0,
        problem: headingProblem(number, content, atx[1]!.length as 1 | 2),
      });
      paragraphFirst = previous = "";
      return;
    }

    const underline = SETEXT_UNDERLINE.exec(line);
    if (
      underline &&
      previous !== "" &&
      !BLOCK_START.test(paragraphFirst) &&
      // Four spaces make a code block, which no underline can turn into a heading.
      !/^ {4}/.test(paragraphFirst)
    ) {
      found.push({
        line: number - 1,
        column: 0,
        problem: headingProblem(
          number - 1,
          previous,
          underline[1]![0] === "=" ? 1 : 2,
        ),
      });
      // The heading is done: another underline below it is a rule.
      paragraphFirst = previous = "";
      return;
    }

    if (paragraphFirst === "") paragraphFirst = line;
    previous = line;
  });

  // The rest is found in the whole text, because a tag or an alt text can run over a line break.
  const text = withoutCodeSpans(kept.join("\n"));
  for (const m of text.matchAll(HTML_HEADING)) {
    const { line, column } = position(text, m.index);
    found.push({
      line,
      column,
      problem: headingProblem(
        line,
        `<${m[0].slice(1)}>`,
        Number(m[1]) as 1 | 2,
      ),
    });
  }
  const empty = (alt: string) => alt.trim() === "";
  for (const m of text.matchAll(INLINE_IMAGE)) {
    if (!empty(m[1]!)) continue;
    const { line, column } = position(text, m.index);
    found.push({
      line,
      column,
      problem: imageProblem(line, m[2] || "(no address)"),
    });
  }
  for (const m of text.matchAll(REFERENCE_IMAGE)) {
    if (!empty(m[1]!)) continue;
    const { line, column } = position(text, m.index);
    found.push({ line, column, problem: imageProblem(line, `[${m[2]}]`) });
  }
  for (const m of text.matchAll(HTML_IMAGE)) {
    const alt = ALT_ATTRIBUTE.exec(m[0]);
    if (!empty(alt?.[1] ?? alt?.[2] ?? alt?.[3] ?? "")) continue;
    const { line, column } = position(text, m.index);
    found.push({
      line,
      column,
      problem: imageProblem(line, m[0].replace(/\s+/g, " ")),
    });
  }

  return found
    .sort((a, b) => a.line - b.line || a.column - b.column)
    .map((f) => f.problem);
}
