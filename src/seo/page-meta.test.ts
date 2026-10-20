import { describe, expect, it } from "vitest";
import { homeMeta, projectMeta } from "./page-meta";

describe("the home page's meta", () => {
  it("describes the page with the intro, and points at the home card", () => {
    expect(homeMeta({ intro: "I build and run cloud platforms." })).toEqual({
      description: "I build and run cloud platforms.",
      image: "/og/home.png",
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
});

describe("a project page's meta", () => {
  it("describes the page with the summary, and points at the project's card", () => {
    expect(projectMeta("this-website", { summary: "A static site." })).toEqual({
      description: "A static site.",
      image: "/og/projects/this-website.png",
      type: "article",
    });
  });

  it("has no description while the summary is a placeholder", () => {
    expect(
      projectMeta("r01", { summary: "TODO: one sentence on the result" })
        .description,
    ).toBe(undefined);
  });
});
