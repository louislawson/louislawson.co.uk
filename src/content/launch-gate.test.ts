import { describe, expect, it } from "vitest";
import { placeholder, profileData, projectEntry } from "./__fixtures__/content";
import { launchGateProblems } from "./launch-gate";

const projects = [
  projectEntry("first", { code: "R01", order: 1, featured: true }),
  projectEntry("second", { code: "R02", order: 2 }),
];

const content = (overrides: Record<string, unknown> = {}) => ({
  projects,
  profile: profileData(overrides),
});

describe("launchGateProblems", () => {
  it("passes when the required set is complete", () => {
    expect(launchGateProblems(content(), { cvFileExists: true })).toEqual([]);
  });

  it("needs only the required set: GitHub, availability and the rest may stay placeholders", () => {
    expect(
      launchGateProblems(
        content({
          region: placeholder,
          availability: { text: placeholder, until: placeholder },
          links: {
            github: placeholder,
            linkedin: "https://www.linkedin.com/in/example",
          },
          exploring: [placeholder],
          certifications: [],
        }),
        { cvFileExists: true },
      ),
    ).toEqual([]);
  });

  describe("the profile", () => {
    it.each([
      ["intro", "intro"],
      ["careerLine", "career line"],
      ["roleLine", "role line"],
      ["email", "email"],
    ])("reports a placeholder %s", (field, name) => {
      const found = launchGateProblems(content({ [field]: placeholder }), {
        cvFileExists: true,
      });
      expect(found).toHaveLength(1);
      expect(found[0]).toContain(name);
    });

    it("reports a placeholder LinkedIn link", () => {
      const found = launchGateProblems(
        content({
          links: {
            github: "https://github.com/example",
            linkedin: placeholder,
          },
        }),
        { cvFileExists: true },
      );
      expect(found).toHaveLength(1);
      expect(found[0]).toContain("LinkedIn");
    });
  });

  describe("the CV", () => {
    it("reports a cv field that is still a placeholder", () => {
      const found = launchGateProblems(content({ cv: placeholder }), {
        cvFileExists: true,
      });
      expect(found).toHaveLength(1);
      expect(found[0]).toContain("cv");
    });

    it("reports a real cv field when public/cv.pdf does not exist", () => {
      const found = launchGateProblems(content(), { cvFileExists: false });
      expect(found).toHaveLength(1);
      expect(found[0]).toContain("public/cv.pdf");
    });
  });

  describe("projects", () => {
    it("needs at least two real projects", () => {
      const found = launchGateProblems(
        { projects: [projects[0]!], profile: profileData() },
        { cvFileExists: true },
      );
      expect(found).toHaveLength(1);
      expect(found[0]).toContain("two real projects");
      expect(found[0]).toContain("1");
    });

    it("does not count a project with a placeholder or a TODO in its body", () => {
      const found = launchGateProblems(
        {
          projects: [
            projects[0]!,
            projectEntry("draft", {
              code: "R02",
              order: 2,
              title: placeholder,
            }),
            projectEntry("unfinished", { code: "R03", order: 3 }, "TODOs left"),
          ],
          profile: profileData(),
        },
        { cvFileExists: true },
      );
      expect(found).toHaveLength(1);
      expect(found[0]).toContain("two real projects");
    });

    it("needs the featured project to be real", () => {
      const found = launchGateProblems(
        {
          projects: [
            projectEntry("first", {
              code: "R01",
              order: 1,
              featured: true,
              title: placeholder,
            }),
            projectEntry("second", { code: "R02", order: 2 }),
            projectEntry("third", { code: "R03", order: 3 }),
          ],
          profile: profileData(),
        },
        { cvFileExists: true },
      );
      expect(found).toHaveLength(1);
      expect(found[0]).toContain("featured");
    });
  });

  it("reports every problem at once", () => {
    const found = launchGateProblems(
      {
        projects: [
          projectEntry("only", { featured: true, title: placeholder }),
        ],
        profile: profileData({
          intro: placeholder,
          roleLine: placeholder,
          careerLine: placeholder,
          email: placeholder,
          cv: placeholder,
          links: { github: placeholder, linkedin: placeholder },
        }),
      },
      { cvFileExists: false },
    );
    // intro, role line, career line, two real projects, featured, email, LinkedIn, cv
    expect(found).toHaveLength(8);
  });
});
