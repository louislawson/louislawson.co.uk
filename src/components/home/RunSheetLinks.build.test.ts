import {
  existsSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  buildCopy,
  copyOfProject,
  removeCopies,
} from "../../__tests__/project-copy";

// The profile's one skill row is a placeholder with no runs, so a "seen in" link is built here
// from a copy of the project whose skill row is real and was seen in R01 and R04. R01 is made a
// placeholder project in the copy, and R04 is real, so the copy has one of each whatever the
// committed content is by then. The demo content exists only in the copy: nothing of it is ever
// committed.
afterAll(removeCopies);

/** The skills block of the profile, whatever it holds. */
const SKILLS_BLOCK = /\n {2}skills: \[[\s\S]*?\n {2}\],/;

const DEMO_SKILLS = `
  skills: [
    {
      group: "Demo platform skill",
      context: "A demo line for the link check.",
      tools: ["Azure"],
      runs: ["R01", "R04"],
    },
  ],`;

const DEMO_PLACEHOLDER_PROJECT = [
  "---",
  "code: R01",
  'title: "TODO: project title"',
  'summary: "TODO: one sentence on the result"',
  'headline: "TODO: a headline of two to five words"',
  'status: "TODO: status"',
  'period: "TODO: period"',
  "featured: false",
  "order: 1",
  "kind: work",
  'descriptor: "TODO: anonymised descriptor"',
  'setup: "TODO: where it started"',
  'change: "TODO: what you changed"',
  'result: "TODO: what is different now"',
  "stack:",
  '  - "TODO: tools used"',
  "---",
  "",
  "TODO: write the run sheet for this project.",
  "",
].join("\n");

interface Built {
  home: string;
  /** The project pages the build made, as their addresses. */
  pages: string[];
  dir: string;
}

function buildWithDemoSkill(deployContext: string): Built {
  const dir = copyOfProject(`run-sheet-links-${deployContext}-`);
  const profile = join(dir, "src", "data", "profile.ts");
  const source = readFileSync(profile, "utf-8");
  expect(source).toMatch(SKILLS_BLOCK);
  writeFileSync(profile, source.replace(SKILLS_BLOCK, DEMO_SKILLS));
  // Whichever file holds R01 now, the copy's R01 is the demo placeholder, under a name of its own.
  const folder = join(dir, "src", "content", "projects");
  // It keeps the flag of the file it replaces: exactly one project must be featured.
  let featured = "false";
  for (const name of readdirSync(folder)) {
    const text = name.endsWith(".md")
      ? readFileSync(join(folder, name), "utf-8")
      : "";
    if (/^code: R01$/m.test(text)) {
      featured = /^featured: (true|false)$/m.exec(text)?.[1] ?? featured;
      rmSync(join(folder, name));
    }
  }
  writeFileSync(
    join(folder, "r01-demo.md"),
    DEMO_PLACEHOLDER_PROJECT.replace(
      "featured: false",
      `featured: ${featured}`,
    ),
  );
  const output = buildCopy(dir, { DEPLOY_CONTEXT: deployContext });
  if (output !== "") throw new Error(`the build failed:\n${output}`);
  const pages = readdirSync(join(dir, "dist", "projects"))
    .filter((slug) =>
      existsSync(join(dir, "dist", "projects", slug, "index.html")),
    )
    .map((slug) => `/projects/${slug}/`);
  return {
    home: readFileSync(join(dir, "dist", "index.html"), "utf-8"),
    pages,
    dir,
  };
}

const anchors = (html: string) =>
  [...html.matchAll(/<a\b([^>]*)>(.*?)<\/a>/g)].map((m) => ({
    href: /\shref="([^"]*)"/.exec(m[1]!)?.[1],
    name: /\saria-label="([^"]*)"/.exec(m[1]!)?.[1],
    text: m[2]!.replace(/<[^>]+>/g, "").trim(),
  }));

const skillsSection = (html: string) =>
  /<section[^>]*\sid="skills"[\s\S]*?<\/section>/.exec(html)![0];

describe.each(["preview", "production"])(
  "a %s build with a skill seen in a placeholder project and a real one",
  (deployContext) => {
    let built: Built;
    beforeAll(() => {
      built = buildWithDemoSkill(deployContext);
    });

    it("links every project address on the home page to a page this build made", () => {
      const hrefs = [
        ...built.home.matchAll(/\shref="(\/projects\/[^"]*)"/g),
      ].map((m) => m[1]!);
      expect(hrefs.length).toBeGreaterThan(0);
      for (const href of hrefs) {
        expect(built.pages, `${href} has no page in this build`).toContain(
          href,
        );
      }
    });

    if (deployContext === "preview") {
      it("links both codes, the placeholder one by its hint, because its page exists in a preview", () => {
        const seen = anchors(skillsSection(built.home));
        expect(seen).toEqual([
          {
            href: "/projects/r01-demo/",
            name: "R01, project title",
            text: "R01",
          },
          {
            href: "/projects/this-website/",
            name: "R04, This website",
            text: "R04",
          },
        ]);
      });
    } else {
      it("shows only the real project's code, linked, because the placeholder one has no page", () => {
        const seen = anchors(skillsSection(built.home));
        expect(seen).toEqual([
          {
            href: "/projects/this-website/",
            name: "R04, This website",
            text: "R04",
          },
        ]);
        expect(skillsSection(built.home)).not.toContain("R01");
        expect(built.pages).toContain("/projects/this-website/");
        expect(built.pages).not.toContain("/projects/r01-demo/");
      });
    }

    it("has no inline style and uses no id twice", () => {
      expect(built.home).not.toMatch(/<[a-z][^>]*\sstyle\s*=/i);
      const ids = [...built.home.matchAll(/\sid="([^"]*)"/g)].map((m) => m[1]);
      expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([]);
    });
  },
);
