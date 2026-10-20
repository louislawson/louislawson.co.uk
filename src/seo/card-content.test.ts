import { describe, expect, it } from "vitest";
import type { Project } from "../content/schema";
import { cardPath, homeCard, projectCard } from "./card-content";

const real: Pick<Project, "code" | "title" | "headline" | "status"> = {
  code: "R04",
  title: "This website",
  headline: "Pipeline-built, pipeline-deployed",
  status: "commissioning",
};

describe("the home card", () => {
  it("carries the name, the role line and the address", () => {
    expect(homeCard({ roleLine: "Cloud and DevOps engineer" })).toEqual({
      kind: "home",
      brand: "louis.lawson",
      name: ["Louis", "Lawson"],
      role: "Cloud and DevOps engineer",
      address: "louislawson.co.uk/",
    });
  });

  it("leaves the role line off while it is a placeholder, and when production has none", () => {
    expect(homeCard({ roleLine: "TODO: role line" }).role).toBeUndefined();
    expect(homeCard({}).role).toBeUndefined();
    expect(homeCard({ roleLine: undefined }).role).toBeUndefined();
  });

  it("still names the person when everything else is missing", () => {
    expect(homeCard({}).name).toEqual(["Louis", "Lawson"]);
  });
});

describe("a project card", () => {
  it("carries the code, title, headline, status and the page's address", () => {
    expect(projectCard("this-website", real)).toEqual({
      kind: "project",
      brand: "louis.lawson",
      code: "R04",
      title: "This website",
      headline: "Pipeline-built, pipeline-deployed",
      status: { key: "commissioning", label: "commissioning" },
      address: "louislawson.co.uk/projects/this-website/",
    });
  });

  it("says a status as the site does", () => {
    expect(projectCard("a", { ...real, status: "in-service" }).status).toEqual({
      key: "in-service",
      label: "in service",
    });
  });

  it("leaves off each value that is a placeholder, and keeps the rest", () => {
    const card = projectCard("r01-placeholder", {
      code: "R01",
      title: "TODO: project title",
      headline: "TODO: a headline of two to five words",
      status: "TODO: status",
    });
    expect(card.code).toBe("R01");
    expect(card.title).toBeUndefined();
    expect(card.headline).toBeUndefined();
    expect(card.status).toBeUndefined();
    expect(card.address).toBe("louislawson.co.uk/projects/r01-placeholder/");
  });

  it("leaves off one placeholder and not the others", () => {
    const card = projectCard("x", { ...real, headline: "TODO: headline" });
    expect(card.title).toBe("This website");
    expect(card.headline).toBeUndefined();
    expect(card.status?.key).toBe("commissioning");
  });

  it("never carries the word TODO in any text", () => {
    const card = projectCard("x", {
      code: "R02",
      title: "TODO: t",
      headline: "TODO: h",
      status: "TODO: s",
    });
    expect(JSON.stringify(card)).not.toMatch(/todo/i);
  });
});

describe("where the cards are published", () => {
  it("puts the home card and each project's card under /og/", () => {
    expect(cardPath.home).toBe("/og/home.png");
    expect(cardPath.project("this-website")).toBe(
      "/og/projects/this-website.png",
    );
  });
});
