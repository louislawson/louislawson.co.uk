import { existsSync, readdirSync, readFileSync } from "node:fs";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { describe, expect, it } from "vitest";
import { assembleSiteContent } from "../content/assemble";
import { profileSchema } from "../content/schema";
import { validateContent } from "../content/validate";
import { isCheckedPath } from "../metadata/check";
import { TAGS, tiff } from "../metadata/__fixtures__/exif";
import { jpeg } from "../metadata/__fixtures__/jpeg";
import { checkImage } from "../metadata/image";
import { visibleSections } from "../content/visibility";
import { profile } from "../data/profile";
import Contact from "./home/Contact.astro";
import Hero from "./home/Hero.astro";
import { INSPECT_LABELS, projectPageLabel } from "./inspect-labels";
import Nav from "./Nav.astro";

const root = new URL("../../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf-8");

/**
 * The text with its comments taken out, so a comment that talks about a cookie or a form is not
 * mistaken for one. The `//` of an address ("https://…") starts no comment.
 */
const withoutComments = (text: string) =>
  text.replace(/\/\*[\s\S]*?\*\/|<!--[\s\S]*?-->|(^|[^:])\/\/.*$/gm, "$1");

/** Whether the code reads or writes a cookie. */
const touchesCookies = (code: string) =>
  /document\.cookie|cookieStore|set-cookie/i.test(withoutComments(code));

/** Whether the markup has a form or a field to type into. */
const hasFormField = (markup: string) =>
  /<(form|input|textarea|select)\b/i.test(withoutComments(markup));

/** Every file of the site's own code with one of these endings, minus tests and fixtures. */
const sourceFiles = (endings: string[]) =>
  readdirSync(new URL("src/", root), { recursive: true, encoding: "utf-8" })
    .map((path) => path.replaceAll("\\", "/"))
    .filter(
      (path) =>
        endings.some((ending) => path.endsWith(ending)) &&
        !/\.test\.|__fixtures__/.test(path),
    )
    .map((path) => [`src/${path}`, read(`src/${path}`)] as const);

const swa = JSON.parse(read("public/staticwebapp.config.json")) as {
  routes: { route: string; headers: Record<string, string> }[];
  globalHeaders: Record<string, string>;
  responseOverrides: Record<string, { rewrite: string }>;
};
/** The directives of a Cache-Control header, as a list. */
const directives = (value: string | undefined) =>
  (value ?? "").split(",").map((part) => part.trim());
const assetCache = directives(
  swa.routes.find((route) => route.route === "/_astro/*")?.headers[
    "Cache-Control"
  ],
);
const pageCache = directives(swa.globalHeaders["Cache-Control"]);

