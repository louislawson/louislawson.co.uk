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
