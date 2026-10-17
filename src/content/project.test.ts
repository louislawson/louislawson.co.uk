import { describe, expect, it } from "vitest";
import { projectSchema } from "./schema";

const base = {
  code: "R01",
  title: "Landing zone",
  summary: "One line about the result.",
  headline: "Weeks to hours",
  status: "complete",
  period: "2024 – 2025",
  featured: false,
  order: 1,
  setup: "Where it started.",
  change: "What was done.",
  result: "What changed.",
  stack: ["Terraform"],
  links: [],
};

const work = { ...base, kind: "work", descriptor: "A UK public-sector body" };
const personal = { ...base, kind: "personal", org: "My own project" };

function without<T extends object>(input: T, key: string): Partial<T> {
  return Object.fromEntries(
    Object.entries(input).filter(([name]) => name !== key),
  ) as Partial<T>;
}

/** Messages and paths of every issue, so a test can assert the field is named. */
function problems(input: unknown): string[] {
  const result = projectSchema.safeParse(input);
  return result.success
    ? []
    : result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
}

describe("a project", () => {
  it("accepts a complete work project", () => {
    expect(problems(work)).toEqual([]);
  });

  it("accepts a complete personal and open-source project", () => {
    expect(problems(personal)).toEqual([]);
    expect(problems({ ...personal, kind: "open-source" })).toEqual([]);
  });

  it("lets a personal project leave out org", () => {
    expect(problems(without(personal, "org"))).toEqual([]);
  });

  describe("kind", () => {
    it("requires an anonymised descriptor on a work project", () => {
      expect(problems(without(work, "descriptor")).join("\n")).toContain(
        "descriptor",
      );
    });

    it("forbids org on a work project, so an employer cannot be named", () => {
      const found = problems({ ...work, org: "Some Employer Ltd" });
      expect(found.join("\n")).toContain("org");
    });

    it("forbids descriptor on personal and open-source projects", () => {
      expect(
        problems({ ...personal, descriptor: "A UK body" }).join("\n"),
      ).toContain("descriptor");
      expect(
        problems({
          ...personal,
          kind: "open-source",
          descriptor: "A UK body",
        }).join("\n"),
      ).toContain("descriptor");
    });

    it("rejects an unknown kind, naming the field", () => {
      expect(problems({ ...work, kind: "client" }).join("\n")).toContain(
        "kind",
      );
    });
  });

  describe("code", () => {
    it("is R and two digits", () => {
      for (const code of ["R1", "R100", "r01", "X01", "R0a", " R01"]) {
        expect(problems({ ...work, code }).join("\n"), code).toContain("code");
      }
    });

    it("never accepts a placeholder, because it identifies the project", () => {
      expect(problems({ ...work, code: "TODO: R05" }).join("\n")).toContain(
        "code",
      );
    });
  });

  describe("headline", () => {
    it("is 2 to 5 words", () => {
      expect(problems({ ...work, headline: "Weeks" }).join("\n")).toContain(
        "headline",
      );
      expect(
        problems({ ...work, headline: "One two three four five six" }).join(
          "\n",
        ),
      ).toContain("headline");
      expect(problems({ ...work, headline: "Two words" })).toEqual([]);
      expect(
        problems({ ...work, headline: "One two three four five" }),
      ).toEqual([]);
    });

    it("counts words, not the spaces around them", () => {
      expect(problems({ ...work, headline: "  Two   words  " })).toEqual([]);
      expect(
        problems({ ...work, headline: "   Word   " }).join("\n"),
      ).toContain("headline");
    });

    it("accepts a placeholder of any length", () => {
      expect(
        problems({
          ...work,
          headline: "TODO: write a short headline for this project",
        }),
      ).toEqual([]);
    });
  });

  describe("status", () => {
    it("is one of the four known states", () => {
      for (const status of [
        "in-service",
        "commissioning",
        "complete",
        "archived",
      ]) {
        expect(problems({ ...work, status }), status).toEqual([]);
      }
      expect(problems({ ...work, status: "live" }).join("\n")).toContain(
        "status",
      );
    });

    it("accepts a placeholder", () => {
      expect(problems({ ...work, status: "TODO: current status" })).toEqual([]);
    });
  });

  describe("order and featured", () => {
    it("takes a positive whole number for order", () => {
      for (const order of [0, -1, 1.5, "1"]) {
        expect(
          problems({ ...work, order }).join("\n"),
          String(order),
        ).toContain("order");
      }
    });

    it("takes a boolean for featured", () => {
      expect(problems({ ...work, featured: "yes" }).join("\n")).toContain(
        "featured",
      );
    });
  });

  describe("text fields", () => {
    it("rejects an empty title, summary, period, setup, change or result", () => {
      for (const field of [
        "title",
        "summary",
        "period",
        "setup",
        "change",
        "result",
      ]) {
        expect(problems({ ...work, [field]: "" }).join("\n"), field).toContain(
          field,
        );
      }
    });

    it("accepts a placeholder in each", () => {
      const placeholders = Object.fromEntries(
        ["title", "summary", "period", "setup", "change", "result"].map(
          (field) => [field, `TODO: ${field}`],
        ),
      );
      expect(problems({ ...work, ...placeholders })).toEqual([]);
    });
  });

  describe("stack", () => {
    it("needs at least one tool", () => {
      expect(problems({ ...work, stack: [] }).join("\n")).toContain("stack");
    });

    it("accepts a placeholder entry", () => {
      expect(problems({ ...work, stack: ["TODO: tools used"] })).toEqual([]);
    });
  });

  describe("links", () => {
    it("takes http and https URLs", () => {
      expect(
        problems({
          ...work,
          links: [{ label: "Source", url: "https://github.com/example/repo" }],
        }),
      ).toEqual([]);
    });

    it("rejects javascript: and other non-http URLs", () => {
      for (const url of [
        "javascript:alert(1)",
        "data:text/html,hi",
        "mailto:a@example.com",
        "ftp://example.com",
        "not a url",
      ]) {
        expect(
          problems({ ...work, links: [{ label: "x", url }] }).join("\n"),
          url,
        ).toContain("links");
      }
    });

    it("accepts a placeholder URL", () => {
      expect(
        problems({
          ...work,
          links: [{ label: "Source", url: "TODO: link to the source" }],
        }),
      ).toEqual([]);
    });

    it("defaults to no links", () => {
      const parsed = projectSchema.parse(without(work, "links"));
      expect(parsed.links).toEqual([]);
    });
  });

  describe("measurements", () => {
    const measurement = { label: "Time to environment", before: "3 weeks" };

    it("are optional", () => {
      expect(problems(work)).toEqual([]);
    });

    it("take a label and before, and optionally after and unit", () => {
      expect(problems({ ...work, measurements: [measurement] })).toEqual([]);
      expect(
        problems({
          ...work,
          measurements: [{ ...measurement, after: "1 hour", unit: "elapsed" }],
        }),
      ).toEqual([]);
    });

    it("need a label and a before value", () => {
      expect(
        problems({ ...work, measurements: [{ before: "3" }] }).join("\n"),
      ).toContain("measurements.0.label");
      expect(
        problems({ ...work, measurements: [{ label: "x" }] }).join("\n"),
      ).toContain("measurements.0.before");
    });

    it("never accept a placeholder: a measurement is real or absent", () => {
      for (const field of ["label", "before", "after", "unit"]) {
        const found = problems({
          ...work,
          measurements: [{ ...measurement, [field]: "TODO: real figure" }],
        });
        expect(found.join("\n"), field).toContain(`measurements.0.${field}`);
      }
    });
  });

  describe("unexpected fields", () => {
    it("rejects slug, which Astro would use to rename the entry", () => {
      expect(problems({ ...work, slug: "custom" }).join("\n")).toContain(
        "slug",
      );
    });

    it("rejects a misspelt field instead of dropping it silently", () => {
      expect(problems({ ...work, measurments: [] }).join("\n")).toContain(
        "measurments",
      );
    });
  });
});
