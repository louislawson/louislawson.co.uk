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

describe("the placeholder garage entry in profile.ts", () => {
  it("is short in every part, so a hatched one fits its card instead of filling it", () => {
    const entry = profile.garage[0]!;
    // A card is a third of the page wide, and the photo slot a frame in it.
    expect(placeholderHint(entry.name).length).toBeLessThanOrEqual(24);
    expect(placeholderHint(entry.note).length).toBeLessThanOrEqual(24);
    expect(placeholderHint(entry.caption).length).toBeLessThanOrEqual(24);
    expect(placeholderHint(String(entry.photo)).length).toBeLessThanOrEqual(12);
  });
});
