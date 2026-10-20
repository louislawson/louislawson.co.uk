import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  buildCopy,
  copyOfProject,
  removeCopies,
} from "../../__tests__/project-copy";

// The profile's one skill row is a placeholder with no runs, so a "seen in" link is built here
// from a copy of the project whose skill row is real and was seen in R01 (a placeholder project)
// and R04 (real). The demo row exists only in the copy: nothing of it is ever committed.
afterAll(removeCopies);

const SKILL_ROW = `  skills: [
    {
      group: "TODO: skill group",
      context: "TODO: one anonymised line on where you have used it",
      tools: ["TODO: tools"],
      runs: [],
    },
  ],`;

const DEMO_ROW = `  skills: [
    {
      group: "Demo platform skill",
      context: "A demo line for the link check.",
      tools: ["Azure"],
      runs: ["R01", "R04"],
    },
  ],`;

interface Built {
  home: string;
  /** The project pages the build made, as their addresses. */
  pages: string[];
  dir: string;
}

function buildWithDemoSkill(deployContext: string): Built {
  const dir = copyOfProject(`run-sheet-links-${deployContext}-`);
  const file = join(dir, "src", "data", "profile.ts");
  const source = readFileSync(file, "utf-8");
  expect(source).toContain(SKILL_ROW);
  writeFileSync(file, source.replace(SKILL_ROW, DEMO_ROW));
  const output = buildCopy(dir, { DEPLOY_CONTEXT: deployContext });
  if (output !== "") throw new Error(`the build failed:\n${output}`);
  const projects = join(dir, "dist", "projects");
  const pages = [
    "r01-placeholder",
    "r02-placeholder",
    "r03-placeholder",
    "this-website",
  ]
    .filter((slug) => existsSync(join(projects, slug, "index.html")))
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
        expect(
          existsSync(join(built.dir, "dist", href, "index.html")),
          href,
        ).toBe(true);
      }
    });

    if (deployContext === "preview") {
      it("links both codes, the placeholder one by its hint, because its page exists in a preview", () => {
        const seen = anchors(skillsSection(built.home));
        expect(seen).toEqual([
          {
            href: "/projects/r01-placeholder/",
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
        expect(built.pages).toEqual(["/projects/this-website/"]);
      });
    }

    it("has no inline style and uses no id twice", () => {
      expect(built.home).not.toMatch(/<[a-z][^>]*\sstyle\s*=/i);
      const ids = [...built.home.matchAll(/\sid="([^"]*)"/g)].map((m) => m[1]);
      expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([]);
    });
  },
);
