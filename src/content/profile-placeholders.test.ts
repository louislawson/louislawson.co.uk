import { describe, expect, it } from "vitest";
import { profile } from "../data/profile";
import { isPlaceholder, placeholderHint } from "./todo";

// These hold profile.ts's placeholders to a size that fits where a preview hatches them. Louis
// replaces them with real content over time, so each rule applies to whatever is still a
// placeholder and says nothing about real values, which the schema and the page's own tests cover.

/** Expects a value that is still a placeholder to have a hint of at most `max` characters. */
function expectShortIfPlaceholder(
  value: string | undefined,
  max: number,
  name: string,
): void {
  if (value === undefined || !isPlaceholder(value)) return;
  expect(placeholderHint(value).length, name).toBeLessThanOrEqual(max);
}

describe("a placeholder length check", () => {
  // The rules below pass on real values by design, so this keeps the check itself honest.
  it("fails a long placeholder, and passes a short one and any real value", () => {
    expect(() =>
      expectShortIfPlaceholder("TODO: far too long a hint", 8, "long"),
    ).toThrow();
    expect(() =>
      expectShortIfPlaceholder("TODO: date", 8, "short"),
    ).not.toThrow();
    expect(() =>
      expectShortIfPlaceholder("a real value that is much longer", 8, "real"),
    ).not.toThrow();
    expect(() =>
      expectShortIfPlaceholder(undefined, 8, "absent"),
    ).not.toThrow();
  });
});

describe("the placeholder dates of the certifications in profile.ts", () => {
  it("are short, so a hatched one fits the date column instead of wrapping over lines", () => {
    // The schema's own error message gives the format (a year, or a year and month), so the
    // placeholder need not. The column holds 2025-06: eight characters at most.
    for (const cert of profile.certifications) {
      expectShortIfPlaceholder(cert.date, 8, cert.title);
    }
  });
});

describe("the placeholder garage intro in profile.ts", () => {
  it("is short, so its hatched form stays on one line beside the figure caption", () => {
    expectShortIfPlaceholder(profile.garageIntro, 24, "garageIntro");
  });
});

describe("the placeholders of the contact section in profile.ts", () => {
  it("are short, so a hatched one fits its button or its row instead of filling the section", () => {
    const { availability, links, region } = profile;
    // A row of facts has half the page's width, and a button as many characters as its label.
    expectShortIfPlaceholder(availability?.text, 12, "availability.text");
    expectShortIfPlaceholder(availability?.until, 12, "availability.until");
    expectShortIfPlaceholder(region, 12, "region");
    expectShortIfPlaceholder(links.github, 16, "links.github");
    expectShortIfPlaceholder(links.linkedin, 16, "links.linkedin");
  });
});

describe("the placeholder garage entries in profile.ts", () => {
  it("are one each for cars, trucks and tractors while the whole garage is placeholders, as the surface brief says", () => {
    if (!profile.garage.every((entry) => isPlaceholder(entry.name))) return;
    expect(profile.garage.map((entry) => placeholderHint(entry.name))).toEqual([
      "cars",
      "trucks",
      "tractors",
    ]);
  });

  it("are short in every part, so a hatched one fits its card instead of filling it", () => {
    for (const entry of profile.garage) {
      // A card is a third of the page wide, and the photo slot a frame in it.
      expectShortIfPlaceholder(entry.name, 24, "name");
      expectShortIfPlaceholder(entry.note, 24, "note");
      expectShortIfPlaceholder(entry.caption, 24, "caption");
      expectShortIfPlaceholder(
        typeof entry.photo === "string" ? entry.photo : undefined,
        12,
        "photo",
      );
    }
  });
});
