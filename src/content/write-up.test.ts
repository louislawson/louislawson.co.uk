import { describe, expect, it } from "vitest";
import { writeUpProblems } from "./write-up";

const lines = (...parts: string[]) => parts.join("\n");

describe("writeUpProblems", () => {
  it("finds nothing in a write-up of ### headings, paragraphs, lists, code and images with a description", () => {
    expect(
      writeUpProblems(
        lines(
          "Some opening words.",
          "",
          "### Context",
          "",
          "- one",
          "- two",
          "",
          "#### A step down",
          "",
          "```sh",
          "npm run build",
          "```",
          "",
          "![The landing zone and its subscriptions](./diagrams/landing-zone.svg)",
          "",
          "The landing zone and how a new subscription is vended.",
        ),
      ),
    ).toEqual([]);
  });

  it("finds nothing in an empty body", () => {
    expect(writeUpProblems("")).toEqual([]);
  });

  describe("headings", () => {
    it("names a # heading and its line, because the page's h1 is the title", () => {
      const [problem, ...rest] = writeUpProblems(
        lines("Words.", "", "# Context", ""),
      );
      expect(rest).toEqual([]);
      expect(problem).toContain("line 3");
      expect(problem).toContain("# Context");
      expect(problem).toContain("###");
    });

    it("names a ## heading and its line, because the page's h2 is # write-up", () => {
      const [problem, ...rest] = writeUpProblems(
        lines("## What I built", "", "Words."),
      );
      expect(rest).toEqual([]);
      expect(problem).toContain("line 1");
      expect(problem).toContain("## What I built");
    });

    it("finds every one, not only the first", () => {
      expect(
        writeUpProblems(lines("## One", "", "### Fine", "", "## Two")),
      ).toHaveLength(2);
    });

    it("lets # and ## stand in a fenced code block, where they are a shell comment or a Markdown example", () => {
      expect(
        writeUpProblems(
          lines(
            "### Setup",
            "",
            "```sh",
            "# install",
            "## and build",
            "```",
            "",
            "~~~md",
            "# a heading in an example",
            "~~~",
          ),
        ),
      ).toEqual([]);
    });

    it("still finds a heading after a code block closes", () => {
      expect(
        writeUpProblems(
          lines("```", "# a comment", "```", "", "## A real heading"),
        ),
      ).toHaveLength(1);
    });

    it("keeps a fence open until its own marker closes it", () => {
      // A shorter fence inside a longer one is text, not the end of the block.
      expect(
        writeUpProblems(
          lines("````md", "```", "# still inside", "````", "", "## outside"),
        ),
      ).toHaveLength(1);
    });

    it("finds a heading indented up to three spaces and one closed with #s, and leaves a four-space code block alone", () => {
      expect(writeUpProblems("   ## Indented")).toHaveLength(1);
      expect(writeUpProblems("## Closed ##")).toHaveLength(1);
      expect(writeUpProblems("    ## code, not a heading")).toEqual([]);
    });

    it("finds a heading with nothing after the #s", () => {
      expect(writeUpProblems("##")).toHaveLength(1);
    });

    it("leaves a # that is not a heading alone: no space after it, or more than six", () => {
      expect(writeUpProblems("#hashtag and ##tag")).toEqual([]);
      expect(writeUpProblems("####### seven")).toEqual([]);
    });

    it("finds a setext heading, an underlined h1 or h2", () => {
      expect(writeUpProblems(lines("Context", "=======", ""))).toHaveLength(1);
      expect(writeUpProblems(lines("Context", "-------", ""))).toHaveLength(1);
    });

    it("leaves a thematic break alone", () => {
      expect(writeUpProblems(lines("Words.", "", "---", "", "More."))).toEqual(
        [],
      );
    });

    it("leaves a thematic break after a list item or a quote alone, even when the item runs onto a second line", () => {
      // The second line is a lazy continuation, which no underline turns into a heading.
      expect(
        writeUpProblems(lines("- item", "continued", "---", "", "More.")),
      ).toEqual([]);
      expect(
        writeUpProblems(lines("> quote", "continued", "---", "", "More.")),
      ).toEqual([]);
      expect(writeUpProblems(lines("1. item", "continued", "==="))).toEqual([]);
    });

    it("finds a heading inside a quote or a list item", () => {
      expect(writeUpProblems("> # Quoted")).toHaveLength(1);
      expect(writeUpProblems("> > ## Deeper")).toHaveLength(1);
      expect(writeUpProblems("- # Item")).toHaveLength(1);
      expect(writeUpProblems("1. ## Step")).toHaveLength(1);
      expect(writeUpProblems("- ### Fine")).toEqual([]);
    });

    it("finds a heading written as HTML, and leaves an h3 alone", () => {
      expect(writeUpProblems("<h1>Title</h1>")).toHaveLength(1);
      expect(writeUpProblems('Words <H2 id="x">Sub</H2>')).toHaveLength(1);
      expect(writeUpProblems("<h3>Fine</h3>")).toEqual([]);
      expect(writeUpProblems("<hr>")).toEqual([]);
    });

    it("says the line is the write-up's, counted from below the frontmatter", () => {
      const [problem] = writeUpProblems("## Context");
      expect(problem).toMatch(/^write-up line 1:/);
    });
  });

  describe("images", () => {
    it("names an image with empty alt text and its line", () => {
      const [problem, ...rest] = writeUpProblems(
        lines("Words.", "", "![](./diagrams/a.svg)"),
      );
      expect(rest).toEqual([]);
      expect(problem).toContain("line 3");
      expect(problem).toContain("./diagrams/a.svg");
      expect(problem).toMatch(/alt text/i);
    });

    it("counts alt text of spaces as empty", () => {
      expect(writeUpProblems("![   ](./diagrams/a.svg)")).toHaveLength(1);
    });

    it("finds an image that has a title but no alt text", () => {
      expect(writeUpProblems('![](./diagrams/a.svg "A title")')).toHaveLength(
        1,
      );
    });

    it("finds an empty-alt image in the middle of a line, and every one", () => {
      expect(
        writeUpProblems(
          "Before ![](./a.svg) between ![fine](./b.svg) after ![](./c.svg).",
        ),
      ).toHaveLength(2);
    });

    it("finds a reference-style image with empty alt text", () => {
      expect(
        writeUpProblems(lines("![][diagram]", "", "[diagram]: ./a.svg")),
      ).toHaveLength(1);
    });

    it("finds an <img> with no alt attribute or an empty one", () => {
      expect(writeUpProblems('<img src="./a.svg">')).toHaveLength(1);
      expect(writeUpProblems('<img src="./a.svg" alt="">')).toHaveLength(1);
      expect(writeUpProblems("<img src='./a.svg' alt=' '>")).toHaveLength(1);
      expect(writeUpProblems('<img alt="A diagram" src="./a.svg">')).toEqual(
        [],
      );
    });

    it("leaves a link and an image with alt text alone, brackets inside the text included", () => {
      expect(
        writeUpProblems(
          lines(
            "[a link](./a)",
            "![Stack [simplified] view](./a.svg)",
            "![Escaped \\] bracket](./a.svg)",
          ),
        ),
      ).toEqual([]);
    });

    it("lets an empty image stand in a code block or a code span, where it is text about Markdown", () => {
      expect(
        writeUpProblems(
          lines(
            "Write `![](x.svg)` and it fails.",
            "",
            "```md",
            "![](x.svg)",
            "```",
          ),
        ),
      ).toEqual([]);
    });
  });

  describe("images that run over more than one line, or hold code", () => {
    it("counts alt text that is only a code span as alt text", () => {
      expect(writeUpProblems("![`terraform plan`](./a.svg)")).toEqual([]);
    });

    it("still leaves an image inside a code span alone", () => {
      expect(writeUpProblems("Write `![](x.svg)` here.")).toEqual([]);
      expect(writeUpProblems("Write ``![](x.svg)`` here.")).toEqual([]);
    });

    it("finds an <img> whose attributes are on several lines, and names the line it starts on", () => {
      const [problem, ...rest] = writeUpProblems(
        lines("Words.", "", "<img", '  src="./a.svg"', '  alt="">'),
      );
      expect(rest).toEqual([]);
      expect(problem).toContain("line 3");
      expect(
        writeUpProblems(lines("<img", '  src="./a.svg"', '  alt="A diagram">')),
      ).toEqual([]);
    });

    it("reads alt text that wraps onto a second line, and finds one that is only a line break", () => {
      expect(
        writeUpProblems(lines("![A long", "description](./a.svg)")),
      ).toEqual([]);
      const [problem] = writeUpProblems(lines("Words.", "![", "](./a.svg)"));
      expect(problem).toContain("line 2");
    });
  });

  it("reports a heading and an image together, in the order they appear", () => {
    const found = writeUpProblems(lines("![](./a.svg)", "", "## Heading"));
    expect(found).toHaveLength(2);
    expect(found[0]).toMatch(/alt text/i);
    expect(found[1]).toContain("## Heading");
  });
});
