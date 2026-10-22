import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SECTION_INTROS } from "./components/home/section-intros";
import { INSPECT_LABELS, projectPageLabel } from "./components/inspect-labels";
import { ANALYTICS_TOKEN, parseDeployContext } from "./config/site";
import { isPlaceholder } from "./content/todo";
import { visibleProfile, visibleSections } from "./content/visibility";
import { profile } from "./data/profile";
import { FIRST_TICK, frame } from "./scripts/wheel";

// Runs the real Astro build once per deploy context and checks what a deployment would serve.
const astro = join(process.cwd(), "node_modules", "astro", "bin", "astro.mjs");
const outDirs: string[] = [];

function build(env: Record<string, string>): string {
  const outDir = mkdtempSync(join(tmpdir(), "site-build-"));
  outDirs.push(outDir);
  execFileSync(process.execPath, [astro, "build", "--outDir", outDir], {
    // The build info is the deploy workflow's, so a test build starts without it, as a local one.
    env: {
      ...process.env,
      DEPLOY_CONTEXT: "",
      SITE_URL: "",
      BUILD_NUMBER: "",
      GIT_SHA: "",
      ...env,
    },
    stdio: "pipe",
  });
  return outDir;
}

function read(dir: string, file: string): string {
  return readFileSync(join(dir, file), "utf-8");
}

afterAll(() => {
  for (const dir of outDirs) rmSync(dir, { recursive: true, force: true });
});

/** The file names directly inside one folder of a build. */
function listing(dir: string, folder: string): string[] {
  return readdirSync(join(dir, folder));
}

/** The project pages of a build, as the files they are: `projects/<file name>/index.html`. */
function projectPages(dir: string): string[] {
  return listing(dir, "projects")
    .sort()
    .map((slug) => `projects/${slug}/index.html`);
}

/** Every page and stylesheet of a build: what the content security policy applies to. */
function pagesAndStyles(dir: string): Record<string, string> {
  const files: Record<string, string> = {};
  for (const page of ["index.html", "404.html", ...projectPages(dir)]) {
    files[page] = read(dir, page);
  }
  for (const name of listing(dir, "_astro")) {
    if (name.endsWith(".css"))
      files[`_astro/${name}`] = read(dir, `_astro/${name}`);
  }
  return files;
}

/** All the stylesheets of a build as one text. */
function stylesheetText(dir: string): string {
  return Object.entries(pagesAndStyles(dir))
    .filter(([name]) => name.endsWith(".css"))
    .map(([, text]) => text)
    .join("\n");
}

