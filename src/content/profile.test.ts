import { describe, expect, it } from "vitest";
import { parseProfile, profileSchema } from "./schema";

const photo = {
  src: "/_astro/car.abc123.jpg",
  width: 800,
  height: 600,
  format: "jpg",
};

const valid = {
  roleLine: "Cloud and DevOps engineer",
  intro: "An intro.",
  careerLine: "Ten years in two sectors.",
  region: "North West England",
  availability: { text: "Open to contract work", until: "2026-12-31" },
  email: "hello@louislawson.co.uk",
  links: {
    github: "https://github.com/example",
    linkedin: "https://www.linkedin.com/in/example",
  },
  cv: "/cv.pdf",
  skills: [
    {
      group: "Platform",
      context: "Running platforms on Azure.",
      tools: ["Azure"],
      runs: ["R01"],
    },
  ],
  exploring: ["Platform engineering"],
  certifications: [
    { title: "A certification", issuer: "An issuer", date: "2025-06" },
  ],
  garage: [
    {
      name: "Cars",
      note: "A note.",
      photo,
      alt: "A car at a show.",
      caption: "Event, vehicle.",
    },
  ],
};

function problems(input: unknown): string[] {
  const result = profileSchema.safeParse(input);
  return result.success
    ? []
    : result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
}

/** Sets a value at a dotted path on a copy of the valid profile. */
function withValue(path: string, value: unknown): unknown {
  const copy = structuredClone(valid) as Record<string, unknown>;
  const keys = path.split(".");
  let target = copy;
  for (const key of keys.slice(0, -1)) {
    target = target[key] as Record<string, unknown>;
  }
  target[keys[keys.length - 1]!] = value;
  return copy;
}

describe("the profile", () => {
  it("accepts a complete profile", () => {
    expect(problems(valid)).toEqual([]);
  });

  it("accepts a placeholder in every field that can be unknown", () => {
    const placeholder = "TODO: not supplied yet";
    const allPlaceholders = {
      roleLine: placeholder,
      intro: placeholder,
      careerLine: placeholder,
      region: placeholder,
      availability: { text: placeholder, until: placeholder },
      email: placeholder,
      links: { github: placeholder, linkedin: placeholder },
      cv: placeholder,
      skills: [
        {
          group: placeholder,
          context: placeholder,
          tools: [placeholder],
          runs: [],
        },
      ],
      exploring: [placeholder],
      certifications: [
        {
          title: placeholder,
          issuer: placeholder,
          date: placeholder,
          verify: placeholder,
        },
      ],
      garage: [
        {
          name: placeholder,
          note: placeholder,
          photo: placeholder,
          alt: placeholder,
          caption: placeholder,
        },
      ],
    };
    expect(problems(allPlaceholders)).toEqual([]);
  });

  describe("links", () => {
    it("take http and https URLs", () => {
      expect(problems(withValue("links.github", "http://example.com"))).toEqual(
        [],
      );
    });

    it("reject javascript: and other schemes, which z.url() would accept", () => {
      for (const url of [
        "javascript:alert(1)",
        "data:text/plain,x",
        "ftp://example.com",
      ]) {
        expect(
          problems(withValue("links.linkedin", url)).join("\n"),
          url,
        ).toContain("links.linkedin");
      }
    });
  });

  describe("email", () => {
    it("must be an email address", () => {
      expect(problems(withValue("email", "not an email")).join("\n")).toContain(
        "email",
      );
    });
  });

  describe("cv", () => {
    it("is the fixed path /cv.pdf", () => {
      expect(problems(withValue("cv", "/cv.pdf"))).toEqual([]);
    });

    it("is nothing else", () => {
      for (const cv of ["/other.pdf", "https://example.com/cv.pdf", "cv.pdf"]) {
        expect(problems(withValue("cv", cv)).join("\n"), cv).toContain("cv");
      }
    });
  });

  describe("availability.until", () => {
    it("is an ISO calendar date", () => {
      expect(problems(withValue("availability.until", "2026-02-28"))).toEqual(
        [],
      );
    });

    it("rejects other date forms and impossible dates", () => {
      for (const until of [
        "31/12/2026",
        "2026-12",
        "2026-02-30",
        "2026-12-31T00:00:00Z",
        "tomorrow",
      ]) {
        expect(
          problems(withValue("availability.until", until)).join("\n"),
          until,
        ).toContain("availability.until");
      }
    });
  });

  describe("certification date", () => {
    it("is YYYY or YYYY-MM, kept as written", () => {
      for (const date of ["2025", "2025-06", "2025-12"]) {
        expect(
          problems(withValue("certifications.0.date", date)),
          date,
        ).toEqual([]);
      }
      const parsed = profileSchema.parse(
        withValue("certifications.0.date", "2025-06"),
      );
      expect(parsed.certifications[0]?.date).toBe("2025-06");
    });

    it("rejects any other form", () => {
      for (const date of [
        "25",
        "2025-6",
        "2025-13",
        "2025-00",
        "2025-06-01",
        "June 2025",
      ]) {
        expect(
          problems(withValue("certifications.0.date", date)).join("\n"),
          date,
        ).toContain("certifications.0.date");
      }
    });

    it("takes an optional verify link that is http(s)", () => {
      expect(
        problems(
          withValue("certifications.0.verify", "https://example.com/verify"),
        ),
      ).toEqual([]);
      expect(
        problems(
          withValue("certifications.0.verify", "javascript:alert(1)"),
        ).join("\n"),
      ).toContain("certifications.0.verify");
    });
  });

  describe("skills", () => {
    it("refer to projects by code", () => {
      expect(problems(withValue("skills.0.runs", ["R1"])).join("\n")).toContain(
        "skills.0.runs.0",
      );
    });

    it("may have no runs", () => {
      expect(problems(withValue("skills.0.runs", []))).toEqual([]);
    });
  });

  describe("garage", () => {
    it("takes an imported image or a placeholder for the photo", () => {
      expect(
        problems(withValue("garage.0.photo", "TODO: event photo")),
      ).toEqual([]);
    });

    it("rejects a plain path in place of an imported image", () => {
      expect(
        problems(withValue("garage.0.photo", "/photos/car.jpg")).join("\n"),
      ).toContain("garage.0.photo");
    });
  });

  describe("unexpected fields", () => {
    it("rejects a field that is not part of the profile", () => {
      expect(problems(withValue("phone", "07000 000000")).join("\n")).toContain(
        "phone",
      );
    });
  });
});

describe("parseProfile", () => {
  it("returns the profile when it is valid", () => {
    expect(parseProfile(valid).email).toBe("hello@louislawson.co.uk");
  });

  it("throws one error that names the file and every bad field", () => {
    const bad = withValue("links.github", "javascript:alert(1)") as Record<
      string,
      unknown
    >;
    bad.email = "nope";
    expect(() => parseProfile(bad)).toThrow(/src\/data\/profile\.ts/);
    try {
      parseProfile(bad);
    } catch (error) {
      expect(String(error)).toContain("links.github");
      expect(String(error)).toContain("email");
    }
  });
});
