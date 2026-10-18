import { readFileSync } from "node:fs";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { describe, expect, it } from "vitest";
import type { Section } from "../../content/visibility";
import { FIRST_TICK, frame } from "../../scripts/wheel";
import { INSPECT_LABELS } from "../inspect-labels";
import Garage from "./Garage.astro";

const all: Section[] = [
  { id: "projects", number: 1 },
  { id: "skills", number: 2 },
  { id: "certifications", number: 3 },
  { id: "garage", number: 4 },
  { id: "contact", number: 5 },
];

const photo = { src: "/_astro/car.abc123.jpg", width: 800, height: 600 };

interface Entry {
  name: string;
  note: string;
  photo: unknown;
  alt: string;
  caption: string;
}

const tractor: Entry = {
  name: "Tractors",
  note: "Where I learned how things fit together.",
  photo,
  alt: "A tractor at a show.",
  caption: "Vintage ploughing match, a Massey Ferguson 35",
};
const truck: Entry = {
  name: "Trucks",
  note: "Big engines, simple ideas.",
  photo,
  alt: "A truck at a meet.",
  caption: "Truck meet, a Scania 143",
};
const placeholderEntry: Entry = {
  name: "TODO: cars, trucks or tractors",
  note: "TODO: a line on the interest",
  photo: "TODO: import your own photo here, metadata stripped",
  alt: "TODO: describe the photo",
  caption: "TODO: the event and vehicle, never the owner",
};

const intro = "Off the clock it is cars, trucks and tractors.";

// The component's script is bundled for the page and arrives in the markup as a module tag, even
// when the section itself is not rendered. It is not what these tests look at.
async function renderRaw(props: Record<string, unknown>): Promise<string> {
  const container = await AstroContainer.create();
  const html = await container.renderToString(Garage, { props });
  return html.replace(/<script\b[^>]*><\/script>/g, "");
}
async function render(props: Record<string, unknown>): Promise<string> {
  return (await renderRaw(props)).replace(/\s+/g, " ");
}

/** The `<figure class="gcard">` of each entry, so a test can look at one card alone. */
const cards = (html: string) =>
  [
    ...html.matchAll(/<figure\b[^>]*class="gcard[^"]*"[^>]*>.*?<\/figure>/g),
  ].map((m) => m[0]);

const textOf = (html: string) =>
  html
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** The inside of the first element of this tag, whatever its attributes. */
const inside = (html: string, tag: string) =>
  new RegExp(`<${tag}\\b[^>]*>(.*?)</${tag}>`).exec(html)?.[1];

const source = (path: string) =>
  readFileSync(new URL(path, import.meta.url), "utf-8");