// What the content security policy refuses is a style attribute in a tag, and a data: URL where a
// URL is expected. The checks look for those, not for the words in prose or in an attribute value.
const STYLE_ATTRIBUTE = /<[a-z][^>]*\sstyle\s*=/i;
const DATA_URL =
  /(?:url\(\s*|\b(?:src|href|srcset|poster|action)\s*=\s*)["']?data:/i;
// A request for something the page needs to render: a stylesheet or font in a link, or a CSS
// import or url(). A link to another site (an anchor, a canonical URL) is not one.
const EXTERNAL_RESOURCE =
  /<link\b[^>]*\brel="(?:stylesheet|preload|preconnect|dns-prefetch|prefetch|modulepreload)"[^>]*\bhref="https?:\/\/|<link\b[^>]*\bhref="https?:\/\/[^>]*\brel="(?:stylesheet|preload|preconnect|dns-prefetch|prefetch|modulepreload)"|(?:@import\s+(?:url\()?|url\(\s*)["']?https?:\/\//i;

/** The words of a text or of HTML, lower case: the tags and entities are not words. */
function words(text: string): string[] {
  return (
    text
      .toLowerCase()
      .replace(/<[^>]+>/g, " ")
      .replace(/&[a-z#0-9]+;/g, " ")
      .match(/[a-z0-9]+/g) ?? []
  );
}

/** Every run of eight words, as a set. */
function wordRuns(list: string[], size = 8): Set<string> {
  const runs = new Set<string>();
  for (let i = 0; i + size <= list.length; i++) {
    runs.add(list.slice(i, i + size).join(" "));
  }
  return runs;
}

/**
 * The text with each of these pieces of wording removed where a line of the document gives it, in
 * quotes, as the section's own (the line says "label", or is an "Inspect:" or "Intro:" bullet):
 * the wording the document approves. Wording quoted anywhere else is left in.
 */
function withoutApprovedLabels(text: string, labels: string[]): string {
  return text
    .split("\n")
    .map((line) =>
      /\blabel\b|\*\*(?:Inspect|Intro):\*\*/i.test(line)
        ? labels.reduce(
            (rest, label) => rest.split(`"${label}"`).join(" "),
            // Markdown escapes a * or an _ with a backslash, which the page's text does not have.
            line.replace(/\\([*_`])/g, "$1"),
          )
        : line,
    )
    .join("\n");
}

/**
 * Whether a script reads the address of the page: `location`, a path, and with `host` also the
 * host name. The one use of the word that is no read is the value of aria-current, which is
 * allowed as that exact call and nothing wider: `window["location"]` names the word in a string
 * too, and is a read.
 */
function readsAddress(code: string, options: { host: boolean }): boolean {
  const withoutStrings = code.replace(
    /setAttribute\(\s*(["'`])aria-current\1\s*,\s*(["'`])location\2\s*\)/g,
    "",
  );
  return (
    options.host ? /location|pathname|hostname/ : /location|pathname/
  ).test(withoutStrings);
}

describe("the check for a script that reads the address", () => {
  it("finds a read of the location, the path and (when asked) the host", () => {
    expect(readsAddress("a=location.href", { host: false })).toBe(true);
    expect(readsAddress("a=window.location", { host: false })).toBe(true);
    expect(readsAddress("a=u.pathname", { host: false })).toBe(true);
    expect(readsAddress("a=u.hostname", { host: false })).toBe(false);
    expect(readsAddress("a=u.hostname", { host: true })).toBe(true);
  });

  it("leaves aria-current's value alone, the one string that is the word and no read", () => {
    const code = 'e.setAttribute("aria-current","location")';
    expect(readsAddress(code, { host: true })).toBe(false);
    expect(
      readsAddress("e.setAttribute( 'aria-current' , 'location' )", {
        host: true,
      }),
    ).toBe(false);
    // But not when a read is next to it.
    expect(readsAddress(`${code};x=location.search`, { host: true })).toBe(
      true,
    );
  });

  it("still finds a read made through a string: bracket access names the word too", () => {
    expect(readsAddress('a=window["location"].href', { host: false })).toBe(
      true,
    );
    expect(readsAddress("a=self['location'].pathname", { host: false })).toBe(
      true,
    );
    expect(readsAddress("e.setAttribute('a','location')", { host: true })).toBe(
      true,
    );
  });
});

describe("the check for copied text", () => {
  it("lets a label through only where the document quotes it as approved wording", () => {
    const label = "h1 · Martian Mono 800 · static HTML, no JavaScript";
    const approved = `The label is "${label}".\nAnother line follows.`;
    expect(withoutApprovedLabels(approved, [label])).not.toContain("Martian");
    expect(withoutApprovedLabels(approved, [label])).toContain("Another line");
    expect(
      withoutApprovedLabels(`- **Inspect:** "${label}"`, [label]),
    ).not.toContain("Martian");
    // The same words in running prose, not in quotes, are still counted.
    const prose = `It says ${label} here.`;
    expect(withoutApprovedLabels(prose, [label])).toContain("Martian");
    // A label the document writes with Markdown escapes is the same label.
    const escaped = '- **Inspect:** "from src/content/projects/\\*.md", pinned';
    expect(
      withoutApprovedLabels(escaped, ["from src/content/projects/*.md"]),
    ).not.toContain("projects");
    // A section's intro line is approved the same way, on the "Intro:" bullet.
    const intro = "Each one written up as setup, change and result.";
    expect(
      withoutApprovedLabels(`- **Intro:** "${intro}"`, [intro]),
    ).not.toContain("written");
    expect(
      withoutApprovedLabels(`Copy this sentence: "${intro}"`, [intro]),
    ).toContain("written");
    // A quotation on a line that is not giving the label is still counted.
    const elsewhere = `Copy this sentence: "${label}"`;
    expect(withoutApprovedLabels(elsewhere, [label])).toContain("Martian");
    // And a label the document does not quote is left alone.
    expect(withoutApprovedLabels(approved, ["something else"])).toContain(
      "Martian",
    );
  });

  it("finds a sentence that was copied, and leaves different words alone", () => {
    const source = wordRuns(
      words(
        "A working console, not a portfolio template: the site shows its own workings.",
      ),
    );
    const copied = wordRuns(
      words(
        "<p>It is a working console, not a portfolio template: the site shows</p>",
      ),
    );
    expect([...copied].some((run) => source.has(run))).toBe(true);
    const own = wordRuns(
      words(
        "Plain links, one per section with content, and a script that adds the menu.",
      ),
    );
    expect([...own].some((run) => source.has(run))).toBe(false);
  });
});

describe("the checks on a build", () => {
  it("flag a style attribute, a data: URL and an external resource", () => {
    expect('<p style="color:red">x</p>').toMatch(STYLE_ATTRIBUTE);
    expect('<p class="a" style = "x">x</p>').toMatch(STYLE_ATTRIBUTE);
    expect("a{background:url(data:image/png;base64,AAAA)}").toMatch(DATA_URL);
    expect('<img src="data:image/png;base64,AAAA">').toMatch(DATA_URL);
    expect(
      '<link rel="stylesheet" href="https://fonts.googleapis.com/css2">',
    ).toMatch(EXTERNAL_RESOURCE);
    expect('<link href="https://fonts.gstatic.com" rel="preconnect">').toMatch(
      EXTERNAL_RESOURCE,
    );
    expect('@import url("https://example.com/a.css");').toMatch(
      EXTERNAL_RESOURCE,
    );
    expect("src:url(https://example.com/a.woff2)").toMatch(EXTERNAL_RESOURCE);
  });

  it("leave prose, ordinary links and the site's own files alone", () => {
    const page =
      '<p>data: this is prose, and so is style = this</p><a href="https://github.com/louislawson/louislawson.co.uk">source</a><link rel="canonical" href="https://louislawson.co.uk/"><link rel="preload" href="/_astro/a.woff2" as="font"><link rel="stylesheet" href="/_astro/a.css"><div data-style="x" aria-label="style">y</div>';
    expect(page).not.toMatch(STYLE_ATTRIBUTE);
    expect(page).not.toMatch(DATA_URL);
    expect(page).not.toMatch(EXTERNAL_RESOURCE);
    expect("src:url(a.woff2) format('woff2')").not.toMatch(EXTERNAL_RESOURCE);
  });
});

describe.each(["preview", "production"])("a %s build", (deployContext) => {
  let dir = "";
  beforeAll(() => {
    dir = build({ DEPLOY_CONTEXT: deployContext });
  });

  it("sends noindex in the generated config while the site is not launched", () => {
    const config = JSON.parse(read(dir, "staticwebapp.config.json"));
    expect(config.globalHeaders["X-Robots-Tag"]).toBe("noindex");
  });

  it("keeps the baseline security headers in the generated config", () => {
    const config = JSON.parse(read(dir, "staticwebapp.config.json"));
    expect(config.globalHeaders["Content-Security-Policy"]).toContain(
      "default-src 'self'",
    );
    expect(config.responseOverrides["404"].rewrite).toBe("/404.html");
  });

  it("requires Trusted Types for scripts in the policy, and allows no policy to create them", () => {
    const config = JSON.parse(read(dir, "staticwebapp.config.json"));
    const csp = config.globalHeaders["Content-Security-Policy"];
    expect(csp).toContain("require-trusted-types-for 'script'");
    expect(csp).toContain("trusted-types 'none'");
  });

  it.each(["index.html", "404.html"])(
    deployContext === "production"
      ? "loads Cloudflare's analytics beacon in %s, and the policy lets it"
      : "loads no analytics beacon in %s, and the policy has no room for one",
    (page) => {
      const html = read(dir, page);
      const csp = JSON.parse(read(dir, "staticwebapp.config.json"))
        .globalHeaders["Content-Security-Policy"] as string;
      const beacons = [
        ...html.matchAll(/<script\b[^>]*cloudflareinsights[^>]*>/g),
      ];
      if (deployContext !== "production") {
        expect(html).not.toContain("cloudflareinsights");
        expect(html).not.toContain("data-cf-beacon");
        expect(csp).not.toContain("cloudflareinsights");
        expect(csp).not.toMatch(/script-src|connect-src/);
        return;
      }
      expect(beacons).toHaveLength(1);
      const tag = beacons[0]![0];
      expect(tag).toContain('type="module"');
      expect(tag).toContain(
        'src="https://static.cloudflareinsights.com/beacon.min.js"',
      );
      // Cloudflare changes the beacon without versioning it, so an integrity hash would break it.
      expect(tag).not.toContain("integrity");
      const token = /data-cf-beacon=(["'])(.*?)\1/.exec(tag)?.[2] ?? "";
      expect(
        JSON.parse(token.replaceAll("&#34;", '"').replaceAll("&quot;", '"')),
      ).toEqual({
        token: ANALYTICS_TOKEN,
      });
      expect(csp).toContain(
        "script-src 'self' https://static.cloudflareinsights.com",
      );
      expect(csp).toContain(
        "connect-src 'self' https://cloudflareinsights.com",
      );
    },
  );

  it("puts a noindex meta tag in the pages", () => {
    expect(read(dir, "index.html")).toContain(
      '<meta name="robots" content="noindex">',
    );
    expect(read(dir, "404.html")).toContain(
      '<meta name="robots" content="noindex">',
    );
  });

  it("inlines no stylesheet or script, which the content security policy would block", () => {
    for (const page of ["index.html", "404.html"]) {
      const html = read(dir, page);
      expect(html).not.toMatch(/<style[\s>]/);
      expect(html).not.toMatch(/<script(?![^>]*\ssrc=)[^>]*>/);
    }
  });

  it("has no style attribute and no data: URL in a page or a stylesheet", () => {
    const files = pagesAndStyles(dir);
    expect(Object.keys(files).some((name) => name.endsWith(".css"))).toBe(true);
    for (const [name, text] of Object.entries(files)) {
      expect(text, name).not.toMatch(STYLE_ATTRIBUTE);
      expect(text, name).not.toMatch(DATA_URL);
    }
  });

  it("makes no external font or stylesheet request", () => {
    for (const [name, text] of Object.entries(pagesAndStyles(dir))) {
      expect(text, name).not.toMatch(EXTERNAL_RESOURCE);
      expect(text, name).not.toMatch(/fonts\.(googleapis|gstatic)\.com/);
    }
  });

  it("serves Martian Mono from the site and preloads the Latin file the page needs", () => {
    const css = stylesheetText(dir);
    expect(css).toContain("Martian Mono Variable");

    const html = read(dir, "index.html");
    const preload = /<link rel="preload"[^>]*>/.exec(html)?.[0] ?? "";
    expect(preload).toContain('as="font"');
    expect(preload).toContain('type="font/woff2"');
    // A font preload without crossorigin is fetched twice, because font requests are CORS-mode.
    expect(preload).toContain("crossorigin");

    const href = /href="([^"]+)"/.exec(preload)?.[1] ?? "";
    expect(href).toMatch(
      /^\/_astro\/martian-mono-latin-wdth-normal\.[\w-]+\.woff2$/,
    );
    // The preload names the very file the stylesheet loads, so it is used, not just fetched.
    expect(css).toContain(href.replace("/_astro/", ""));
    expect(listing(dir, "_astro")).toContain(href.replace("/_astro/", ""));
  });

  it("ships the visually hidden class in the stylesheet every page loads", () => {
    // The placeholder label, the skip link and the key hints rely on it, so a layout that stopped
    // importing global.css would show that text to everyone.
    const css = stylesheetText(dir);
    const hidden = /\.vh\{([^}]*)\}/.exec(css)?.[1] ?? "";
    for (const declaration of [
      "position:absolute",
      "width:1px",
      "height:1px",
      "margin:-1px",
      "overflow:hidden",
      "clip-path:inset(50%)",
    ]) {
      expect(hidden).toContain(declaration);
    }
    expect(read(dir, "index.html")).toContain(
      `href="/_astro/${listing(dir, "_astro").find((name) => name.startsWith("Base.") && name.endsWith(".css"))}"`,
    );
  });

  it("gives the home page a canonical URL on the site URL, and the 404 page none", () => {
    expect(read(dir, "index.html")).toContain(
      '<link rel="canonical" href="https://louislawson.co.uk/">',
    );
    expect(read(dir, "404.html")).not.toContain('rel="canonical"');
  });

  it.each(["index.html", "404.html"])(
    "starts %s with a skip link to <main>, and ends it with the footer",
    (page) => {
      const html = read(dir, page);
      // Both pages go through the layout, so both are in British English.
      expect(html).toMatch(/<html lang="en-GB"/);
      expect(html).toMatch(
        /<body[^>]*>\s*<a class="vh skip" href="#main">Skip to content<\/a>/,
      );
      expect(html).toMatch(/<main id="main" tabindex="-1"/);
      expect(html.indexOf("<main")).toBeLessThan(html.indexOf("<footer"));
      // "load-time" is kept whole by a span, so the words are read with the tags taken out.
      expect(html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ")).toContain(
        "no cookies · anonymous visit and load-time stats",
      );
      expect(html).toContain("source on GitHub");
    },
  );

  it("shows the date of the last commit in the footer, as git writes it", () => {
    const expected = execFileSync("git", ["log", "-1", "--format=%cs"], {
      encoding: "utf-8",
    }).trim();
    expect(expected).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(read(dir, "index.html")).toContain(`updated ${expected}`);
  });

  it("serves every script as a file, not inline, and none of them reads the address", () => {
    for (const page of ["index.html", "404.html"]) {
      const html = read(dir, page);
      // The site's own scripts: files on the site, so not Cloudflare's beacon, which has its own test.
      const scripts = [...html.matchAll(/<script[^>]*\ssrc="(\/[^"]+)"/g)].map(
        (match) => match[1]!,
      );
      expect(scripts.length, page).toBeGreaterThan(1);
      const code = scripts.map((src) => read(dir, src.replace(/^\//, "")));
      // Between them they hold the switch's storage key.
      expect(code.join("\n"), page).toContain("keyboard-shortcuts");
      for (const [index, text] of code.entries()) {
        // The 404 page is served for any address and shows none of it: not the path, and no
        // script of it reads the host either. The home page's trace names the host it was
        // fetched from ("DNS lookup for …"), and that is the only part of the address any script
        // of it reads.
        expect(
          readsAddress(text, { host: page === "404.html" }),
          scripts[index],
        ).toBe(false);
      }
    }
  });

  it.each(["index.html", "404.html"])(
    "loads the saved shortcut choice in the head of %s before the stylesheet, as a hashed classic script",
    (page) => {
      const html = read(dir, page);
      const head = html.slice(html.indexOf("<head"), html.indexOf("</head>"));
      const tag = /<script\b[^>]*>/.exec(head)?.[0] ?? "";
      const src = /\ssrc="(\/_astro\/shortcuts-state\.[\w-]+\.js)"/.exec(
        tag,
      )?.[1];
      expect(src, `no head script in ${page}`).toBeDefined();
      // Blocks rendering, runs before anything shows, and is not a module.
      expect(tag).not.toMatch(/\s(async|defer)\b/);
      expect(tag).not.toMatch(/type="module"/);
      // Before the stylesheet's link, so it is not held back waiting for the CSS.
      expect(head.indexOf("<script")).toBeLessThan(
        head.indexOf('<link rel="stylesheet"'),
      );
      // A hashed file under /_astro/, which the baseline config caches for a year.
      const code = read(dir, src!.replace(/^\//, ""));
      expect(code).toContain("keyboard-shortcuts");
      expect(code).toContain("shortcuts");
      expect(code.length).toBeLessThan(600);
    },
  );

  it.each(["index.html", "404.html"])(
    "has the navigation in %s: the way home, and a link for each section shown, from 1",
    (page) => {
      const html = read(dir, page);
      const header = /<header class="nav"[\s\S]*?<\/header>/.exec(html)?.[0];
      expect(header, `no navigation in ${page}`).toBeDefined();
      expect(header).toMatch(/<a class="nav__home" href="\/"/);
      const links = [
        ...header!.matchAll(/<a href="(\/#[^"]+)" data-number="(\d+)"/g),
      ].map((m) => [m[1], Number(m[2])] as const);
      // Numbered 1 to n with no gap, as the sections are.
      expect(links.map(([, number]) => number)).toEqual(
        links.map((_, index) => index + 1),
      );
      if (deployContext === "preview") {
        expect(links.map(([href]) => href)).toEqual([
          "/#projects",
          "/#skills",
          "/#certifications",
          "/#garage",
          "/#contact",
        ]);
      } else {
        // Production shows only what is real: at least the projects and the contact details.
        expect(links.map(([href]) => href)).toContain("/#projects");
        expect(links.map(([href]) => href)).toContain("/#contact");
      }
    },
  );

  it("marks only the home page for the current-section highlight", () => {
    expect(read(dir, "index.html")).toMatch(/<header[^>]*\sdata-home/);
    expect(read(dir, "404.html")).not.toMatch(/<header[^>]*\sdata-home/);
  });

  // The certifications this build shows follow the real profile (a preview shows all of them,
  // production the ones that are real), so correct content cannot fail the checks on them: they
  // test that the page agrees with the rule, which visibility.test.ts tests itself.
  const shownCerts = visibleProfile(
    profile,
    new Set(),
    parseDeployContext(deployContext),
  ).certifications;

  // The home page's labelled parts: the bar, the footer, the hero, the trace and the projects, and
  // the skills and the certifications where each section is shown. A preview always shows them.
  // Production shows the skills once a skill row or an item to explore is real, and the
  // certifications once one is, and that follows the real profile, so it is worked out from the
  // profile and not fixed: correct content must not fail this test.
  const skillsShown =
    deployContext === "preview" ||
    visibleSections(
      [{}],
      visibleProfile(profile, new Set(), "production"),
    ).some((section) => section.id === "skills");
  const shownGarage = visibleProfile(
    profile,
    new Set(),
    parseDeployContext(deployContext),
  ).garage;
  const shownProfile = visibleProfile(
    profile,
    new Set(),
    parseDeployContext(deployContext),
  );
  // The contact section is there while something in it is real (the email is), in either context.
  const contactShown = visibleSections([{}], shownProfile).some(
    (section) => section.id === "contact",
  );
  const homeLabels =
    5 +
    (skillsShown ? 1 : 0) +
    (shownCerts.length > 0 ? 1 : 0) +
    (shownGarage.length > 0 ? 1 : 0) +
    (contactShown ? 1 : 0);

  it.each([
    ["index.html", homeLabels],
    ["404.html", 3],
  ])(
    "labels only whole parts in %s, %i of them, each with a registered label",
    (page, count) => {
      const html = read(dir, page);
      const labels = [...html.matchAll(/\sdata-inspect="([^"]*)"/g)].map(
        (m) => m[1],
      );
      // Section-level only: the bar, the footer, and the content: on the home page the sections
      // built so far, on the 404 page its content. Never per element.
      expect(labels).toHaveLength(count);
      for (const label of labels) {
        expect(Object.values(INSPECT_LABELS), label).toContain(label);
      }
    },
  );

  it.each(["index.html", "404.html"])(
    "has the inspect button and its live note in %s",
    (page) => {
      const html = read(dir, page);
      expect(html).toMatch(
        /<button[^>]*data-inspect-toggle[^>]*aria-pressed="false"|<button[^>]*aria-pressed="false"[^>]*data-inspect-toggle/,
      );
      const note = /<div[^>]*data-inspect-note[^>]*>/.exec(html)?.[0] ?? "";
      expect(note).toContain('role="status"');
      expect(note).toContain('aria-live="polite"');
      // A status, not a landmark: nothing for a list of landmarks to find.
      expect(html).not.toContain("<aside");
    },
  );

  it("styles a label only under body.inspecting, so a visitor never sees one", () => {
    const rules =
      stylesheetText(dir).match(/[^{}]*\[data-inspect[^{}]*\{/g) ?? [];
    expect(rules.length).toBeGreaterThan(0);
    for (const rule of rules) expect(rule).toContain("body.inspecting");
  });

  it("makes room for the first content's label with one rule on <main>, only in inspect mode", () => {
    // The label of content that starts under the sticky bar would sit behind the bar, so inspect
    // mode moves every page's content down, with one rule and not one per page. A visitor who has
    // not asked for inspect mode sees no change.
    const css = stylesheetText(dir);
    const rules = [...css.matchAll(/([^{}]*\bmain\b[^{}]*)\{([^}]*)\}/g)].map(
      ([, selector, body]) => ({ selector: selector!, body: body! }),
    );
    const room = rules.filter((r) => /padding-top|margin-top/.test(r.body));
    expect(room).toHaveLength(1);
    expect(room[0]!.selector.trim()).toBe("body.inspecting main");
    // No page makes the room itself.
    expect(css).not.toMatch(/\.notfound[^{}]*\{[^}]*margin-top/);
  });

  it("has the trace panel in the hero of the home page only, in a preview and in production alike", () => {
    const html = read(dir, "index.html");
    const hero = /<section class="wrap hero"[\s\S]*?<\/section>/.exec(
      html,
    )?.[0];
    expect(hero, "no hero").toBeDefined();
    // The right-hand column of the hero, after the name and the text.
    const side =
      /<div class="hero__side"[^>]*>([\s\S]*?)<\/div>\s*<\/section>/.exec(
        hero!,
      )?.[1];
    expect(side, "no trace column").toBeDefined();
    expect(side).toMatch(/<figure class="trace"[^>]*\sdata-trace\b/);
    expect(side).toContain("how this page reached you");
    // Without JavaScript the panel says the timings need it, and shows no empty values.
    expect(side).toMatch(/data-trace-nojs[^>]*>\s*These timings are measured/);
    expect(side).toMatch(/data-trace-hops[^>]*\shidden/);
    // A build with no build info is a local one.
    expect(side).toContain("local build");
    expect(read(dir, "404.html")).not.toContain("data-trace");
  });

  it("serves the trace's script as a file that reads the timings and the host, and only on the home page", () => {
    const scriptsOf = (page: string) =>
      [...read(dir, page).matchAll(/<script[^>]*\ssrc="(\/[^"]+)"/g)].map(
        (match) => read(dir, match[1]!.replace(/^\//, "")),
      );
    const trace = scriptsOf("index.html").filter((code) =>
      code.includes("largest-contentful-paint"),
    );
    expect(trace).toHaveLength(1);
    expect(trace[0]).toContain("navigation");
    expect(trace[0]).toContain("hostname");
    // Its styles are set through the CSSOM, which the policy allows: never as a style attribute.
    expect(trace[0]).toContain("setProperty");
    expect(trace[0]).not.toMatch(/setAttribute\(\s*["']style["']|cssText/);
    expect(scriptsOf("404.html").join("\n")).not.toContain(
      "largest-contentful-paint",
    );
  });

  it("has the projects section the navigation links to, in the page's own order after the hero", () => {
    const html = read(dir, "index.html");
    expect(html).toMatch(/<section[^>]*\sid="projects"/);
    expect(html.indexOf('id="name"')).toBeLessThan(
      html.indexOf('id="projects"'),
    );
    expect(html.indexOf('id="projects"')).toBeLessThan(html.indexOf("<footer"));
    // The nav's link goes to it.
    expect(html).toContain('href="/#projects"');
  });

  it("links each project entry, and only the entries, to its run sheet, with a name that says so", () => {
    const section = /<section[^>]*\sid="projects"[\s\S]*?<\/section>/.exec(
      read(dir, "index.html"),
    )![0];
    const entries = section.split('<li class="run').slice(1);
    const links = [...section.matchAll(/<a\b([^>]*)>(.*?)<\/a>/g)];
    // One link per entry, and nothing else in the section is a link.
    expect(links).toHaveLength(entries.length);
    entries.forEach((entry, index) => {
      expect(entry.match(/<a\b/g), `entry ${index}`).toHaveLength(1);
      expect(entry, `entry ${index}`).toMatch(
        /<a\b[^>]*class="hit"[^>]*href="\/projects\/[a-z0-9-]+\/"/,
      );
    });
    const names = links.map((m) =>
      m[2]!
        .replace(/<[^>]+>/g, "")
        .replace(/\s+/g, " ")
        .trim(),
    );
    for (const name of names) {
      expect(name).toMatch(/^Read the run sheet: \S/);
      // A hatched placeholder title is named by its hint, never by the prefix.
      expect(name).not.toContain("TODO");
    }
    if (deployContext === "preview") {
      expect(links.map((m) => /href="([^"]*)"/.exec(m[1]!)?.[1])).toEqual([
        "/projects/r01-placeholder/",
        "/projects/r02-placeholder/",
        "/projects/r03-placeholder/",
        "/projects/this-website/",
      ]);
      expect(names[0]).toBe("Read the run sheet: project title");
      expect(names[3]).toBe("Read the run sheet: This website");
    } else {
      expect(names).toEqual(["Read the run sheet: This website"]);
      expect(section).toContain("read the run sheet");
    }
  });

  it("links to no project page that this build did not make", () => {
    const html = read(dir, "index.html");
    const hrefs = [...html.matchAll(/\shref="(\/projects\/[^"]*)"/g)].map(
      (m) => m[1]!,
    );
    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) {
      expect(href, href).toMatch(/^\/projects\/[a-z0-9-]+\/$/);
      expect(
        existsSync(join(dir, href, "index.html")),
        `${href} has no page in this build`,
      ).toBe(true);
    }
  });

  if (deployContext === "preview") {
    it("shows every project in a preview, as compact rows, with the placeholders hatched and the featured tag on R01", () => {
      const html = read(dir, "index.html");
      const section = /<section[^>]*\sid="projects"[\s\S]*?<\/section>/.exec(
        html,
      )![0];
      // R01 to R03 are placeholders and R04 is real: four projects is where rows begin.
      expect(section).toContain("runs--row");
      expect(section).not.toContain("runs--strip");
      expect(
        [...section.matchAll(/class="run__code"[^>]*>(R\d\d)</g)].map(
          (m) => m[1],
        ),
      ).toEqual(["R01", "R02", "R03", "R04"]);
      expect(section).toMatch(/class="ph"/);
      expect(section).toContain(">(04)<");
      // Only R01 is featured, so the tag is on its row alone.
      expect(section.match(/class="tag"/g)).toHaveLength(1);
      expect(section.split('<li class="run')[1]).toContain('class="tag"');
    });
  } else {
    it("shows R04 alone on production, as a strip, with no placeholder and no featured tag", () => {
      const html = read(dir, "index.html");
      const section = /<section[^>]*\sid="projects"[\s\S]*?<\/section>/.exec(
        html,
      )![0];
      expect(section).toContain("runs--strip");
      expect(section).not.toContain("runs--row");
      expect(section.match(/<li class="run /g)).toHaveLength(1);
      expect(
        [...section.matchAll(/class="run__code"[^>]*>(R\d\d)</g)].map(
          (m) => m[1],
        ),
      ).toEqual(["R04"]);
      expect(section).toContain(">(01)<");
      expect(section).toContain("This website");
      expect(section).toContain("open-source project");
      expect(section).not.toContain('class="ph"');
      expect(section).not.toContain("Placeholder:");
      // R01 was the featured project and is left out, and no other takes its tag.
      expect(section).not.toContain('class="tag"');
      // R04 is commissioning.
      expect(section).toMatch(/status--commissioning[^>]*>\s*commissioning/);
    });
  }

  if (deployContext === "preview") {
    it("shows the skills in a preview: a hatched row, with no seen-in line, and a hatched item to explore", () => {
      const html = read(dir, "index.html");
      const section = /<section[^>]*\sid="skills"[\s\S]*?<\/section>/.exec(
        html,
      )?.[0];
      expect(section, "no skills section").toBeDefined();
      // After the projects and before the footer, where the nav's link goes.
      expect(html.indexOf('id="projects"')).toBeLessThan(
        html.indexOf('id="skills"'),
      );
      expect(html.indexOf('id="skills"')).toBeLessThan(html.indexOf("<footer"));
      expect(html).toContain('href="/#skills"');
      // The one placeholder row: its group, its context and its tool, and the item to explore.
      expect(section!.match(/class="skill"/g)).toHaveLength(1);
      expect(section!.match(/class="ph"/g)!.length).toBeGreaterThanOrEqual(4);
      expect(section).not.toContain('class="seen"');
      // The heading is the template's own text; the intro goes through an expression, which
      // escapes its apostrophe.
      expect(section).toContain("what I'm exploring next");
      expect(section).toContain("Where I&#39;ve used each one");
      // The one row is a placeholder with no runs, so nothing in the section links anywhere.
      expect(section).not.toContain("<a ");
    });
  } else {
    it("shows the skills on production exactly when something in them is real, and its nav link with it, so the page and the nav agree", () => {
      // While the profile's skill row and exploring item are placeholders, nothing is real: the
      // section, its link and the exploring heading are all out. A real row or item brings all of
      // them in.
      const html = read(dir, "index.html");
      expect(html.includes('id="skills"')).toBe(skillsShown);
      expect(html.includes('href="/#skills"')).toBe(skillsShown);
      expect(html.includes("what I'm exploring next")).toBe(
        skillsShown && profile.exploring.some((item) => !isPlaceholder(item)),
      );
    });
  }

  it("shows the certifications section, and its nav link, exactly when there is a certification to show", () => {
    const html = read(dir, "index.html");
    expect(html.includes('id="certifications"')).toBe(shownCerts.length > 0);
    expect(html.includes('href="/#certifications"')).toBe(
      shownCerts.length > 0,
    );
  });

  it("renders each certification it shows, with a link only for a real verify address and a hatch only in a preview", () => {
    const html = read(dir, "index.html");
    const section =
      /<section[^>]*\sid="certifications"[\s\S]*?<\/section>/.exec(html)?.[0];
    if (shownCerts.length === 0) {
      expect(section).toBeUndefined();
      return;
    }
    expect(section, "no certifications section").toBeDefined();
    expect(section!.match(/class="cert"/g)).toHaveLength(shownCerts.length);
    // No link is made up: one per real address, and none for a placeholder or a missing one.
    expect(section!.match(/<a /g) ?? []).toHaveLength(
      shownCerts.filter(
        (cert) => cert.verify !== undefined && !isPlaceholder(cert.verify),
      ).length,
    );
    // Every placeholder value is hatched in a preview, and none is left on production.
    const placeholders = shownCerts
      .flatMap((cert) => [cert.title, cert.issuer, cert.date, cert.verify])
      .filter((value) => value !== undefined && isPlaceholder(value));
    expect(section!.match(/class="ph"/g) ?? []).toHaveLength(
      deployContext === "preview" ? placeholders.length : 0,
    );
    expect(section).not.toContain("TODO:");
    // After the projects, where the nav's link goes, and before the footer.
    expect(html.indexOf('id="projects"')).toBeLessThan(
      html.indexOf('id="certifications"'),
    );
    expect(html.indexOf('id="certifications"')).toBeLessThan(
      html.indexOf("<footer"),
    );
  });

  it("shows the garage section, and its nav link, exactly when there is an entry to show", () => {
    const html = read(dir, "index.html");
    expect(html.includes('id="garage"')).toBe(shownGarage.length > 0);
    expect(html.includes('href="/#garage"')).toBe(shownGarage.length > 0);
  });

  it("draws the wheel's first frame into the page, intact, so there is a still wheel without script", () => {
    const html = read(dir, "index.html");
    const section = /<section[^>]*\sid="garage"[\s\S]*?<\/section>/.exec(
      html,
    )?.[0];
    if (shownGarage.length === 0) {
      expect(section).toBeUndefined();
      expect(html).not.toContain("data-wheel");
      return;
    }
    expect(section, "no garage section").toBeDefined();
    const pre = /<pre\b([^>]*\sdata-wheel[^>]*)>([\s\S]*?)<\/pre>/.exec(
      section!,
    );
    expect(pre, "no wheel").not.toBeNull();
    expect(pre![1]).toContain('aria-hidden="true"');
    // Every space and line break of the frame survives the build's HTML compression.
    expect(pre![2]).toBe(frame(FIRST_TICK));
    expect(section!.match(/<figure[^>]*class="gcard[ "]/g)).toHaveLength(
      shownGarage.length,
    );
    expect(section).not.toContain("<img");
    // Every placeholder is hatched in a preview, and none is left on production.
    expect(section).not.toContain("TODO:");
    // After the certifications and before the footer.
    expect(html.indexOf('id="garage"')).toBeLessThan(html.indexOf("<footer"));
    if (html.includes('id="certifications"')) {
      expect(html.indexOf('id="certifications"')).toBeLessThan(
        html.indexOf('id="garage"'),
      );
    }
  });

  it("shows the contact section, last before the footer, with the email production has", () => {
    const html = read(dir, "index.html");
    const section = /<section[^>]*\sid="contact"[\s\S]*?<\/section>/.exec(
      html,
    )?.[0];
    expect(contactShown).toBe(true);
    expect(section, "no contact section").toBeDefined();
    expect(html).toContain('href="/#contact"');
    // After everything else on the page, and before the footer.
    for (const id of ["projects", "skills", "certifications", "garage"]) {
      if (html.includes(`id="${id}"`)) {
        expect(html.indexOf(`id="${id}"`), id).toBeLessThan(
          html.indexOf('id="contact"'),
        );
      }
    }
    expect(html.indexOf('id="contact"')).toBeLessThan(html.indexOf("<footer"));
    // The email is real, so it is a mailto link in a preview and in production alike, broken
    // after the @ with no space put there.
    expect(section).toContain('href="mailto:hello@louislawson.co.uk"');
    expect(section).toMatch(/>hello@<wbr[^>]*>louislawson\.co\.uk<\/a>/);
    expect(section).toContain(
      "About a role, a project, or just a conversation.",
    );
  });

  if (deployContext === "preview") {
    it("hatches the contact details that are placeholders in a preview, and a CV that is not there says so", () => {
      const section = /<section[^>]*\sid="contact"[\s\S]*?<\/section>/.exec(
        read(dir, "index.html"),
      )![0];
      const { links, availability, region, cv } = profile;
      // What a preview hatches follows the profile: each placeholder once, and the statement's end
      // date only when its text is real (a placeholder text stands for both).
      const hatched = [
        links.github,
        links.linkedin,
        region,
        availability?.text,
        availability !== undefined && !isPlaceholder(availability.text)
          ? availability.until
          : undefined,
      ].filter((value) => isPlaceholder(value));
      expect(section.match(/class="ph"/g) ?? []).toHaveLength(hatched.length);
      expect(section).not.toContain("TODO:");
      expect(section).toContain("based in");
      if (availability !== undefined && isPlaceholder(availability.until)) {
        expect(section).toContain("availability");
      }
      // The email, and a link for each address that is real: a placeholder is not a link.
      expect(section.match(/<a /g)).toHaveLength(
        1 +
          [links.github, links.linkedin, cv].filter(
            (value) => !isPlaceholder(value),
          ).length,
      );
      if (isPlaceholder(cv)) {
        expect(section).toMatch(
          /<span [^>]*aria-disabled="true"[^>]*>cv not added yet/,
        );
        expect(section).not.toContain("download");
        expect(section).not.toContain("/cv.pdf");
      } else {
        expect(section).toMatch(/<a [^>]*href="\/cv\.pdf"[^>]*\sdownload/);
        expect(section).not.toContain("cv not added yet");
      }
    });

    it("keeps a disabled button looking disabled under the pointer", () => {
      // The rule for any button's hover is more specific than the disabled look, so the disabled
      // button needs its own hover rule that keeps the hi-vis dashed border.
      const css = stylesheetText(dir);
      const hover =
        /\.btn\[aria-disabled=["']?true["']?\]:hover\{([^}]*)\}/.exec(
          css,
        )?.[1] ?? "";
      expect(hover).toContain("border-color:var(--hivis)");
    });
  } else {
    it("leaves out of production every contact detail that is a placeholder, and keeps the email", () => {
      const section = /<section[^>]*\sid="contact"[\s\S]*?<\/section>/.exec(
        read(dir, "index.html"),
      )![0];
      expect(section).not.toContain('class="ph"');
      expect(section).not.toContain("Placeholder:");
      expect(section).not.toContain("TODO:");
      expect(section).not.toContain("aria-disabled");
      expect(section.includes("linkedin")).toBe(
        !isPlaceholder(profile.links.linkedin),
      );
      expect(section.includes("github")).toBe(
        !isPlaceholder(profile.links.github),
      );
      expect(section.includes("download cv")).toBe(!isPlaceholder(profile.cv));
      expect(section).not.toContain("cv not added yet");
      if (isPlaceholder(profile.availability?.text)) {
        expect(section).not.toContain("availability");
      }
      expect(section.includes("based in")).toBe(!isPlaceholder(profile.region));
    });
  }

  it.each(["index.html", "404.html"])(
    "has no form and nothing to type into in %s, which the contact label says",
    (page) => {
      // A button is not a form: the menu, the shortcut switch, the inspect toggle and the trace's
      // replay are buttons that act on the page, and send nothing.
      expect(read(dir, page)).not.toMatch(/<(form|input|textarea|select)\b/);
    },
  );

  it("loads no photo with the home page and carries none as data: no image tag, and no data URL in any script", () => {
    // The dither is text made at build and the full-colour photo is asked for by the script only
    // when someone hovers, focuses or taps, so neither the page nor a script holds a photo.
    expect(read(dir, "index.html")).not.toContain("<img");
    const scripts = readdirSync(join(dir, "_astro"))
      .filter((file) => file.endsWith(".js"))
      .map((file) => read(dir, `_astro/${file}`));
    expect(scripts.length).toBeGreaterThan(0);
    for (const code of scripts) {
      expect(code).not.toMatch(/data:image|;base64,/);
    }
  });

  it("puts no text from the direction contract or the build plan in the page, labels included", () => {
    // The page speaks for itself. A run of eight words that is in either document is a sentence
    // copied from it, not something the page says. The one exception is a label the plan itself
    // quotes as the approved wording ("…" in the section's spec): that sentence is meant for the
    // page, so it is taken out of the plan before the plan is compared, and every other word of
    // the plan still counts.
    const sources = [
      "../.impeccable/surfaces/src-pages-index-astro.md",
      "../docs/BUILD-PLAN.md",
    ].map((file) =>
      wordRuns(
        words(
          withoutApprovedLabels(
            readFileSync(new URL(file, import.meta.url), "utf-8"),
            // The wording the plan approves for the page: each section's label and intro line.
            [
              ...Object.values(INSPECT_LABELS),
              ...Object.values(SECTION_INTROS),
            ],
          ),
        ),
      ),
    );
    for (const page of ["index.html", "404.html", ...projectPages(dir)]) {
      const html = read(dir, page);
      const labels = [...html.matchAll(/\sdata-inspect="([^"]*)"/g)].map(
        (m) => m[1],
      );
      const text = words(
        `${html.replace(/<(script|style)[\s\S]*?<\/\1>/g, " ")} ${labels.join(" ")}`,
      );
      for (const run of wordRuns(text)) {
        for (const source of sources)
          expect(source.has(run), `${page}: "${run}"`).toBe(false);
      }
    }
  });

  it("sizes the bar from the one --nav-height token and hangs its dropdown from the bar's own bottom", () => {
    const css = stylesheetText(dir);
    // A minimum, not a fixed height: the bar takes a second row when a visitor's own text spacing
    // makes its contents wider than the window, and the dropdown follows its real bottom.
    expect(css).toMatch(/min-height:var\(--nav-height\)/);
    expect(css).not.toMatch(/(?<![-\w])height:var\(--nav-height\)/);
    expect(css).toMatch(/\.nav__nav[^{]*\{[^}]*top:100%/);
    // Not the token's own definition, `--nav-height:58px`, but a property set to the bare number.
    expect(css).not.toMatch(/(?<![-\w])(?:top|height):58px/);
  });

  it("shows the number hints only while data-shortcuts is on, so they never show without script", () => {
    const css = stylesheetText(dir);
    expect(css).toMatch(/\[data-shortcuts=["']?on["']?\][^{]*\.hint/);
    // Hidden by default: the plain rule for the hint has display:none.
    expect(css).toMatch(/\.hint\[[^\]]+\]\{[^}]*display:none/);
  });

  it("makes the 404 page from the same world, with a heading, a line and links, and no script of its own", () => {
    const html = read(dir, "404.html");
    expect(html).toContain("404 · not found");
    expect(html).toContain("There is nothing at this address.");
    expect(html).not.toMatch(/<script(?![^>]*\ssrc=)[^>]*>/);
  });

  it("links the 404 page to the home page and the sections this build shows", () => {
    const html = read(dir, "404.html");
    const nav = /<nav aria-label="Pages on this site"[\s\S]*?<\/nav>/.exec(
      html,
    )?.[0];
    expect(nav).toBeDefined();
    const links = [...nav!.matchAll(/<a href="([^"]+)"/g)].map((m) => m[1]);
    expect(links[0]).toBe("/");
    if (deployContext === "preview") {
      // A preview shows every section, with its placeholders hatched.
      expect(links).toEqual([
        "/",
        "/#projects",
        "/#skills",
        "/#certifications",
        "/#garage",
        "/#contact",
      ]);
    } else {
      // Production shows only what is real, so which sections it links to follows the content.
      expect(links).toContain("/#projects");
      expect(links).toContain("/#contact");
    }
  });

  describe("the project pages", () => {
    const slugs = () => listing(dir, "projects").sort();
    const page = (slug: string) => read(dir, `projects/${slug}/index.html`);

    it("are built for the projects this build shows: every one in a preview, the real ones on production", () => {
      if (deployContext === "preview") {
        const files = readdirSync(
          join(process.cwd(), "src", "content", "projects"),
        )
          .filter((name) => name.endsWith(".md"))
          .map((name) => name.replace(/\.md$/, ""))
          .sort();
        expect(slugs()).toEqual(files);
      } else {
        // R04 alone is real, so it is the only page, and a project that is left out has none:
        // its address gets the 404 page.
        expect(slugs()).toEqual(["this-website"]);
        expect(
          readdirSync(dir, { recursive: true, encoding: "utf-8" }).some(
            (path) => path.includes("r01-placeholder"),
          ),
        ).toBe(false);
      }
    });

    it("give each page its own address as the canonical URL, ending in the file name and a slash", () => {
      for (const slug of slugs()) {
        expect(page(slug), slug).toContain(
          `<link rel="canonical" href="https://louislawson.co.uk/projects/${slug}/">`,
        );
      }
      expect(page("this-website")).toContain(
        '<link rel="canonical" href="https://louislawson.co.uk/projects/this-website/">',
      );
    });

    it("title the tab with the project and the site, and keep the page out of search while the site is", () => {
      expect(page("this-website")).toContain(
        "<title>This website · Louis Lawson</title>",
      );
      for (const slug of slugs()) {
        expect(page(slug), slug).toContain(
          '<meta name="robots" content="noindex">',
        );
      }
      if (deployContext === "preview") {
        // A placeholder title cannot be hatched in a tab, so the tab names the code.
        expect(page("r01-placeholder")).toContain(
          "<title>R01 · Louis Lawson</title>",
        );
      }
    });

    it("label the heading with the page's own file, and only the bar, the footer and the heading", () => {
      for (const slug of slugs()) {
        const labels = [
          ...page(slug).matchAll(/\sdata-inspect="([^"]*)"/g),
        ].map((m) => m[1]);
        expect(labels, slug).toHaveLength(3);
        expect(labels, slug).toContain(INSPECT_LABELS.nav);
        expect(labels, slug).toContain(INSPECT_LABELS.footer);
        expect(labels, slug).toContain(projectPageLabel({ id: slug }));
        // The heading is the one that carries it.
        expect(page(slug), slug).toMatch(
          new RegExp(
            `<h1[^>]*\\sdata-inspect="generated at build from src/content/projects/${slug}\\.md"`,
          ),
        );
      }
    });

    it("have the shared layout: the navigation, one h1, the way back and the footer", () => {
      for (const slug of slugs()) {
        const html = page(slug);
        expect(html, slug).toMatch(/<html lang="en-GB"/);
        expect(html, slug).toMatch(/<a class="nav__home" href="\/"/);
        expect(html, slug).toContain('href="/#projects"');
        expect(html.match(/<h1\b/g), slug).toHaveLength(1);
        expect(html, slug).toMatch(/<a [^>]*class="back"[^>]*>/);
        expect(html.indexOf("<main"), slug).toBeLessThan(
          html.indexOf("<footer"),
        );
        // The way back says what it is, and is not the mock's fake command.
        expect(html, slug).toContain("all projects");
        expect(html, slug).not.toContain("cd ../projects");
      }
    });

    it("use no id twice on any page of the build, because aria-controls and aria-labelledby find the first", () => {
      const pages = Object.entries(pagesAndStyles(dir)).filter(([name]) =>
        name.endsWith(".html"),
      );
      expect(pages.length).toBeGreaterThanOrEqual(3);
      for (const [name, html] of pages) {
        const seen = new Map<string, number>();
        for (const m of html.matchAll(/\sid="([^"]*)"/g)) {
          seen.set(m[1]!, (seen.get(m[1]!) ?? 0) + 1);
        }
        const repeated = [...seen].filter(([, count]) => count > 1);
        expect(repeated, name).toEqual([]);
      }
    });

    it("show R04's page with its real values on production and in a preview alike", () => {
      const html = page("this-website");
      // The space the formatter puts inside a block's tags collapses, and is no gap in a word.
      expect(html).toMatch(/<h1[^>]*>\s*This website\s*<\/h1>/);
      expect(html).toContain("R04");
      expect(html).toMatch(/status--commissioning[^>]*>\s*commissioning/);
      expect(html).toContain("open-source project");
      // The sheet's three columns.
      for (const column of ["setup", "change", "result"]) {
        expect(html).toMatch(new RegExp(`<h2[^>]*>${column}</h2>`));
      }
      // R04 has no measurements, so its block is headed for what it holds and has no table.
      expect(html).toMatch(
        /<h2[^>]*\sid="project-details"[^>]*>\s*tools\s*<\/h2>/,
      );
      expect(html).not.toContain(">measured<");
      expect(html).not.toContain("<table");
      // The tools and the link, which is the repository.
      expect(html).toContain('aria-label="Tools used"');
      expect(html).toContain("Terraform");
      expect(html).toMatch(
        /<a [^>]*class="btn"[^>]*href="https:\/\/github\.com\/louislawson\/louislawson\.co\.uk"|<a [^>]*href="https:\/\/github\.com\/louislawson\/louislawson\.co\.uk"[^>]*class="btn"/,
      );
      expect(html).not.toContain('class="tag"');
    });

    it("render R04's write-up under the write-up heading: its ### headings as h3, in order, with no h1 or h2 of its own", () => {
      const source = readFileSync(
        join(process.cwd(), "src", "content", "projects", "this-website.md"),
        "utf-8",
      );
      // The headings the file writes outside code blocks, as the page shows them: smartypants makes
      // ' a curly quote, and the page's text has no tags.
      const written = [
        ...source
          .replace(/^(`{3,}|~{3,})[^\n]*\n[\s\S]*?\n\1[ \t]*$/gm, "")
          .matchAll(/^### (.+)$/gm),
      ].map((m) => m[1]!.replace(/'/g, "’"));
      expect(written.length).toBeGreaterThanOrEqual(5);
      // The rule forbids # and ##, so none is left in the file for the build to have rendered.
      expect(source).not.toMatch(/^#{1,2} /m);

      const html = page("this-website");
      expect(html.match(/<h2[^>]*\sid="writeup"/g)).toHaveLength(1);
      const prose =
        /<div class="prose"[^>]*>(.*?)<\/div>\s*<\/div>\s*<\/section>/s.exec(
          html,
        )?.[1] ?? "";
      const headings = [...prose.matchAll(/<h([1-6])\b[^>]*>(.*?)<\/h\1>/gs)];
      expect(headings.map((m) => m[1])).toEqual(written.map(() => "3"));
      expect(headings.map((m) => m[2]!.replace(/<[^>]+>/g, ""))).toEqual(
        written,
      );
      // The prose sits between the measured block and the end of the page's content.
      expect(html.indexOf('id="project-details"')).toBeLessThan(
        html.indexOf('id="writeup"'),
      );
    });

    it("keep a code block in a write-up free of an inline style, since no highlighter is on", () => {
      // No project has a code block today, and a build with one is WriteUp.build.test.ts. This holds
      // the whole project pages to the content security policy's rule, whatever they come to hold.
      for (const slug of slugs()) {
        expect(page(slug), slug).not.toMatch(STYLE_ATTRIBUTE);
        expect(page(slug), slug).not.toContain("astro-code");
      }
    });

    if (deployContext === "preview") {
      it("hatch a placeholder project's values, and follow the home page's order from one page to the next, wrapping", () => {
        const html = page("r01-placeholder");
        expect(html).toContain('class="ph"');
        expect(html).toContain("Placeholder: ");
        expect(html).not.toContain("TODO:");
        // Its write-up is a placeholder too: the heading stays, and the placeholder is hatched
        // under it, not printed as the Markdown it is.
        const writeUp =
          /<section[^>]*aria-labelledby="writeup".*?<\/section>/s.exec(
            html,
          )?.[0] ?? "";
        expect(writeUp).toMatch(/<h2[^>]*>\s*write-up\s*<\/h2>/);
        expect(writeUp).toContain('class="ph"');
        expect(writeUp).toContain("Placeholder: ");
        // R01 is the featured project, so it carries the tag and leads the order.
        expect(html).toContain('class="tag"');
        const next = (slug: string) =>
          /<a [^>]*class="next"[^>]*href="([^"]+)"|<a [^>]*href="([^"]+)"[^>]*class="next"/
            .exec(page(slug))
            ?.slice(1)
            .find(Boolean);
        expect(next("r01-placeholder")).toBe("/projects/r02-placeholder/");
        expect(next("r02-placeholder")).toBe("/projects/r03-placeholder/");
        expect(next("r03-placeholder")).toBe("/projects/this-website/");
        expect(next("this-website")).toBe("/projects/r01-placeholder/");
      });
    } else {
      it("show no placeholder and no link to a next project, because the one page stands alone", () => {
        const html = page("this-website");
        expect(html).not.toContain('class="ph"');
        expect(html).not.toContain("Placeholder:");
        expect(html).not.toContain("TODO:");
        expect(html).not.toContain('class="next"');
        expect(html).not.toContain("next project");
      });
    }
  });
});

describe("the build info in the trace panel", () => {
  it("shows the build number and the commit the deploy workflow gives the build", () => {
    const dir = build({
      DEPLOY_CONTEXT: "preview",
      BUILD_NUMBER: "412",
      GIT_SHA: "0af5e05",
    });
    const html = read(dir, "index.html");
    expect(html).toContain("build 412 · commit 0af5e05");
    expect(html).not.toContain("local build");
  });

  it("shows a local build, and nothing odd, for a value that is not a run number and a commit", () => {
    const dir = build({
      DEPLOY_CONTEXT: "preview",
      BUILD_NUMBER: "<b>412</b>",
      GIT_SHA: "main",
    });
    const html = read(dir, "index.html");
    expect(html).toContain("local build");
    expect(html).not.toContain("<b>412");
  });
});

describe("a build with an unknown DEPLOY_CONTEXT", () => {
  it("fails, naming the value", () => {
    let stderr = "";
    try {
      build({ DEPLOY_CONTEXT: "staging" });
    } catch (error) {
      stderr = String((error as { stderr?: Buffer }).stderr ?? "");
    }
    expect(stderr).toContain("staging");
  });
});
