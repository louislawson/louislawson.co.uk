import { describe, expect, it } from "vitest";
import type { Project } from "../../content/schema";
import {
  STRIP_LIMIT,
  countLabel,
  metaParts,
  projectLayout,
  statusLabel,
} from "./project-display";

/** The fields of a project that these functions read. */
const base = {
  code: "R01",
  title: "A title",
  summary: "A summary.",
  headline: "A short result",
  status: "complete",
  period: "2024 – 2025",
  featured: false,
  order: 1,
  setup: "Setup.",
  change: "Change.",
  result: "Result.",
  stack: ["A tool"],
  links: [] as Project["links"],
};

const work = (descriptor: string): Project => ({
  ...base,
  kind: "work",
  descriptor,
});
const personal = (org?: string): Project => ({
  ...base,
  kind: "personal",
  ...(org === undefined ? {} : { org }),
});
const openSource = (org?: string): Project => ({
  ...base,
  kind: "open-source",
  ...(org === undefined ? {} : { org }),
});

describe("projectLayout", () => {
  it("is strips for 3 projects or fewer", () => {
    expect(STRIP_LIMIT).toBe(3);
    for (const count of [0, 1, 2, 3]) {
      expect(projectLayout(count), String(count)).toBe("strip");
    }
  });

  it("is compact rows for 4 projects or more", () => {
    for (const count of [4, 5, 12]) {
      expect(projectLayout(count), String(count)).toBe("row");
    }
  });
});

describe("metaParts", () => {
  it("is the descriptor and the period for a work project", () => {
    expect(metaParts(work("A UK financial-services organisation"))).toEqual({
      lead: "A UK financial-services organisation",
      period: "2024 – 2025",
    });
  });

  it("is the organisation and the period for a personal project that has one", () => {
    expect(metaParts(personal("A named club"))).toEqual({
      lead: "A named club",
      period: "2024 – 2025",
    });
  });

  it("is the organisation and the period for an open-source project that has one", () => {
    expect(metaParts(openSource("A named foundation"))).toEqual({
      lead: "A named foundation",
      period: "2024 – 2025",
    });
  });

  it("says personal project when a personal project has no organisation", () => {
    expect(metaParts(personal())).toEqual({
      lead: "personal project",
      period: "2024 – 2025",
    });
  });

  it("says open-source project when an open-source project has no organisation", () => {
    expect(metaParts(openSource())).toEqual({
      lead: "open-source project",
      period: "2024 – 2025",
    });
  });

  it("passes a placeholder through as it is, for the hatch to show", () => {
    expect(metaParts(work("TODO: anonymised descriptor")).lead).toBe(
      "TODO: anonymised descriptor",
    );
    expect(metaParts({ ...personal(), period: "TODO: period" }).period).toBe(
      "TODO: period",
    );
    // A placeholder organisation is shown as one, not replaced by the default.
    expect(metaParts(personal("TODO: organisation")).lead).toBe(
      "TODO: organisation",
    );
  });
});

describe("statusLabel", () => {
  it("is the word the status is shown as", () => {
    expect(statusLabel("in-service")).toBe("in service");
    expect(statusLabel("commissioning")).toBe("commissioning");
    expect(statusLabel("complete")).toBe("complete");
    expect(statusLabel("archived")).toBe("archived");
  });
});

describe("countLabel", () => {
  it("is the count in brackets, to two digits", () => {
    expect(countLabel(2)).toBe("(02)");
    expect(countLabel(9)).toBe("(09)");
    expect(countLabel(12)).toBe("(12)");
  });
});