// A label states a fact about the real build. One that is about a setting is held to it here, so a
// change to the setting that makes the label false fails the build, and the label is fixed with it.
// Each entry is a phrase a label uses, and what has to be true for it.
const facts: {
  label: keyof typeof INSPECT_LABELS;
  phrase: string;
  holds: () => boolean | Promise<boolean>;
  because: string;
}[] = [
  {
    label: "footer",
    phrase: "hashed assets cached for a year",
    holds: () =>
      assetCache.includes("max-age=31536000") &&
      assetCache.includes("immutable"),
    because:
      "/_astro/* in staticwebapp.config.json is max-age=31536000, immutable",
  },
  {
    label: "footer",
    phrase: "HTML revalidated on every load",
    holds: () =>
      pageCache.includes("max-age=0") && pageCache.includes("must-revalidate"),
    because: "the global Cache-Control is max-age=0, must-revalidate",
  },
  {
    label: "footer",
    phrase: "served by Azure Static Web Apps",
    holds: () => {
      // A resource in a comment, or commented out, is not one: only live lines count.
      const live = read("infra/site/main.tf")
        .split("\n")
        .filter((line) => !/^\s*(#|\/\/)/.test(line))
        .join("\n");
      return /^resource "azurerm_static_web_app" "\w+"/m.test(live);
    },
    because:
      "infra/site/main.tf declares an azurerm_static_web_app, not in a comment",
  },
  {
    label: "notFound",
    phrase: "serves it for any address that does not exist",
    holds: () => swa.responseOverrides["404"]?.rewrite === "/404.html",
    because: "the 404 response override rewrites to /404.html",
  },
  {
    label: "nav",
    phrase: "one per section with content",
    holds: async () => {
      // The real bar, built from what visibleSections() returns when three sections have nothing
      // in them: it links the two that have content and nothing else.
      const sections = visibleSections([{}], {
        ...profile,
        skills: [],
        exploring: [],
        certifications: [],
        garage: [],
      });
      const container = await AstroContainer.create();
      const html = await container.renderToString(Nav, {
        props: { sections },
        request: new Request("http://localhost/"),
      });
      const links = [...html.matchAll(/<a href="(\/#[^"]+)"/g)].map(
        (m) => m[1],
      );
      return links.join() === "/#projects,/#contact";
    },
    because:
      "the bar, built from visibleSections(), has no link for a section with nothing in it",
  },
  {
    label: "hero",
    phrase: "Martian Mono 800",
    holds: () => {
      // The family is the page's font, and the name is set at weight 800.
      const family = /--mono:\s*"([^"]+)"/.exec(read("src/styles/global.css"));
      const name = /\.hero__name\s*\{[^}]*\}/.exec(
        read("src/components/home/Hero.astro"),
      )?.[0];
      return (
        family?.[1] === "Martian Mono Variable" &&
        /font-weight:\s*800\b/.test(name ?? "") &&
        // The name is in the page's own font, not one set on the heading.
        !/font-family/.test(name ?? "")
      );
    },
    because:
      "--mono is Martian Mono Variable and .hero__name sets font-weight: 800 without its own family",
  },
  {
    label: "hero",
    phrase: "static HTML, no JavaScript",
    holds: async () => {
      // The heading is in the built HTML, and the component carries no script of its own.
      const container = await AstroContainer.create();
      const html = await container.renderToString(Hero, {
        props: { profile: {}, sections: [] },
      });
      return (
        /<h1[^>]*>\s*Louis <br[^>]*>Lawson/.test(html) &&
        !html.includes("<script") &&
        !/<script/.test(read("src/components/home/Hero.astro"))
      );
    },
    because: "Hero renders the h1 as HTML and has no <script> block",
  },
  {
    label: "projects",
    phrase: "src/content/projects/*.md",
    holds: () => {
      // The label names the loader's own folder and pattern, read from the loader.
      const loader = /glob\(\{([^}]*)\}\)/.exec(
        read("src/content.config.ts"),
      )?.[1];
      const pattern = /pattern:\s*"([^"]+)"/.exec(loader ?? "")?.[1];
      const base = /base:\s*"([^"]+)"/.exec(loader ?? "")?.[1];
      return (
        pattern !== undefined &&
        base !== undefined &&
        `${base.replace(/^\.\//, "")}/${pattern}` ===
          "src/content/projects/*.md"
      );
    },
    because:
      "src/content.config.ts loads projects with glob({ pattern: '*.md', base: './src/content/projects' })",
  },
  {
    label: "skills",
    phrase: "from profile.ts",
    holds: () => {
      // The skills and the exploring list come from the profile data file, through the one loader
      // every page reads content by, and the home page hands them to the section from there.
      const page = read("src/pages/index.astro");
      return (
        /import \{ profile \} from "\.\.\/data\/profile"/.test(
          read("src/content/site-content.ts"),
        ) &&
        /^export const profile\b/m.test(read("src/data/profile.ts")) &&
        /const \{[^}]*\bprofile\b[^}]*\} = await getSiteContent\(\)/.test(
          page,
        ) &&
        /skills=\{profile\.skills\}/.test(page) &&
        /exploring=\{profile\.exploring\}/.test(page)
      );
    },
    because:
      "site-content.ts imports `profile` from src/data/profile.ts, and index.astro gives the section profile.skills and profile.exploring from getSiteContent()",
  },
  {
    label: "skills",
    phrase: "'seen in' codes checked at build",
    holds: () => {
      // A skill's run that no project has is a problem validateContent reports, and the content
      // loader's assembly throws on it, so the build stops.
      const project = {
        id: "r01",
        data: { code: "R01", order: 1, featured: true },
      };
      const fakeProfile = { skills: [{ group: "Delivery", runs: ["R09"] }] };
      const problems = validateContent([project], fakeProfile);
      let threw = false;
      try {
        assembleSiteContent([project], fakeProfile, new Date());
      } catch (error) {
        threw = String(error).includes("R09");
      }
      return problems.some((p) => p.includes("R09")) && threw;
    },
    because:
      "validateContent reports a skill's run that no project has, and assembleSiteContent throws on it",
  },
  {
    label: "certifications",
    phrase: "from profile.ts",
    holds: () => {
      // The certifications come from the profile data file, through the one loader every page
      // reads content by, and the home page hands them to the section from there.
      const page = read("src/pages/index.astro");
      return (
        /import \{ profile \} from "\.\.\/data\/profile"/.test(
          read("src/content/site-content.ts"),
        ) &&
        /^export const profile\b/m.test(read("src/data/profile.ts")) &&
        /const \{[^}]*\bprofile\b[^}]*\} = await getSiteContent\(\)/.test(
          page,
        ) &&
        /certifications=\{profile\.certifications\}/.test(page)
      );
    },
    because:
      "site-content.ts imports `profile` from src/data/profile.ts, and index.astro gives the section profile.certifications from getSiteContent()",
  },
  {
    label: "certifications",
    phrase: "checked as a web address at build",
    holds: () => {
      // The profile schema is parsed when the build imports src/data/profile.ts, so a verify link
      // that is not a web address stops the build. A web address is http or https: an https URL
      // is accepted, and a script URL or one of another scheme is not.
      const cert = (verify: string) => [
        { title: "A certification", issuer: "An issuer", date: "2025", verify },
      ];
      const accepts = (verify: string) =>
        profileSchema.shape.certifications.safeParse(cert(verify)).success;
      return (
        accepts("https://example.com/verify") &&
        !accepts("javascript:alert(1)") &&
        !accepts("ftp://example.com")
      );
    },
    because:
      "profileSchema accepts a certification whose verify is an https URL and rejects javascript:alert(1) and ftp://example.com",
  },
  {
    label: "garage",
    phrase: "Metadata check in CI",
    holds: () => {
      // The label names the CI job by its name, so the job has to be called that and run the check.
      const ci = read(".github/workflows/ci.yml");
      const job = /^ {2}metadata:\n(?:(?! {2}\S).*\n?)*/m.exec(ci)?.[0] ?? "";
      const scripts = (
        JSON.parse(read("package.json")) as { scripts: Record<string, string> }
      ).scripts;
      return (
        /^ {4}name: Metadata check$/m.test(job) &&
        job.includes("npm run metadata:check") &&
        scripts["metadata:check"] !== undefined
      );
    },
    because:
      "ci.yml's metadata job is named exactly 'Metadata check' and runs npm run metadata:check",
  },
  {
    label: "garage",
    phrase: "metadata stripped before commit",
    holds: async () => {
      // The check refuses a photo that carries a location and passes a clean one, and it looks in
      // the folder the garage's photos live in.
      const located = jpeg({
        exif: tiff([], { gps: [{ tag: TAGS.gpsLatitudeRef, text: "N" }] }),
      });
      return (
        isCheckedPath("src/assets/garage/car.jpg") &&
        (await checkImage(located)).length > 0 &&
        (await checkImage(jpeg({}))).length === 0
      );
    },
    because:
      "the metadata check reports a JPEG with a GPS tag, passes a clean one, and checks src/assets/garage",
  },
  {
    label: "contact",
    phrase: "mailto only",
    holds: async () => {
      // The one way the section offers to write is the email, and it is a mailto: link.
      const container = await AstroContainer.create();
      const html = await container.renderToString(Contact, {
        props: {
          profile: { email: "hello@louislawson.co.uk", links: {} },
          sections: [{ id: "contact", number: 1 }],
        },
      });
      const hrefs = [...html.matchAll(/<a\b[^>]*\shref="([^"]*)"/g)].map(
        (m) => m[1],
      );
      return (
        hrefs.join() === "mailto:hello@louislawson.co.uk" &&
        !/<(form|input|textarea|select|button)\b/.test(html)
      );
    },
    because:
      "the contact section, given an email, renders it as a mailto: link and nothing to type into",
  },
  {
    label: "contact",
    phrase: "no forms",
    holds: () => {
      // No page, layout or component of the site has a form or a field to type into.
      const files = sourceFiles([".astro"]);
      return (
        files.length > 10 && files.every(([, text]) => !hasFormField(text))
      );
    },
    because:
      "no .astro file under src/ has a <form>, <input>, <textarea> or <select>",
  },
  {
    label: "contact",
    phrase: "no backend",
    holds: () => {
      // The site is static files: no functions folder for Static Web Apps to find, no server
      // output from Astro, and the upload step skips the API build and names no API folder.
      const upload = read(".github/actions/swa-client/action.yml");
      return (
        !existsSync(new URL("api", root)) &&
        !/output:\s*["'](server|hybrid)["']/.test(read("astro.config.mjs")) &&
        /INPUT_SKIP_API_BUILD=true/.test(upload) &&
        !/INPUT_API_LOCATION/.test(upload)
      );
    },
    because:
      "there is no api/ folder, astro.config.mjs sets no server output, and the SWA upload skips the API build with no API location",
  },
  {
    label: "contact",
    phrase: "no cookies",
    holds: () => {
      // Nothing in the site's code reads or writes a cookie, and the served configuration sets none.
      const code = sourceFiles([".ts", ".js", ".astro"]);
      return (
        code.length > 20 &&
        code.every(([, text]) => !touchesCookies(text)) &&
        !/set-cookie/i.test(read("public/staticwebapp.config.json"))
      );
    },
    because:
      "no .ts, .js or .astro file under src/ touches document.cookie or cookieStore, and staticwebapp.config.json sets no cookie",
  },
  {
    label: "projects",
    phrase: "generated at build",
    holds: () => {
      // A static build: nothing is generated when a page is asked for.
      const config = read("astro.config.mjs");
      return !/output:\s*["'](server|hybrid)["']/.test(config);
    },
    because: "astro.config.mjs does not set output to server or hybrid",
  },
  {
    label: "trace",
    phrase: "Navigation Timing API",
    holds: () =>
      // The panel's script reads the browser's navigation entry, and the steps come from the
      // fields of that entry, which the pure functions name.
      read("src/components/home/Trace.astro").includes(
        'getEntriesByType("navigation")',
      ) &&
      ["domainLookupStart", "connectEnd", "responseStart", "responseEnd"].every(
        (field) => read("src/scripts/trace.ts").includes(field),
      ),
    because:
      "Trace.astro reads performance.getEntriesByType('navigation') and trace.ts uses its timing fields",
  },
  {
    label: "trace",
    phrase: "the trace sends nothing",
    holds: () => {
      // Neither the panel's script nor its functions make a request, beacon, socket or image.
      const scripts = [
        ...read("src/components/home/Trace.astro").matchAll(
          /<script[^>]*>([\s\S]*?)<\/script>/g,
        ),
      ];
      // No script to look at would pass for want of something to check, so it does not hold.
      if (scripts.length !== 1 || scripts[0]![1]!.length < 200) return false;
      const code = [scripts[0]![1]!, read("src/scripts/trace.ts")]
        .join("\n")
        .replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
      return !/\b(fetch|XMLHttpRequest|sendBeacon|WebSocket|EventSource|new Image|import\()/.test(
        code,
      );
    },
    because:
      "Trace.astro's script and trace.ts use no fetch, XMLHttpRequest, sendBeacon, WebSocket, EventSource or Image",
  },
];

describe("the scans of the source that the contact label rests on", () => {
  it("find a cookie being read or written, and a form or a field", () => {
    expect(touchesCookies('document.cookie = "a=1"')).toBe(true);
    expect(touchesCookies("await cookieStore.set('a', '1')")).toBe(true);
    expect(touchesCookies('headers: { "Set-Cookie": "a=1" }')).toBe(true);
    expect(hasFormField('<form action="/send">')).toBe(true);
    expect(hasFormField("<input type=text>")).toBe(true);
    expect(hasFormField("<textarea></textarea>")).toBe(true);
  });

  it("leave a comment that mentions them alone, and a button, which is no field", () => {
    expect(touchesCookies("// sets no cookie: no document.cookie here")).toBe(
      false,
    );
    expect(touchesCookies("/* never a Set-Cookie header */ run()")).toBe(false);
    expect(hasFormField("<!-- there is no <form> here --><p>text</p>")).toBe(
      false,
    );
    expect(hasFormField("<button type=button>menu</button>")).toBe(false);
  });

  it("are not hidden by an address on the same line: its // is no comment", () => {
    expect(
      touchesCookies('open("https://example.com"); document.cookie = "a=1"'),
    ).toBe(true);
  });
});

describe("the inspect labels", () => {
  it("are the shell's (the bar, the footer, the 404 page's content) and the home page sections built so far", () => {
    expect(Object.keys(INSPECT_LABELS).sort()).toEqual([
      "certifications",
      "contact",
      "footer",
      "garage",
      "hero",
      "nav",
      "notFound",
      "projects",
      "skills",
      "trace",
    ]);
  });

  it.each(Object.entries(INSPECT_LABELS))(
    "%s is one short line, in the console's lower case, with no full stop",
    (_name, label) => {
      // It sits on one line above its part, up to a width, so it has to fit.
      expect(label.length).toBeGreaterThan(10);
      expect(label.length).toBeLessThanOrEqual(110);
      expect(label).toMatch(/^[a-z]/);
      expect(label).not.toMatch(/\.$/);
      expect(label).not.toMatch(/[\n\r]/);
    },
  );

  it.each(facts)(
    "$label says “$phrase”, and that is so: $because",
    async ({ label, phrase, holds }) => {
      expect(INSPECT_LABELS[label]).toContain(phrase);
      expect(await holds()).toBe(true);
    },
  );
});

describe("a project page's label", () => {
  // The loader's own folder and pattern, read from the loader: the label names a file that the
  // loader reads, so it stops being true if either changes.
  const loader = /glob\(\{([^}]*)\}\)/.exec(read("src/content.config.ts"))?.[1];
  const pattern = /pattern:\s*"([^"]+)"/.exec(loader ?? "")?.[1];
  const base = /base:\s*"([^"]+)"/.exec(loader ?? "")?.[1];

  it("names the page's own file, in the folder and with the ending the loader reads", () => {
    expect(pattern, "no pattern in the loader").toBe("*.md");
    expect(base, "no base in the loader").toBe("./src/content/projects");
    expect(
      projectPageLabel({
        id: "this-website",
        filePath: "src/content/projects/this-website.md",
      }),
    ).toBe("generated at build from src/content/projects/this-website.md");
  });

  it("takes the file name from the entry's path, which is the real name when the id is not (a name with capitals or spaces is slugged)", () => {
    expect(
      projectPageLabel({
        id: "landing-zone",
        filePath: "src/content/projects/Landing Zone.md",
      }),
    ).toBe("generated at build from src/content/projects/Landing Zone.md");
  });

  it("falls back on the id when the entry has no path", () => {
    expect(projectPageLabel({ id: "r01-placeholder" })).toBe(
      "generated at build from src/content/projects/r01-placeholder.md",
    );
  });

  it("is one short line like the others, whatever the file's name", () => {
    const label = projectPageLabel({
      id: "r01-placeholder",
      filePath: "src/content/projects/r01-placeholder.md",
    });
    expect(label.length).toBeLessThanOrEqual(110);
    expect(label).toMatch(/^[a-z]/);
    expect(label).not.toMatch(/\.$|[\n\r]/);
  });

  it("says “generated at build”, and that is so: astro.config.mjs sets no server output", () => {
    expect(read("astro.config.mjs")).not.toMatch(
      /output:\s*["'](server|hybrid)["']/,
    );
  });
});
