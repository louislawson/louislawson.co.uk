import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { describe, expect, it } from "vitest";
import { assembleSiteContent } from "../../content/assemble";
import { profileData, projectEntry } from "../../content/__fixtures__/content";
import { presentSiteContent, type Section } from "../../content/visibility";
import { INSPECT_LABELS } from "../inspect-labels";
import Contact from "./Contact.astro";
import { SECTION_INTROS } from "./section-intros";

const all: Section[] = [
  { id: "projects", number: 1 },
  { id: "skills", number: 2 },
  { id: "certifications", number: 3 },
  { id: "garage", number: 4 },
  { id: "contact", number: 5 },
];

const real = {
  email: "hello@louislawson.co.uk",
  links: {
    github: "https://github.com/example",
    linkedin: "https://www.linkedin.com/in/example",
  },
  cv: "/cv.pdf",
  availability: { text: "Open to contract work", until: "2099-12-31" },
  region: "North West England",
};

/** What a preview is given while Louis has supplied nothing but the email. */
const placeholders = {
  email: "hello@louislawson.co.uk",
  links: { github: "TODO: GitHub URL", linkedin: "TODO: LinkedIn URL" },
  cv: "TODO: set to /cv.pdf once public/cv.pdf exists",
  availability: { text: "TODO: status", until: "TODO: date" },
  region: "TODO: region",
};

/** What production is given for the same profile: every placeholder already left out. */
const production = {
  email: "hello@louislawson.co.uk",
  links: {},
  cv: undefined,
  availability: undefined,
  region: undefined,
};

async function render(props: Record<string, unknown>): Promise<string> {
  const container = await AstroContainer.create();
  const html = await container.renderToString(Contact, {
    props: { sections: all, ...props },
  });
  return html.replace(/\s+/g, " ");
}

/** The first tag, with its attributes, of each element that has this class. */
const tagsWith = (html: string, className: string) =>
  [
    ...html.matchAll(
      new RegExp(`<\\w+[^>]*class="[^"]*\\b${className}\\b[^"]*"[^>]*>`, "g"),
    ),
  ].map((m) => m[0]);

/** The text of each `<dd>`, tags taken out, in order. */
const answers = (html: string) =>
  [...html.matchAll(/<dd\b[^>]*>(.*?)<\/dd>/g)].map((m) =>
    m[1]!
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim(),
  );

/** The text of each button (a `.btn` link or span), tags taken out, in order. */
const buttonTexts = (html: string) =>
  (/<div class="contact__btns"[^>]*>(.*?)<\/div>/.exec(html)?.[1] ?? "")
    // A hatched value nests spans in the button, so mark where each button starts and strip the rest.
    .replace(/<(?:a|span) class="btn[^"]*"[^>]*>/g, "|")
    .replace(/<[^>]+>/g, "")
    .split("|")
    .slice(1)
    .map((text) => text.replace(/\s+/g, " ").trim());

/** The text of each `<dt>`, in order. */
const questions = (html: string) =>
  [...html.matchAll(/<dt\b[^>]*>(.*?)<\/dt>/g)].map((m) => m[1]!.trim());

