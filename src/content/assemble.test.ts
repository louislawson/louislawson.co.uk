import { describe, expect, it } from "vitest";
import { assembleSiteContent } from "./assemble";

const entry = (id: string, code: string, order: number, featured = false) => ({
  id,
  data: { code, order, featured },
});

const projects = [
  entry("third", "R03", 3),
  entry("first", "R01", 1, true),
  entry("second", "R02", 2),
];

const profile = (availability?: { text: string; until: string }) => ({
  skills: [{ group: "Platform", runs: ["R01"] }],
  availability,
});

const now = new Date("2026-10-17T12:00:00Z");

describe("assembleSiteContent", () => {
  it("returns the projects sorted by order, whatever order they arrive in", () => {
    const content = assembleSiteContent(projects, profile(), now);
    expect(content.projects.map((p) => p.id)).toEqual([
      "first",
      "second",
      "third",
    ]);
  });

  it("throws one error that counts and lists every problem", () => {
    const bad = [entry("a", "R01", 1), entry("b", "R01", 1)];
    expect(() => assembleSiteContent(bad, profile(), now)).toThrow(
      /3 problems:\n- .*\n- .*\n- /,
    );
    expect(() => assembleSiteContent(bad, profile(), now)).toThrow(/featured/);
  });

  describe("availability", () => {
    it("is kept while its date has not passed", () => {
      const statement = { text: "Open to work", until: "2026-12-31" };
      const content = assembleSiteContent(projects, profile(statement), now);
      expect(content.profile.availability).toBe(statement);
    });

    it("is dropped once its date has passed", () => {
      const statement = { text: "Open to work", until: "2026-10-16" };
      const content = assembleSiteContent(projects, profile(statement), now);
      expect(content.profile.availability).toBeUndefined();
    });

    it("is undefined when the profile has none", () => {
      const content = assembleSiteContent(projects, profile(), now);
      expect(content.profile.availability).toBeUndefined();
    });
  });
});
