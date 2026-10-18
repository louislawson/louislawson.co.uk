import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SECTION_INTROS } from "./components/home/section-intros";
import { INSPECT_LABELS } from "./components/inspect-labels";

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

/** Every page and stylesheet of a build: what the content security policy applies to. */
function pagesAndStyles(dir: string): Record<string, string> {
  const files: Record<string, string> = {};
  for (const page of ["index.html", "404.html"]) files[page] = read(dir, page);
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
      expect(html).toContain("no cookies, no tracking");
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
      const scripts = [...html.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)].map(
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

  it.each([
    ["index.html", 5],
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
      [...read(dir, page).matchAll(/<script[^>]*\ssrc="([^"]+)"/g)].map(
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
    // No project has a page yet, so nothing in the section links anywhere.
    const section = /<section[^>]*\sid="projects"[\s\S]*?<\/section>/.exec(
      html,
    )![0];
    expect(section).not.toContain("<a ");
    expect(section).not.toContain("href=");
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
      expect(section.split("<article")[1]).toContain('class="tag"');
    });
  } else {
    it("shows R04 alone on production, as a strip, with no placeholder and no featured tag", () => {
      const html = read(dir, "index.html");
      const section = /<section[^>]*\sid="projects"[\s\S]*?<\/section>/.exec(
        html,
      )![0];
      expect(section).toContain("runs--strip");
      expect(section).not.toContain("runs--row");
      expect(section.match(/<article\b/g)).toHaveLength(1);
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
    for (const page of ["index.html", "404.html"]) {
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

  it("sizes the bar and places its dropdown from the one --nav-height token", () => {
    const css = stylesheetText(dir);
    expect(css).toMatch(/height:var\(--nav-height\)/);
    expect(css).toMatch(/top:var\(--nav-height\)/);
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
