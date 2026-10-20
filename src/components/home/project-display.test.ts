import { describe, expect, it } from "vitest";
import type { Project } from "../../content/schema";
import {
  STRIP_LIMIT,
  countLabel,
  featuredFirst,
  metaParts,
  pageTitle,
  projectLayout,
  projectPages,
  projectPath,
  statusLabel,
  writeUpKind,
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

describe("featuredFirst", () => {
  /** An entry with only what the ordering reads. */
  const entry = (code: string, order: number, featured = false) => ({
    id: code.toLowerCase(),
    data: { code, order, featured },
  });
  const codes = (list: { data: { code: string } }[]) =>
    list.map((e) => e.data.code);

  it("puts the featured project first, even when it is third by order", () => {
    const list = [entry("R01", 1), entry("R02", 2), entry("R03", 3, true)];
    expect(codes(featuredFirst(list))).toEqual(["R03", "R01", "R02"]);
  });

  it("keeps the rest in order after it", () => {
    const list = [
      entry("R01", 1),
      entry("R02", 2, true),
      entry("R03", 3),
      entry("R04", 4),
    ];
    expect(codes(featuredFirst(list))).toEqual(["R02", "R01", "R03", "R04"]);
  });

  it("leaves a featured project that is already first where it is", () => {
    const list = [entry("R01", 1, true), entry("R02", 2), entry("R03", 3)];
    expect(codes(featuredFirst(list))).toEqual(["R01", "R02", "R03"]);
  });

  it("keeps the order when no project is featured", () => {
    // Production can have none: the featured project may be left out as a placeholder.
    const list = [entry("R01", 1), entry("R02", 2), entry("R04", 4)];
    expect(codes(featuredFirst(list))).toEqual(["R01", "R02", "R04"]);
  });

  it("orders by `order` whatever order the list arrives in", () => {
    const list = [entry("R04", 4), entry("R02", 2), entry("R03", 3, true)];
    expect(codes(featuredFirst(list))).toEqual(["R03", "R02", "R04"]);
  });

  it("is an empty list for an empty list", () => {
    expect(featuredFirst([])).toEqual([]);
  });

  it("returns a new list and leaves the one it was given as it was", () => {
    const list = [entry("R01", 1), entry("R02", 2, true)];
    const before = codes(list);
    const result = featuredFirst(list);
    expect(codes(list)).toEqual(before);
    expect(result).not.toBe(list);
    // The entries themselves are the same objects, not copies.
    expect(result[0]).toBe(list[1]);
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

/** An entry as the collection holds it: an id (the file name) and the data these functions read. */
const entry = (id: string, order: number, featured = false) => ({
  id,
  data: { ...work("A descriptor"), code: `R0${order}`, order, featured },
});

describe("projectPath", () => {
  it("is the page's address: the file name under /projects/, with the trailing slash", () => {
    expect(projectPath("this-website")).toBe("/projects/this-website/");
  });
});

describe("the next project, as each page gets it", () => {
  const list = [
    entry("a", 1),
    entry("b", 2),
    entry("c", 3),
    entry("d", 4, true),
  ];
  /** The file name of the project the page for `id` links on to. */
  const nextOf = (projects: typeof list, id: string) =>
    projectPages(projects).find((page) => page.params.slug === id)!.props.next
      ?.id;

  it("is the next in the home page's order, which leads with the featured project", () => {
    // The home page's order is d, a, b, c.
    expect(nextOf(list, "d")).toBe("a");
    expect(nextOf(list, "a")).toBe("b");
    expect(nextOf(list, "b")).toBe("c");
  });

  it("wraps from the last to the first", () => {
    expect(nextOf(list, "c")).toBe("d");
  });

  it("wraps in `order` when no project is featured", () => {
    const plain = [entry("b", 2), entry("a", 1)];
    expect(nextOf(plain, "b")).toBe("a");
    expect(nextOf(plain, "a")).toBe("b");
  });

  it("does not depend on the order the projects arrive in", () => {
    expect(nextOf([...list].reverse(), "d")).toBe("a");
    expect(nextOf([...list].reverse(), "c")).toBe("d");
  });

  it("is nothing when the project is the only one, so it never links to itself", () => {
    expect(nextOf([entry("a", 1)] as typeof list, "a")).toBeUndefined();
  });
});

describe("pageTitle", () => {
  it("is the project's title and the site's name", () => {
    expect(pageTitle({ title: "This website", code: "R04" })).toBe(
      "This website · Louis Lawson",
    );
  });

  it("names the code when the title is still a placeholder, which a tab cannot hatch", () => {
    expect(pageTitle({ title: "TODO: project title", code: "R01" })).toBe(
      "R01 · Louis Lawson",
    );
  });
});

describe("projectPages", () => {
  it("is one page per project, at its file name, with the project that follows it", () => {
    const pages = projectPages([entry("a", 1), entry("b", 2)]);
    expect(pages.map((page) => page.params.slug)).toEqual(["a", "b"]);
    expect(pages[0]!.props.project.id).toBe("a");
    expect(pages[0]!.props.next?.id).toBe("b");
    expect(pages[1]!.props.next?.id).toBe("a");
  });

  it("has no next link for a single project, and no page for none", () => {
    expect(projectPages([entry("a", 1)])[0]!.props.next).toBeUndefined();
    expect(projectPages([])).toEqual([]);
  });
});

describe("writeUpKind", () => {
  it("is none for a body with nothing in it, so the page has no heading over nothing", () => {
    expect(writeUpKind(undefined)).toEqual({ kind: "none" });
    expect(writeUpKind("")).toEqual({ kind: "none" });
    expect(writeUpKind("  \n\n ")).toEqual({ kind: "none" });
  });

  it("is a placeholder for a body that is wholly one, naming the text to hatch", () => {
    expect(
      writeUpKind("TODO: write the run sheet for this project.\n"),
    ).toEqual({
      kind: "placeholder",
      text: "TODO: write the run sheet for this project.",
    });
  });

  it("is prose for anything else, a half-finished body included, which the preview shows as written", () => {
    expect(writeUpKind("### Context\n\nWords.\n")).toEqual({ kind: "prose" });
    expect(writeUpKind("Words.\n\nTODO: more\n")).toEqual({ kind: "prose" });
    // A placeholder that goes on into more paragraphs is more than a placeholder.
    expect(writeUpKind("TODO: start\n\nMore words.\n")).toEqual({
      kind: "prose",
    });
  });
});
