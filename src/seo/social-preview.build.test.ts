import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  buildCopy,
  copyOfProject,
  FIXTURE_PROJECTS,
  removeCopies,
  useFixtureProjects,
} from "../__tests__/project-copy";

// Real builds of a copy of the project, in each deploy context, checked as a crawler would see
// them: the tags in the pages, and the cards the tags point at. The site URL is one of the test's
// own, so an address is checked to come from it and not from a default. The demo values exist only
// in the copy: nothing of them is committed. Its projects are the fixtures, whatever projects are
// committed.
afterAll(removeCopies);

const SITE_URL = "https://example.test";
const DEMO_INTRO = "A demo introduction for the link preview.";
const DEMO_ROLE = "A demo role line";

interface Built {
  dir: string;
  read: (file: string) => string;
  /** The project pages the build made, by file name. */
  slugs: string[];
}

function build(
  label: string,
  env: Record<string, string>,
  edit?: (profile: string) => string,
): Built {
  const dir = copyOfProject(`social-preview-${label}-`);
  useFixtureProjects(dir);
  if (edit) {
    const path = join(dir, "src", "data", "profile.ts");
    writeFileSync(path, edit(readFileSync(path, "utf-8")));
  }
  const output = buildCopy(dir, { SITE_URL, ...env });
  if (output !== "") throw new Error(`the build failed:\n${output}`);
  const dist = join(dir, "dist");
  return {
    dir,
    read: (file) => readFileSync(join(dist, file), "utf-8"),
    slugs: readdirSync(join(dist, "projects")).filter((slug) =>
      existsSync(join(dist, "projects", slug, "index.html")),
    ),
  };
}

/** The content of the first meta tag with this name or property, as the page writes it. */
function meta(html: string, key: string): string | undefined {
  const tag = new RegExp(`<meta[^>]*\\b(?:name|property)="${key}"[^>]*>`).exec(
    html,
  )?.[0];
  return tag && /content="([^"]*)"/.exec(tag)?.[1];
}

const SHARING_TAGS = [
  "description",
  "og:title",
  "og:description",
  "og:image",
  "og:image:width",
  "og:image:height",
  "og:image:alt",
  "og:url",
  "og:type",
  "og:locale",
  "twitter:card",
  "twitter:image:alt",
];

