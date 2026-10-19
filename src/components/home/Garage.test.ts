import { readFileSync } from "node:fs";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { describe, expect, it } from "vitest";
import type { Section } from "../../content/visibility";
import { placeholderDither } from "../../garage/dither";
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
//
// A real photo has been dithered by the page before the component sees it, so unless a test says
// otherwise each real photo is given a stand-in dither and address of its own.
async function renderRaw(props: Record<string, unknown>): Promise<string> {
  const garage = props.garage as { photo: unknown }[] | undefined;
  const withPhotos =
    props.photos === undefined && garage !== undefined
      ? {
          ...props,
          photos: garage.map((entry, index) =>
            typeof entry.photo === "string"
              ? undefined
              : {
                  dither: `dither ${index}\n`,
                  href: `/_astro/photo-${index}.webp`,
                },
          ),
        }
      : props;
  const container = await AstroContainer.create();
  const html = await container.renderToString(Garage, { props: withPhotos });
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
      const noteAt = card.search(/<p[\s>]/);
      expect(card.indexOf("<h3")).toBeLessThan(noteAt);
      expect(noteAt).toBeLessThan(card.indexOf("<small"));
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
      // Not the dither, which is a picture and is hidden from assistive technology.
      expect(textOf(cards(html)[0]!.replace(/<pre\b.*?<\/pre>/g, ""))).toBe(
        `${tractor.name} ${tractor.note} ${tractor.caption}`,
      );
    });
  });

  describe("a card's photo", () => {
    const withPhoto = {
      garageIntro: intro,
      garage: [tractor],
      sections: all,
      photos: [
        { dither: "#=- \n -=#\n", href: "/_astro/tractor.def456_Z1.webp" },
      ],
    };

    it("is a link to the optimised photo, in the same tab, that holds the dither", async () => {
      const html = await render(withPhoto);
      const link = /<a\b[^>]*class="gcard__photo"[^>]*>.*?<\/a>/.exec(
        html,
      )?.[0];
      expect(link, "no photo link").toBeDefined();
      expect(link).toContain('href="/_astro/tractor.def456_Z1.webp"');
      expect(link).toContain("data-photo");
      expect(link).not.toContain("target=");
      expect(link).toMatch(/<pre\b[^>]*aria-hidden="true"/);
      expect(html.match(/<a\b/g)).toHaveLength(1);
    });

    it("holds the dither exactly, every space and line break of it", async () => {
      const html = await renderRaw(withPhoto);
      const pre =
        /<pre\b[^>]*aria-hidden="true"[^>]*>(#=- \n -=#\n)<\/pre>/.exec(
          html.slice(html.indexOf('class="gcard"')),
        );
      expect(pre, "the dither is not in the card as given").not.toBeNull();
    });

    it("is named by the photo's alt on the link, which has no other text to name it", async () => {
      const html = await render(withPhoto);
      const link = /<a\b[^>]*class="gcard__photo"[^>]*>/.exec(html)![0];
      expect(link).toContain('aria-label="A tractor at a show."');
    });

    it("names a placeholder alt as one, so a preview never says TODO", async () => {
      const html = await render({
        ...withPhoto,
        garage: [{ ...tractor, alt: "TODO: describe the photo" }],
        context: "preview",
      });
      expect(html).toContain('aria-label="Placeholder: describe the photo"');
      expect(html).not.toContain("TODO:");
    });

    it("loads no photo with the page: there is no image, no source and no preload, and no data URL", async () => {
      const html = await render(withPhoto);
      expect(html).not.toContain("<img");
      expect(html).not.toContain("<picture");
      expect(html).not.toContain("srcset");
      expect(html).not.toContain("data:");
      expect(html).not.toMatch(/rel="(?:preload|prefetch)"/);
      // The optimised photo's address is in the page once: as the link's destination.
      expect(html.match(/tractor\.def456_Z1\.webp/g)).toHaveLength(1);
    });

    it("gives each card the photo of its own entry, in order", async () => {
      const html = await render({
        ...withPhoto,
        garage: [tractor, truck],
        photos: [
          { dither: "one\n", href: "/_astro/one.webp" },
          { dither: "two\n", href: "/_astro/two.webp" },
        ],
      });
      const [first, second] = cards(html);
      expect(first).toContain('href="/_astro/one.webp"');
      expect(first).toContain('aria-label="A tractor at a show."');
      expect(second).toContain('href="/_astro/two.webp"');
      expect(second).toContain('aria-label="A truck at a meet."');
    });

    it("stops the build when a real photo has not been prepared, rather than showing a blank card", async () => {
      await expect(
        render({ ...withPhoto, photos: [undefined] }),
      ).rejects.toThrow(/Tractors/);
    });

    it("stops the build for a photo that is neither a prepared image nor a placeholder, rather than showing a blank card", async () => {
      await expect(
        render({
          ...withPhoto,
          garage: [{ ...tractor, photo: "/photos/tractor.jpg" }],
          photos: [],
        }),
      ).rejects.toThrow(/Tractors/);
    });

    it("gives the swapped-in photo a background of its own, so a transparent photo does not show the dither through it", () => {
      const rule = /\.gcard__photo :global\(img\)\s*\{[^}]*\}/.exec(
        source("./Garage.astro"),
      )?.[0];
      expect(rule, "no rule for the photo's image").toBeDefined();
      expect(rule).toMatch(/background:\s*var\(--panel\)/);
    });

    it("is dithered by the page only for cards that are shown, and processed for every photo in every build", () => {
      const page = source("../../pages/index.astro");
      // Always called, never behind the shown rule: Astro publishes the original of a photo that
      // nothing processes, and a card is left out while its entry has a placeholder in it.
      expect(page).toMatch(/await garagePhotos\(/);
      expect(page).not.toMatch(
        /garageShown\([^)]*\)\s*\?\s*await garagePhotos\(/,
      );
      // Given the shown entries (the one rule the component renders by, in visibility.ts, not a
      // copy of it) and every entry of the whole profile.
      expect(page).toMatch(
        /garageShown\([^)]*\)\s*\?\s*profile\.garage\s*:\s*\[\]/,
      );
      expect(page).toMatch(
        /import \{ profile as fullProfile \} from "\.\.\/data\/profile"/,
      );
      expect(page).toMatch(/fullProfile\.garage/);
      expect(source("./Garage.astro")).toMatch(/garageShown\(/);
    });

    it("is the same in preview and production when the photo is real", async () => {
      expect(await render({ ...withPhoto, context: "production" })).toBe(
        await render({ ...withPhoto, context: "preview" }),
      );
    });

    describe("when the photo is a placeholder", () => {
      const missing = {
        garageIntro: intro,
        garage: [
          { ...tractor, photo: "TODO: photo" },
          { ...truck, photo: "TODO: photo" },
        ],
        sections: all,
        photos: [undefined, undefined],
      };

      it.each(["preview", "local"])(
        "shows a designed empty state on a %s build: a dithered stand-in with the hatched placeholder over it, and no link",
        async (context) => {
          const html = await render({ ...missing, context });
          const [first, second] = cards(html);
          expect(first).toMatch(/class="gcard__photo gcard__photo--empty"/);
          expect(first).not.toContain("<a ");
          expect(first).not.toContain("<img");
          expect(
            textOf(
              /<span\b[^>]*class="gcard__label".*?<\/span><\/span>/.exec(
                first,
              )![0],
            ),
          ).toBe("Placeholder: photo");
          const dither = (card: string | undefined) =>
            /<pre\b[^>]*aria-hidden="true"[^>]*>(.*?)<\/pre>/.exec(card!)?.[1];
          expect(dither(first)).toBeDefined();
          // The stand-in is the text a placeholder gives, a different one on each card.
          const raw = await renderRaw({ ...missing, context });
          expect(raw).toContain(placeholderDither(1));
          expect(raw).toContain(placeholderDither(2));
          expect(dither(first)).not.toBe(dither(second));
        },
      );

      it("is an empty, hidden frame on production, with nothing of the placeholder in it", async () => {
        const html = await render({ ...missing, context: "production" });
        for (const card of cards(html)) {
          expect(card).toMatch(/class="gcard__photo"[^>]*aria-hidden="true"/);
          expect(card).not.toContain("<pre");
          expect(card).not.toContain("Placeholder");
        }
        expect(html).not.toContain("TODO:");
      });
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

    it("gives each photo link the swap's own rules, fed by the pointer, the keyboard and the click", () => {
      const code = script();
      expect(code).toContain("swapStep");
      expect(code).toMatch(/\[data-photo\]/);
      for (const event of [
        "pointerenter",
        "pointerleave",
        "pointerdown",
        "pointercancel",
        "focus",
        "blur",
        "click",
      ]) {
        expect(code, event).toContain(`"${event}"`);
      }
      expect(code).toContain("preventDefault");
    });

    it("makes the photo's image only when the rules say to load it, with the link's address and the link's name as its alt", () => {
      const code = script();
      // The one place an image is made is inside the branch the rules open.
      expect(code.match(/createElement\("img"\)/g)).toHaveLength(1);
      expect(code).toMatch(/if \(step\.load\)[\s\S]*createElement\("img"\)/);
      expect(code).toMatch(/\.src\s*=\s*link\.href/);
      expect(code).toMatch(/\.alt\s*=\s*link\.getAttribute\("aria-label"\)/);
    });

    it("tells the rules about the keyboard, about a press elsewhere on the page, and what kind of click it is", () => {
      const code = script();
      expect(code).toContain('"keydown"');
      expect(code).toContain('"outside"');
      expect(code).toMatch(
        /pointerType:\s*\(event as PointerEvent\)\.pointerType/,
      );
    });

    it("listens on the page once for all the cards, not once for each", () => {
      const code = script();
      expect(code.match(/document\.addEventListener\("keydown"/g)).toHaveLength(
        1,
      );
      expect(
        code.match(/document\.addEventListener\("pointerup"/g),
      ).toHaveLength(1);
    });

    it("lets a pinned photo go when a press ends elsewhere, and not when one begins, so a scroll does not release it", () => {
      const code = script();
      expect(code).toContain('"pointerup"');
      expect(code).not.toMatch(/document\.addEventListener\("pointerdown"/);
    });

    // What the image's load and failure mean (visible only once loaded; tried again only when
    // wanted afresh) is the rules' and is tested in photo-swap.test.ts; this holds the script to
    // reporting them and doing what the rules say.
    it("tells the rules when the photo's image loads or fails, and shows it only when they say it is visible", () => {
      const code = script();
      expect(code).toMatch(/created\.addEventListener\("load"/);
      expect(code).toContain('feed({ type: "photoload" })');
      expect(code).toMatch(/created\.addEventListener\("error"/);
      expect(code).toContain('feed({ type: "photoerror" })');
      expect(code).toMatch(/image\.hidden\s*=\s*!step\.visible/);
    });

    it("takes the photo's image away if it fails to load, and keeps no copy of the rules' state", () => {
      const code = script();
      expect(code).toMatch(/created\.remove\(\)/);
      expect(code).not.toMatch(/loaded:\s*(?:true|false)/);
      expect(code).not.toMatch(/\blet (?:showing|ready)\b/);
    });

    it("does no image processing in the browser", () => {
      expect(script()).not.toMatch(
        /canvas|getImageData|createImageBitmap|OffscreenCanvas|ImageData|toDataURL/i,
      );
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