describe("<Contact>", () => {
  it("is a section with the id the navigation links to, headed contact, with no count", async () => {
    const html = await render({ profile: real });
    expect(html).toMatch(/<section[^>]*\sid="contact"/);
    expect(html).toMatch(/<h2[^>]*>\s*contact\s*<\/h2>/);
    expect(html).not.toContain('class="n"');
  });

  it("has the intro the plan approves", async () => {
    expect(SECTION_INTROS.contact).toBe(
      "About a role, a project, or just a conversation.",
    );
    const html = await render({ profile: real });
    expect(html).toMatch(
      /<p[^>]*>\s*About a role, a project, or just a conversation\.\s*<\/p>/,
    );
  });

  it("is labelled for inspect mode", async () => {
    const html = await render({ profile: real });
    expect(INSPECT_LABELS.contact).toBe(
      "mailto only · no forms, no backend, no cookies",
    );
    expect(html).toContain(`data-inspect="${INSPECT_LABELS.contact}"`);
    expect(html).toMatch(/<section[^>]*\sid="contact"[^>]*\sdata-inspect="/);
  });

  it("is not rendered when the contact section is not shown, so the nav and the page agree", async () => {
    const html = await render({
      profile: real,
      sections: all.filter((s) => s.id !== "contact"),
    });
    expect(html.trim()).toBe("");
  });

  describe("the email", () => {
    it("is a large mailto link, with a line break allowed after the @ and no space added there", async () => {
      const html = await render({ profile: real });
      const links = tagsWith(html, "mail");
      expect(links).toHaveLength(1);
      expect(links[0]).toMatch(/^<a\b/);
      expect(links[0]).toContain('href="mailto:hello@louislawson.co.uk"');
      // Astro may put its scoping attribute on the <wbr>; nothing else sits between the parts.
      expect(html).toMatch(/>hello@<wbr[^>]*>louislawson\.co\.uk<\/a>/);
    });

    it("is the only mailto link, and sets no target", async () => {
      const html = await render({ profile: real });
      expect(html.match(/href="mailto:/g)).toHaveLength(1);
      expect(tagsWith(html, "mail")[0]).not.toContain("target=");
    });

    it("is left out when there is none, as on production while it is a placeholder", async () => {
      const html = await render({
        profile: { ...production, email: undefined },
      });
      expect(html).not.toContain("mailto:");
      expect(tagsWith(html, "mail")).toHaveLength(0);
    });
  });

  describe("the links", () => {
    it("are linkedin then github, each a link to its address in the same tab with the external icon", async () => {
      const html = await render({ profile: { ...real, cv: undefined } });
      const buttons = [...html.matchAll(/<a class="btn" [^>]*>.*?<\/a>/g)].map(
        (m) => m[0],
      );
      expect(buttons).toHaveLength(2);
      expect(buttons[0]).toContain(
        'href="https://www.linkedin.com/in/example"',
      );
      expect(buttons[0]).toMatch(/>linkedin\s*<svg/);
      expect(buttons[1]).toContain('href="https://github.com/example"');
      expect(buttons[1]).toMatch(/>github\s*<svg/);
      for (const button of buttons) expect(button).not.toContain("target=");
    });

    it("are left out one at a time: a link with no address makes no button", async () => {
      const html = await render({
        profile: { ...production, links: { github: real.links.github } },
      });
      expect(html).toContain("github");
      expect(html).not.toContain("linkedin");
      expect(html.match(/<a class="btn"/g)).toHaveLength(1);
    });
  });

  describe("the CV", () => {
    it("is a download link to /cv.pdf, with the download attribute and the download icon, once it is real", async () => {
      const html = await render({ profile: real });
      const link = /<a [^>]*href="\/cv\.pdf"[^>]*>.*?<\/a>/.exec(html)?.[0];
      expect(link, "no cv link").toBeDefined();
      expect(link).toMatch(/\sdownload(?=[\s>=])/);
      expect(link).toMatch(/>download cv\s*<svg/);
      expect(html).not.toContain("cv not added yet");
    });

    it.each(["preview", "local"])(
      "is an aria-disabled 'cv not added yet' with no link behind it, on a %s build, while it is a placeholder",
      async (context) => {
        const html = await render({ profile: placeholders, context });
        const span = /<span [^>]*aria-disabled="true"[^>]*>.*?<\/span>/.exec(
          html,
        )?.[0];
        expect(span, "no disabled button").toBeDefined();
        expect(span).toContain('class="btn"');
        expect(span).toContain("cv not added yet");
        expect(html).not.toContain("/cv.pdf");
        expect(html).not.toContain("download");
        expect(html.match(/cv not added yet/g)).toHaveLength(1);
      },
    );

    it("is left out of production while it is a placeholder: no link, no 'not added yet'", async () => {
      const html = await render({ profile: production, context: "production" });
      expect(html).not.toContain("cv");
      expect(html).not.toContain("aria-disabled");
      expect(html).not.toContain("download");
    });

    it("is left out of production even when the page is given the placeholder", async () => {
      const html = await render({
        profile: { ...production, cv: placeholders.cv },
        context: "production",
      });
      expect(html).not.toContain("aria-disabled");
      expect(html).not.toContain("download");
      expect(html).not.toContain("TODO:");
    });

    it("is the same real link on a preview and on production", async () => {
      const props = { profile: real };
      expect(await render({ ...props, context: "production" })).toBe(
        await render({ ...props, context: "preview" }),
      );
    });
  });

  describe("the facts", () => {
    it("are a description list: availability, then based in", async () => {
      const html = await render({ profile: real });
      expect(html).toMatch(/<dl\b[^>]*class="facts"/);
      expect(questions(html)).toEqual(["availability", "based in"]);
      expect(answers(html)).toEqual([
        "Open to contract work",
        "North West England",
      ]);
    });

    it("has no availability row when there is no statement", async () => {
      const html = await render({
        profile: { ...real, availability: undefined },
      });
      expect(questions(html)).toEqual(["based in"]);
      expect(html).not.toContain("availability");
    });

    it("has no based in row when there is no region", async () => {
      const html = await render({ profile: { ...real, region: undefined } });
      expect(questions(html)).toEqual(["availability"]);
      expect(html).not.toContain("based in");
    });

    it("has no list at all when there is no fact to put in it", async () => {
      const html = await render({
        profile: { ...real, availability: undefined, region: undefined },
      });
      expect(html).not.toContain("<dl");
      expect(html).not.toContain("<dt");
    });

    describe("the availability statement", () => {
      /** The profile production would show on this day, for a statement ending on `until`. */
      const shownOn = (day: string, until: string | undefined) => {
        const { profile } = presentSiteContent(
          assembleSiteContent(
            // The content needs exactly one featured project.
            [projectEntry("r01", { featured: true })],
            profileData({
              availability:
                until === undefined
                  ? undefined
                  : { text: "Open to work", until },
            }),
            new Date(`${day}T12:00:00Z`),
          ),
          "production",
        );
        return profile;
      };

      it("is shown while it is present: up to and including the day it ends", async () => {
        const html = await render({
          profile: shownOn("2026-10-19", "2026-10-19"),
        });
        expect(questions(html)).toContain("availability");
        expect(answers(html)).toContain("Open to work");
      });

      it("is gone once it has expired", async () => {
        const html = await render({
          profile: shownOn("2026-10-20", "2026-10-19"),
        });
        expect(questions(html)).not.toContain("availability");
        expect(html).not.toContain("Open to work");
        // The rest of the facts are not affected.
        expect(questions(html)).toEqual(["based in"]);
      });

      it("is gone when there never was one", async () => {
        const html = await render({
          profile: shownOn("2026-10-19", undefined),
        });
        expect(questions(html)).not.toContain("availability");
      });
    });
  });

  describe("the deploy context", () => {
    it.each(["preview", "local"])(
      "hatches every placeholder on a %s build, with the field's own short words",
      async (context) => {
        const html = await render({ profile: placeholders, context });
        expect(html).not.toContain("TODO:");
        // Two links, the availability, the region.
        expect(html.match(/class="ph"/g)).toHaveLength(4);
        expect(answers(html)).toEqual([
          "Placeholder: status",
          "Placeholder: region",
        ]);
        expect(buttonTexts(html)).toEqual([
          "Placeholder: LinkedIn URL",
          "Placeholder: GitHub URL",
          "cv not added yet",
        ]);
        // The email is real, so it is a link as it is in production.
        expect(html).toContain('href="mailto:hello@louislawson.co.uk"');
      },
    );

    it("does not make a link of a placeholder address", async () => {
      const html = await render({ profile: placeholders, context: "preview" });
      expect(html.match(/<a\b/g)).toHaveLength(1);
      expect(html).not.toContain('href="TODO');
      expect(html).not.toContain('href="#');
    });

    it("shows the email alone on production, which is all of it that is real", async () => {
      const html = await render({ profile: production, context: "production" });
      expect(html).toContain('href="mailto:hello@louislawson.co.uk"');
      expect(html).not.toContain('class="ph"');
      expect(html).not.toContain("Placeholder:");
      expect(html).not.toContain("TODO:");
      expect(html).not.toContain("linkedin");
      expect(html).not.toContain("github");
      expect(html).not.toContain("<dl");
      // No row of buttons with nothing in it.
      expect(html).not.toContain("contact__btns");
      expect(html.match(/<a\b/g)).toHaveLength(1);
    });

    it("leaves a placeholder out on production even when the page is given one", async () => {
      const html = await render({
        profile: placeholders,
        context: "production",
      });
      expect(html).not.toContain('class="ph"');
      expect(html).not.toContain("Placeholder:");
      expect(html).not.toContain("TODO:");
      expect(html).not.toContain("<dl");
      expect(html).not.toContain("aria-disabled");
    });
  });

  it("has no form, no field, no inline style and no script of its own", async () => {
    const html = await render({ profile: real });
    expect(html).not.toMatch(/<(form|input|textarea|select|button)\b/);
    expect(html).not.toMatch(/<[a-z][^>]*\sstyle\s*=/i);
    expect(html).not.toContain("<script");
  });
});
