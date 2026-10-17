import { describe, expect, it } from "vitest";
import { currentAvailability } from "./availability";

const availability = (until: string) => ({ text: "Open to work", until });

describe("currentAvailability", () => {
  it("keeps the statement until the end of the `until` day, UK time (winter)", () => {
    const a = availability("2026-12-31");
    expect(currentAvailability(a, new Date("2026-12-31T23:59:59Z"))).toBe(a);
    expect(
      currentAvailability(a, new Date("2027-01-01T00:00:00Z")),
    ).toBeUndefined();
  });

  it("keeps the statement until the end of the `until` day, UK time (summer)", () => {
    // British Summer Time is UTC+1, so the UK day ends an hour before the UTC day.
    const a = availability("2026-07-15");
    expect(currentAvailability(a, new Date("2026-07-15T22:59:59Z"))).toBe(a);
    expect(
      currentAvailability(a, new Date("2026-07-15T23:00:00Z")),
    ).toBeUndefined();
  });

  it("keeps a statement whose date is in the future", () => {
    const a = availability("2027-03-01");
    expect(currentAvailability(a, new Date("2026-10-17T12:00:00Z"))).toBe(a);
  });

  it("drops a statement whose date is long past", () => {
    expect(
      currentAvailability(
        availability("2025-01-01"),
        new Date("2026-10-17T12:00:00Z"),
      ),
    ).toBeUndefined();
  });

  it("does not expire a placeholder date, which the placeholder rules handle", () => {
    const a = availability("TODO: date this statement stops being true");
    expect(currentAvailability(a, new Date("2030-01-01T00:00:00Z"))).toBe(a);
  });
});
