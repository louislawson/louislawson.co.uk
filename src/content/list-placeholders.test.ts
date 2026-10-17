import { describe, expect, it } from "vitest";
import {
  annotation,
  findPlaceholders,
  isContentFile,
  summary,
} from "./list-placeholders";

describe("isContentFile", () => {
  it("covers the Markdown and data files under src/content and the profile", () => {
    for (const path of [
      "src/content/projects/this-website.md",
      "src/content/projects/r01-placeholder.md",
      "src/content/notes/a.json",
      "src/data/profile.ts",
    ]) {
      expect(isContentFile(path), path).toBe(true);
    }
  });

  it("leaves out the code that implements the content model, and everything else", () => {
    for (const path of [
      "src/content/schema.ts",
      "src/content/projects/a.test.ts",
      "src/content/__fixtures__/content.ts",
      "src/data/profile.test.ts",
      "src/pages/index.astro",
      "docs/BUILD-PLAN.md",
      "README.md",
    ]) {
      expect(isContentFile(path), path).toBe(false);
    }
  });

  it("accepts Windows path separators", () => {
    expect(isContentFile("src\\content\\projects\\a.md")).toBe(true);
    expect(isContentFile("src\\content\\schema.ts")).toBe(false);
  });
});

describe("findPlaceholders", () => {
  it("lists each line with a TODO as file:line, counting from 1", () => {
    const source = [
      "---",
      'title: "TODO: project title"',
      "order: 1",
      "---",
      "",
      "TODO: write the run sheet.",
    ].join("\n");
    expect(
      findPlaceholders("src/content/projects/a.md", source).map(
        (hit) => `${hit.file}:${hit.line}`,
      ),
    ).toEqual(["src/content/projects/a.md:2", "src/content/projects/a.md:6"]);
  });

  it("keeps the trimmed line so a reader can see what is missing", () => {
    const [hit] = findPlaceholders("a.md", '  title: "TODO: project title"  ');
    expect(hit?.text).toBe('title: "TODO: project title"');
  });

  it("finds the partial forms the schemas and the body check also reject", () => {
    const source = ["still TODOs below", "todo write this"].join("\n");
    expect(findPlaceholders("a.md", source)).toHaveLength(2);
  });

  it("ignores words that merely contain it", () => {
    expect(
      findPlaceholders("a.md", "A Todoist board and autodoc output."),
    ).toEqual([]);
  });

  it("skips comment lines in TypeScript, which explain placeholders without being one", () => {
    const source = [
      "// Everything here is a TODO: placeholder until it is supplied.",
      "/**",
      " * TODO: not a value",
      " */",
      'intro: "TODO: a short introduction",',
    ].join("\n");
    expect(
      findPlaceholders("src/data/profile.ts", source).map((h) => h.line),
    ).toEqual([5]);
  });

  it("does not skip a Markdown list item that starts with an asterisk", () => {
    expect(findPlaceholders("a.md", "* TODO: write this")).toHaveLength(1);
  });

  it("finds a placeholder in a TypeScript value that has a trailing comment", () => {
    expect(
      findPlaceholders(
        "src/data/profile.ts",
        'region: "TODO: region", // here',
      ),
    ).toHaveLength(1);
  });
});

describe("annotation", () => {
  it("is one warning with the count", () => {
    const hits = findPlaceholders("a.md", "TODO: a\nTODO: b\nTODO: c");
    expect(annotation(hits)).toBe(
      "::warning title=Placeholders::3 placeholders remain in the content. The full list is in the job summary.",
    );
  });

  it("says placeholder, not placeholders, for one", () => {
    expect(annotation(findPlaceholders("a.md", "TODO: a"))).toContain(
      "1 placeholder remains",
    );
  });

  it("is nothing when there are none, so a clean pull request is quiet", () => {
    expect(annotation([])).toBeUndefined();
  });
});

describe("summary", () => {
  it("lists every placeholder as file:line with its text, and the count", () => {
    const hits = [
      ...findPlaceholders("src/content/projects/a.md", 'title: "TODO: title"'),
      ...findPlaceholders("src/data/profile.ts", "x\ny\nintro: 'TODO: intro'"),
    ];
    const text = summary(hits);
    expect(text).toContain("2 placeholders");
    expect(text).toContain("`src/content/projects/a.md:1`");
    expect(text).toContain("`src/data/profile.ts:3`");
    expect(text).toContain("TODO: title");
  });

  it("says so when there are none", () => {
    expect(summary([])).toContain("No placeholders");
  });

  it("keeps a line that contains pipes or backticks from breaking the table", () => {
    const text = summary(findPlaceholders("a.md", "TODO: a | b `c`"));
    expect(
      text.split("\n").filter((line) => line.startsWith("|")),
    ).toHaveLength(3);
    expect(text).not.toContain("a | b");
  });
});
