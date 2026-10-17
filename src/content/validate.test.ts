import { describe, expect, it } from "vitest";
import { validateContent } from "./validate";

const project = (
  id: string,
  code: string,
  order: number,
  featured = false,
) => ({
  id,
  data: { code, order, featured },
});

const good = [
  project("one", "R01", 1, true),
  project("two", "R02", 2),
  project("three", "R03", 3),
];

const profile = (runs: string[][] = [["R01"], ["R02", "R03"], []]) => ({
  skills: runs.map((r, i) => ({ group: `Group ${i + 1}`, runs: r })),
});

describe("validateContent", () => {
  it("returns nothing when the content is consistent", () => {
    expect(validateContent(good, profile())).toEqual([]);
  });

  describe("featured", () => {
    it("reports no featured project", () => {
      const projects = good.map((p) => ({
        ...p,
        data: { ...p.data, featured: false },
      }));
      const [problem] = validateContent(projects, profile());
      expect(problem).toContain("exactly one featured project");
      expect(problem).toContain("none");
    });

    it("reports more than one, naming each file", () => {
      const projects = [good[0]!, project("two", "R02", 2, true), good[2]!];
      const found = validateContent(projects, profile());
      expect(found).toHaveLength(1);
      expect(found[0]).toContain("exactly one featured project");
      expect(found[0]).toContain("one");
      expect(found[0]).toContain("two");
    });
  });

  describe("code", () => {
    it("reports a duplicate code, naming the files that share it", () => {
      const projects = [good[0]!, project("copy", "R01", 4), good[2]!];
      const found = validateContent(projects, profile([["R01"]]));
      expect(found).toHaveLength(1);
      expect(found[0]).toContain("R01");
      expect(found[0]).toContain("one");
      expect(found[0]).toContain("copy");
    });
  });

  describe("order", () => {
    it("reports a duplicate order, naming the files that share it", () => {
      const projects = [good[0]!, project("also-two", "R04", 2), good[1]!];
      const found = validateContent(projects, profile([["R01"]]));
      expect(found).toHaveLength(1);
      expect(found[0]).toContain("order 2");
      expect(found[0]).toContain("also-two");
      expect(found[0]).toContain("two");
    });
  });

  describe("skill runs", () => {
    it("reports a run that no project has, naming the skill", () => {
      const found = validateContent(good, profile([["R01"], ["R09"]]));
      expect(found).toHaveLength(1);
      expect(found[0]).toContain("Group 2");
      expect(found[0]).toContain("R09");
    });

    it("reports each missing run", () => {
      const found = validateContent(good, profile([["R08", "R09"]]));
      expect(found.join("\n")).toContain("R08");
      expect(found.join("\n")).toContain("R09");
    });
  });

  it("reports every problem at once, not just the first", () => {
    const projects = [project("one", "R01", 1), project("two", "R01", 1)];
    const found = validateContent(projects, profile([["R09"]]));
    // no featured, duplicate code, duplicate order, missing run
    expect(found).toHaveLength(4);
  });
});