/** A PNG's width and height, from its header. */
function pngSize(dir: string, path: string) {
  const bytes = readFileSync(join(dir, "dist", path));
  expect([...bytes.subarray(0, 8)], `${path} is not a PNG`).toEqual([
    137, 80, 78, 71, 13, 10, 26, 10,
  ]);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

let preview: Built;
let production: Built;
let demo: Built;

/**
 * The profile with its role line and intro set to the given values; a line that is not found is
 * an error. `\s*`: Prettier puts a long value on the line after its key, so real content may be
 * wrapped.
 */
function withRoleAndIntro(role: string, intro: string) {
  return (profile: string): string => {
    const edited = profile
      .replace(/^ {2}roleLine:\s*".*",$/m, `  roleLine: "${role}",`)
      .replace(/^ {2}intro:\s*".*",$/m, `  intro: "${intro}",`);
    expect(edited).toContain(`roleLine: "${role}"`);
    expect(edited).toContain(`intro: "${intro}"`);
    return edited;
  };
}

// The role line and intro are set in every copy, as placeholders or as demo values, so the tests
// keep both cases whatever the committed profile holds as Louis fills it in.
const withPlaceholders = withRoleAndIntro("TODO: role line", "TODO: intro");
const withDemoValues = withRoleAndIntro(DEMO_ROLE, DEMO_INTRO);

// Three builds in a row, each of which may take what buildCopy allows (55 s) on a cold runner, so
// the hook gets more than the 60 s every other hook has.
beforeAll(() => {
  preview = build("preview", { DEPLOY_CONTEXT: "preview" }, withPlaceholders);
  production = build(
    "production",
    { DEPLOY_CONTEXT: "production" },
    withPlaceholders,
  );
  demo = build("demo", { DEPLOY_CONTEXT: "production" }, withDemoValues);
}, 180_000);

describe.each([
  ["preview", () => preview],
  ["production", () => production],
])("the cards of a %s build", (_, built) => {
  it("has a 1200 × 630 PNG for the home page and one for each project page, and no other", () => {
    const { dir, slugs } = built();
    expect(slugs.length).toBeGreaterThan(0);
    expect(pngSize(dir, "og/home.png")).toEqual({ width: 1200, height: 630 });
    for (const slug of slugs) {
      expect(pngSize(dir, `og/projects/${slug}.png`)).toEqual({
        width: 1200,
        height: 630,
      });
    }
    expect(readdirSync(join(dir, "dist", "og", "projects")).sort()).toEqual(
      slugs.map((slug) => `${slug}.png`).sort(),
    );
  });

  it("is what every page's og:image points at, as a file the build made", () => {
    const { dir, read, slugs } = built();
    const pages = [
      "index.html",
      ...slugs.map((s) => `projects/${s}/index.html`),
    ];
    for (const page of pages) {
      const image = meta(read(page), "og:image");
      expect(image, `${page} has no og:image`).toMatch(
        new RegExp(`^${SITE_URL}/og/.+\\.png$`),
      );
      expect(existsSync(join(dir, "dist", image!.slice(SITE_URL.length)))).toBe(
        true,
      );
    }
  });
});

describe.each([
  ["preview", () => preview],
  ["production", () => production],
])("the meta tags of a %s build", (_, built) => {
  it("are on the home page, from the site URL", () => {
    const home = built().read("index.html");
    expect(meta(home, "og:title")).toBe("Louis Lawson");
    expect(meta(home, "og:url")).toBe(`${SITE_URL}/`);
    expect(meta(home, "og:image")).toBe(`${SITE_URL}/og/home.png`);
    expect(meta(home, "og:type")).toBe("website");
    expect(meta(home, "og:locale")).toBe("en_GB");
    expect(meta(home, "twitter:card")).toBe("summary_large_image");
    // The card shows the name alone (the role line is a placeholder), and so does its alt text.
    expect(meta(home, "og:image:alt")).toBe("Louis Lawson");
    expect(meta(home, "twitter:image:alt")).toBe("Louis Lawson");
  });

  it("say the size the card is, as the PNG's own header does", () => {
    const { dir, read, slugs } = built();
    const pages = [
      ["index.html", "og/home.png"],
      ...slugs.map((s) => [`projects/${s}/index.html`, `og/projects/${s}.png`]),
    ];
    for (const [page, card] of pages) {
      const size = pngSize(dir, card!);
      expect(meta(read(page!), "og:image:width")).toBe(String(size.width));
      expect(meta(read(page!), "og:image:height")).toBe(String(size.height));
    }
  });

  it("are on each project page, with its own address and card", () => {
    const { read, slugs } = built();
    for (const slug of slugs) {
      const page = read(`projects/${slug}/index.html`);
      expect(meta(page, "og:url")).toBe(`${SITE_URL}/projects/${slug}/`);
      expect(meta(page, "og:image")).toBe(
        `${SITE_URL}/og/projects/${slug}.png`,
      );
      expect(meta(page, "og:type")).toBe("article");
      expect(meta(page, "og:locale")).toBe("en_GB");
      expect(meta(page, "twitter:card")).toBe("summary_large_image");
      // The address is the canonical's.
      expect(page).toContain(
        `<link rel="canonical" href="${SITE_URL}/projects/${slug}/">`,
      );
    }
  });

  it("describe R04 by its summary, which is real", () => {
    const page = built().read("projects/this-website/index.html");
    const summary =
      /^summary: (.+)$/m.exec(
        readFileSync(join(FIXTURE_PROJECTS, "this-website.md"), "utf-8"),
      )?.[1] ?? "";
    expect(summary).not.toBe("");
    expect(meta(page, "description")).toBe(summary);
    expect(meta(page, "og:description")).toBe(summary);
    expect(meta(page, "og:title")).toBe("This website · Louis Lawson");
  });

  it("name R04's card by what is on it, in one line", () => {
    const page = built().read("projects/this-website/index.html");
    const source = readFileSync(
      join(FIXTURE_PROJECTS, "this-website.md"),
      "utf-8",
    );
    const field = (name: string) =>
      new RegExp(`^${name}: (.+)$`, "m").exec(source)?.[1] ?? "";
    const alt = `${field("code")} · ${field("title")} · ${field("headline")}`;
    expect(alt).toBe("R04 · This website · Pipeline-built, pipeline-deployed");
    expect(meta(page, "og:image:alt")).toBe(alt);
    expect(meta(page, "twitter:image:alt")).toBe(alt);
  });

  it("are not on the 404 page", () => {
    const html = built().read("404.html");
    for (const key of SHARING_TAGS) {
      expect(meta(html, key), `404.html has ${key}`).toBeUndefined();
    }
  });

  it("have no JSON-LD, and no inline script of any kind", () => {
    const { read, slugs } = built();
    for (const page of [
      "index.html",
      ...slugs.map((s) => `projects/${s}/index.html`),
    ]) {
      expect(read(page)).not.toContain("application/ld+json");
    }
  });

  it("have no TODO in any tag of any page", () => {
    const { read, slugs } = built();
    for (const page of [
      "index.html",
      ...slugs.map((s) => `projects/${s}/index.html`),
    ]) {
      for (const key of SHARING_TAGS) {
        expect(meta(read(page), key) ?? "").not.toMatch(/todo/i);
      }
    }
  });
});

describe("a placeholder never reaches a tag", () => {
  it("leaves the home description out while the intro is a placeholder, in a preview", () => {
    const home = preview.read("index.html");
    expect(meta(home, "description")).toBeUndefined();
    expect(meta(home, "og:description")).toBeUndefined();
    expect(meta(home, "og:title")).toBe("Louis Lawson");
  });

  it("leaves a preview's placeholder project without a description, but with its card and a title from its code", () => {
    const placeholder = preview.slugs.find((s) => s.startsWith("r01"));
    expect(placeholder).toBeDefined();
    const page = preview.read(`projects/${placeholder}/index.html`);
    expect(meta(page, "description")).toBeUndefined();
    expect(meta(page, "og:description")).toBeUndefined();
    expect(meta(page, "og:title")).toBe("R01 · Louis Lawson");
    // Only the code is on the card, so only the code is in its alt text.
    expect(meta(page, "og:image:alt")).toBe("R01");
    expect(meta(page, "twitter:image:alt")).toBe("R01");
    expect(meta(page, "og:image")).toBe(
      `${SITE_URL}/og/projects/${placeholder}.png`,
    );
  });
});

describe("a build whose intro and role line are real", () => {
  it("describes the home page with the intro", () => {
    const home = demo.read("index.html");
    expect(meta(home, "description")).toBe(DEMO_INTRO);
    expect(meta(home, "og:description")).toBe(DEMO_INTRO);
  });

  it("names the home card by the name and the role line", () => {
    const home = demo.read("index.html");
    expect(meta(home, "og:image:alt")).toBe(`Louis Lawson · ${DEMO_ROLE}`);
    expect(meta(home, "twitter:image:alt")).toBe(`Louis Lawson · ${DEMO_ROLE}`);
  });

  it("draws a different home card, with the role line on it", () => {
    const withRole = readFileSync(join(demo.dir, "dist", "og", "home.png"));
    const without = readFileSync(
      join(production.dir, "dist", "og", "home.png"),
    );
    expect(withRole.equals(without)).toBe(false);
  });
});
