import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { REPOSITORY_URL } from "../config/site";
import { SECTION_LABELS, sectionHref } from "./section-labels";

describe("section labels", () => {
  it("name each section as the navigation does", () => {
    expect(SECTION_LABELS).toEqual({
      projects: "projects",
      skills: "skills",
      certifications: "certs",
      garage: "garage",
      contact: "contact",
    });
  });

  it("link to the section on the home page, so they work from any page", () => {
    expect(sectionHref("projects")).toBe("/#projects");
    expect(sectionHref("certifications")).toBe("/#certifications");
  });
});

describe("the repository link", () => {
  it("is the one the This website project records", () => {
    const project = readFileSync(
      new URL("../content/projects/this-website.md", import.meta.url),
      "utf-8",
    );
    expect(REPOSITORY_URL).toBe(
      "https://github.com/louislawson/louislawson.co.uk",
    );
    expect(project).toContain(REPOSITORY_URL);
  });
});
