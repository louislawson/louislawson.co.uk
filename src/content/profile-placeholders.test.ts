import { describe, expect, it } from "vitest";
import { profile } from "../data/profile";
import { isPlaceholder, placeholderHint } from "./todo";

describe("the placeholder dates of the certifications in profile.ts", () => {
  it("are short, so a hatched one fits the date column instead of wrapping over lines", () => {
    // The schema's own error message gives the format (a year, or a year and month), so the
    // placeholder need not. The column holds 2025-06: eight characters at most.
    const placeholders = profile.certifications.filter((cert) =>
      isPlaceholder(cert.date),
    );
    expect(placeholders.length).toBeGreaterThan(0);
    for (const cert of placeholders) {
      expect(placeholderHint(cert.date).length).toBeLessThanOrEqual(8);
    }
  });
});

describe("the placeholder garage intro in profile.ts", () => {
  it("is short, so its hatched form stays on one line beside the figure caption", () => {
    expect(isPlaceholder(profile.garageIntro)).toBe(true);
    expect(placeholderHint(profile.garageIntro).length).toBeLessThanOrEqual(24);
  });
});

describe("the placeholders of the contact section in profile.ts", () => {
  it("are short, so a hatched one fits its button or its row instead of filling the section", () => {
    const { availability, links, region } = profile;
    expect(isPlaceholder(availability?.text)).toBe(true);
    expect(isPlaceholder(availability?.until)).toBe(true);
    expect(isPlaceholder(region)).toBe(true);
    expect(isPlaceholder(links.github)).toBe(true);
    expect(isPlaceholder(links.linkedin)).toBe(true);
    // A row of facts has half the page's width, and a button as many characters as its label.
    expect(placeholderHint(availability!.text).length).toBeLessThanOrEqual(12);
    expect(placeholderHint(availability!.until).length).toBeLessThanOrEqual(12);
    expect(placeholderHint(region).length).toBeLessThanOrEqual(12);
    expect(placeholderHint(links.github).length).toBeLessThanOrEqual(16);
    expect(placeholderHint(links.linkedin).length).toBeLessThanOrEqual(16);
  });
});

describe("the placeholder garage entries in profile.ts", () => {
  it("are one each for cars, trucks and tractors, as the surface brief says", () => {
    expect(profile.garage.map((entry) => placeholderHint(entry.name))).toEqual([
      "cars",
      "trucks",
      "tractors",
    ]);
  });

  it("are short in every part, so a hatched one fits its card instead of filling it", () => {
    for (const entry of profile.garage) {
      // A card is a third of the page wide, and the photo slot a frame in it.
      expect(placeholderHint(entry.name).length).toBeLessThanOrEqual(24);
      expect(placeholderHint(entry.note).length).toBeLessThanOrEqual(24);
      expect(placeholderHint(entry.caption).length).toBeLessThanOrEqual(24);
      expect(placeholderHint(String(entry.photo)).length).toBeLessThanOrEqual(
        12,
      );
    }
  });
});
