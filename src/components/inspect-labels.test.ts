import { readFileSync } from "node:fs";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { describe, expect, it } from "vitest";
import { assembleSiteContent } from "../content/assemble";
import { profileSchema } from "../content/schema";
import { validateContent } from "../content/validate";
import { visibleSections } from "../content/visibility";
import { profile } from "../data/profile";
import Hero from "./home/Hero.astro";
import { INSPECT_LABELS } from "./inspect-labels";
import Nav from "./Nav.astro";

const root = new URL("../../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf-8");

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
    phrase: "nothing sent anywhere",
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

describe("the inspect labels", () => {
  it("are the shell's (the bar, the footer, the 404 page's content) and the home page sections built so far", () => {
    expect(Object.keys(INSPECT_LABELS).sort()).toEqual([
      "certifications",
      "footer",
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