describe("<Garage>", () => {
  it("is a section with the id the navigation links to, headed garage, with no count", async () => {
    const html = await render({
      garageIntro: intro,
      garage: [tractor],
      sections: all,
    });
    expect(html).toMatch(/<section[^>]*\sid="garage"/);
    expect(html).toMatch(/<h2[^>]*>\s*garage\s*<\/h2>/);
    expect(html).not.toContain('class="n"');
  });

  it("has the approved intro line, word for word", async () => {
    const html = await render({
      garageIntro: intro,
      garage: [tractor],
      sections: all,
    });
    expect(html).toMatch(
      /<div class="shead"[^>]*>.*?<p[^>]*>\s*Cars, trucks and tractors: photos from shows and meets\.\s*<\/p>/,
    );
  });

  it("is labelled for inspect mode", async () => {
    const html = await render({
      garageIntro: intro,
      garage: [tractor],
      sections: all,
    });
    expect(html).toMatch(
      /<section[^>]*\sid="garage"[^>]*\sdata-inspect="photos: metadata stripped before commit · Metadata check in CI"/,
    );
    expect(INSPECT_LABELS.garage).toBe(
      "photos: metadata stripped before commit · Metadata check in CI",
    );
  });

  it("is not rendered when the garage section is not shown, so the nav and the page agree", async () => {
    const html = await render({
      garageIntro: intro,
      garage: [tractor],
      sections: all.filter((s) => s.id !== "garage"),
    });
    expect(html.trim()).toBe("");
  });

  it("is not rendered when there are no entries, wheel included", async () => {
    const html = await render({
      garageIntro: intro,
      garage: [],
      sections: all,
    });
    expect(html.trim()).toBe("");
  });

  describe("the wheel", () => {
    it("is a hidden-from-assistive-technology pre holding the first frame, so there is a still wheel without JavaScript", async () => {
      const html = await renderRaw({
        garageIntro: intro,
        garage: [tractor],
        sections: all,
      });
      const pre = /<pre\b([^>]*)>([\s\S]*?)<\/pre>/.exec(html);
      expect(pre, "no <pre>").not.toBeNull();
      expect(pre![1]).toContain('aria-hidden="true"');
      expect(pre![1]).toContain("data-wheel");
      expect(pre![2]).toBe(frame(FIRST_TICK));
      // Not an empty box.
      expect(pre![2]!.replace(/[ \n]/g, "").length).toBeGreaterThan(300);
    });

    it("is drawn the same on every build, so the page does not change between builds", async () => {
      const props = { garageIntro: intro, garage: [tractor], sections: all };
      expect(await renderRaw(props)).toBe(await renderRaw(props));
    });

    it("is in a figure captioned fig.01 · wheel. and then the intro from the profile", async () => {
      const html = await render({
        garageIntro: intro,
        garage: [tractor],
        sections: all,
      });
      const figure =
        /<figure\b[^>]*class="garage-wheel"[^>]*>.*?<\/figure>/.exec(html)?.[0];
      expect(figure, "no wheel figure").toBeDefined();
      expect(figure).toMatch(/<pre\b/);
      const caption = inside(figure!, "figcaption");
      expect(caption).toBeDefined();
      expect(textOf(caption!)).toBe(`fig.01 · wheel. ${intro}`);
      expect(caption).toMatch(/^\s*<b[^>]*>fig\.01 · wheel\.<\/b>/);
    });

    it("keeps the figure's words out of the cards", async () => {
      const html = await render({
        garageIntro: intro,
        garage: [tractor],
        sections: all,
      });
      for (const card of cards(html)) expect(card).not.toContain("fig.01");
    });
  });

  describe("the deploy context", () => {
    it.each(["preview", "local"])(
      "hatches a placeholder intro on a %s build",
      async (context) => {
        const html = await render({
          garageIntro: "TODO: garage intro",
          garage: [tractor],
          sections: all,
          context,
        });
        const figure =
          /<figure\b[^>]*class="garage-wheel"[^>]*>.*?<\/figure>/.exec(
            html,
          )![0];
        expect(figure.match(/class="ph"/g)).toHaveLength(1);
        expect(textOf(inside(figure, "figcaption")!)).toBe(
          "fig.01 · wheel. Placeholder: garage intro",
        );
        expect(html).not.toContain("TODO:");
      },
    );

    it("leaves a placeholder intro out of production and keeps the caption's own words", async () => {
      const html = await render({
        garageIntro: "TODO: garage intro",
        garage: [tractor],
        sections: all,
        context: "production",
      });
      const caption = inside(html, "figcaption")!;
      expect(textOf(caption)).toBe("fig.01 · wheel.");
      expect(html).not.toContain("TODO:");
      expect(html).not.toContain('class="ph"');
    });

    it("leaves out an intro that is not there, as production gives it when it is a placeholder", async () => {
      const html = await render({
        garage: [tractor],
        sections: all,
        context: "production",
      });
      expect(textOf(inside(html, "figcaption")!)).toBe("fig.01 · wheel.");
    });

    it("hatches a placeholder entry on a preview and shows nothing of it on production", async () => {
      const preview = await render({
        garageIntro: intro,
        garage: [placeholderEntry],
        sections: all,
        context: "preview",
      });
      expect(cards(preview)).toHaveLength(1);
      expect(preview).not.toContain("TODO:");
      expect(cards(preview)[0]).toContain("Placeholder: ");
      const production = await render({
        garageIntro: intro,
        garage: [placeholderEntry],
        sections: all,
        context: "production",
      });
      expect(production).not.toContain("TODO:");
      expect(production).not.toContain('class="ph"');
      expect(production).not.toContain("Placeholder:");
    });

    it("shows a real entry the same in both", async () => {
      const props = {
        garageIntro: intro,
        garage: [tractor, truck],
        sections: all,
      };
      expect(await render({ ...props, context: "production" })).toBe(
        await render({ ...props, context: "preview" }),
      );
    });
  });

  describe("a card", () => {
    it("is a figure with the name as an h3, the note, and the caption, in that order", async () => {
      const html = await render({
        garageIntro: intro,
        garage: [tractor],
        sections: all,
      });
      expect(cards(html)).toHaveLength(1);
      const card = cards(html)[0]!;
      expect(card).toMatch(/<figcaption\b/);
      const h3 = inside(card, "h3");
      const note = inside(card, "p");
      const caption = inside(card, "small");
      expect(h3).toBe("Tractors");
      expect(note).toBe(tractor.note);
      expect(caption).toBe(tractor.caption);
      expect(card.indexOf("<h3")).toBeLessThan(card.indexOf("<p"));
      expect(card.indexOf("<p")).toBeLessThan(card.indexOf("<small"));
    });

    it("sets the name in lower case with the style, not by changing the text, so a placeholder is still one", () => {
      const component = source("./Garage.astro");
      const rule = /\.gcard h3\s*\{[^}]*\}/.exec(component)?.[0];
      expect(rule, "no .gcard h3 rule").toBeDefined();
      expect(rule).toMatch(/text-transform:\s*lowercase/);
      expect(component).not.toMatch(/toLowerCase\(\)/);
    });

    it("keeps the order of the entries it is given, one card each", async () => {
      const html = await render({
        garageIntro: intro,
        garage: [truck, tractor],
        sections: all,
      });
      expect(cards(html).map((c) => inside(c, "h3"))).toEqual([
        "Trucks",
        "Tractors",
      ]);
    });

    it("shows the caption and the note and nothing else of the entry's data: no alt text in the text", async () => {
      const html = await render({
        garageIntro: intro,
        garage: [tractor],
        sections: all,
      });
      expect(textOf(cards(html)[0]!)).toBe(
        `${tractor.name} ${tractor.note} ${tractor.caption}`,
      );
    });

    it("has a photo slot that is hidden from assistive technology and holds no image until the photos arrive", async () => {
      const html = await render({
        garageIntro: intro,
        garage: [tractor],
        sections: all,
      });
      const card = cards(html)[0]!;
      expect(card).toMatch(
        /<[a-z]+[^>]*class="gcard__photo"[^>]*aria-hidden="true"/,
      );
      expect(card).not.toContain("<img");
      expect(card).not.toContain("<a ");
    });

    it("hatches the photo slot on a preview when the photo is a placeholder, and leaves the slot's frame", async () => {
      const html = await render({
        garageIntro: intro,
        garage: [{ ...tractor, photo: "TODO: photo" }],
        sections: all,
        context: "preview",
      });
      const slot =
        /<[a-z]+[^>]*class="gcard__photo"[^>]*>.*?<\/(?:div|pre)>/.exec(
          html,
        )?.[0];
      expect(slot).toBeDefined();
      expect(textOf(slot!)).toBe("Placeholder: photo");
    });
  });

  describe("the script", () => {
    const script = () => {
      const scripts = [
        ...source("./Garage.astro").matchAll(
          /<script[^>]*>([\s\S]*?)<\/script>/g,
        ),
      ];
      expect(scripts, "exactly one <script> block").toHaveLength(1);
      expect(scripts[0]![1]!.length).toBeGreaterThan(200);
      return scripts[0]![1]!;
    };

    it("hands the loop the page's own parts: the motion preference, the tab, an intersection observer and the paint", () => {
      const code = script();
      expect(code).toMatch(/initWheel\(/);
      expect(code).toContain("prefers-reduced-motion: reduce");
      expect(code).toContain("IntersectionObserver");
      expect(code).toContain("visibilitychange");
      expect(code).toContain("requestAnimationFrame");
      expect(code).toContain("cancelAnimationFrame");
      expect(code).toMatch(/\[data-wheel\]/);
    });

    it("leaves the wheel still where the browser cannot tell when it is on screen", () => {
      // No observer means no report, which the loop reads as off-screen.
      expect(script()).toMatch(/typeof IntersectionObserver/);
    });
  });

  it("has no inline style", async () => {
    const html = await render({
      garageIntro: intro,
      garage: [tractor],
      sections: all,
    });
    expect(html).not.toMatch(/<[a-z][^>]*\sstyle\s*=/i);
  });
});
