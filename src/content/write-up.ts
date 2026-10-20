// The rules for a project's Markdown body, its write-up. No schema covers a body, so these are
// checked on the source, line by line. The scan is deliberately small: it knows fenced code, code
// spans, headings and images, which are the only things the rules are about.

/** An ATX heading of one or two `#`s: up to three spaces of indent, then the `#`s and a space or the end. */
const ATX_HEADING = /^ {0,3}(#{1,2})(?=[ \t]|$)/;
/** The line under a setext heading: `===` makes a level 1, `---` a level 2. */
const SETEXT_UNDERLINE = /^ {0,3}(=+|-+)[ \t]*$/;
/** A line that starts a block, so a `---` under it is a thematic break, not an underline. */
const BLOCK_START = /^ {0,3}(?:[-*+]\s|\d+[.)]\s|#{1,6}(?:\s|$)|>|<)/;
const FENCE = /^ {0,3}(`{3,}|~{3,})/;
/** Alt text may hold escaped characters and one level of brackets: `![Stack [simplified]](a.svg)`. */
const ALT = String.raw`((?:[^\[\]\\]|\\.|\[[^\[\]]*\])*)`;
const INLINE_IMAGE = new RegExp(
  String.raw`!\[${ALT}\]\(\s*(<[^>]*>|[^\s)]*)`,
  "g",
);
const REFERENCE_IMAGE = new RegExp(String.raw`!\[${ALT}\]\[([^\]]*)\]`, "g");
const HTML_IMAGE = /<img\b[^>]*>/gi;
const ALT_ATTRIBUTE = /\balt\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>"']+))/i;
const CODE_SPAN = /(`+)(?:(?!\1)[\s\S])*?\1/g;

interface Found {
  line: number;
  column: number;
  problem: string;
}

/** A heading of the wrong level, named with the line it is on. */
function headingProblem(line: number, text: string, level: 1 | 2): string {
  return `line ${line}: "${text.trim()}" is a level-${level} heading, but a write-up's headings start at ### (the page has the h1 and the "# write-up" h2 above it)`;
}

function imageProblem(line: number, what: string): string {
  return `line ${line}: the image ${what} has no alt text, so describe it in the brackets`;
}

/** The line with every code span blanked to spaces, so what is in one is never read as Markdown. */
function withoutCodeSpans(line: string): string {
  return line.replace(CODE_SPAN, (span) => " ".repeat(span.length));
}

/** The problems with images on one line, in the order they sit. */
function imageProblems(lineNumber: number, line: string): Found[] {
  const text = withoutCodeSpans(line);
  const found: Found[] = [];
  for (const m of text.matchAll(INLINE_IMAGE)) {
    if (m[1]!.trim() === "") {
      found.push({
        line: lineNumber,
        column: m.index,
        problem: imageProblem(lineNumber, m[2] || "(no address)"),
      });
    }
  }
  for (const m of text.matchAll(REFERENCE_IMAGE)) {
    if (m[1]!.trim() === "") {
      found.push({
        line: lineNumber,
        column: m.index,
        problem: imageProblem(lineNumber, `[${m[2]}]`),
      });
    }
  }
  for (const m of text.matchAll(HTML_IMAGE)) {
    const alt = ALT_ATTRIBUTE.exec(m[0]);
    const value = alt?.[1] ?? alt?.[2] ?? alt?.[3] ?? "";
    if (value.trim() === "") {
      found.push({
        line: lineNumber,
        column: m.index,
        problem: imageProblem(lineNumber, m[0]),
      });
    }
  }
  return found.sort((a, b) => a.column - b.column);
}

/**
 * What is wrong with a project's Markdown body, one message per problem, each with its line:
 *
 * - a `#` or `##` heading, because the page already has an h1 (the title) and an h2 ("# write-up"),
 *   so a write-up's own headings start at `###`;
 * - an image with empty alt text, because a diagram a reader cannot see must still be described.
 *
 * Fenced code is skipped, so a shell comment (`# install`) or a Markdown example is left alone, and
 * so are code spans.
 */
export function writeUpProblems(body: string): string[] {
  const found: Found[] = [];
  let fence: { marker: string; length: number } | undefined;
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
      previous = "";
      return;
    }
    const open = FENCE.exec(line);
    if (open) {
      fence = { marker: open[1]![0]!, length: open[1]!.length };
      previous = "";
      return;
    }

    const atx = ATX_HEADING.exec(line);
    if (atx) {
      found.push({
        line: number,
        column: 0,
        problem: headingProblem(number, line, atx[1]!.length as 1 | 2),
      });
    } else {
      const underline = SETEXT_UNDERLINE.exec(line);
      if (
        underline &&
        previous.trim() !== "" &&
        !BLOCK_START.test(previous) &&
        // Four spaces make a code block, which no underline can turn into a heading.
        !/^ {4}/.test(previous)
      ) {
        found.push({
          line: number,
          column: 0,
          problem: headingProblem(
            number - 1,
            previous,
            underline[1]![0] === "=" ? 1 : 2,
          ),
        });
      }
    }
    found.push(...imageProblems(number, line));
    previous = line;
  });

  return found
    .sort((a, b) => a.line - b.line || a.column - b.column)
    .map((f) => f.problem);
}
