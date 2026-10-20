import { describe, expect, it } from "vitest";
import { homeMeta, projectMeta } from "./page-meta";

describe("the home page's meta", () => {
  it("describes the page with the intro, and points at the home card with its alt text", () => {
    expect(
      homeMeta({
        intro: "I build and run cloud platforms.",
        roleLine: "Cloud engineer",
      }),
    ).toEqual({
      description: "I build and run cloud platforms.",
      image: "/og/home.png",
      imageAlt: "Louis Lawson · Cloud engineer",
      type: "website",
    });
  });

  it("has no description while the intro is a placeholder or left out", () => {
    expect(homeMeta({ intro: "TODO: a short introduction" }).description).toBe(
      undefined,
    );
    expect(homeMeta({}).description).toBe(undefined);
    expect(homeMeta({ intro: undefined }).image).toBe("/og/home.png");
  });

  it("names the card by the name alone while the role line is a placeholder", () => {
    expect(homeMeta({ roleLine: "TODO: role line" }).imageAlt).toBe(
      "Louis Lawson",
    );
    expect(homeMeta({}).imageAlt).toBe("Louis Lawson");
  });
});

const project = {
  summary: "A static site.",
  code: "R04",
  title: "This website",
  headline: "Pipeline-built, pipeline-deployed",
  status: "commissioning",
} as const;

describe("a project page's meta", () => {
  it("describes the page with the summary, and points at the project's card with its alt text", () => {
    expect(projectMeta("this-website", project)).toEqual({
      description: "A static site.",
      image: "/og/projects/this-website.png",
      imageAlt: "R04 · This website · Pipeline-built, pipeline-deployed",
      type: "article",
    });
  });

  it("has no description while the summary is a placeholder", () => {
    expect(
      projectMeta("r01", {
        ...project,
        summary: "TODO: one sentence on the result",
      }).description,
    ).toBe(undefined);
  });

  it("names the card by the code alone while everything else is a placeholder", () => {
    expect(
      projectMeta("r01", {
        summary: "TODO: s",
        code: "R01",
        title: "TODO: t",
        headline: "TODO: h",
        status: "TODO: status",
      }).imageAlt,
    ).toBe("R01");
  });
});
