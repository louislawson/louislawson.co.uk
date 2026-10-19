import { describe, expect, it } from "vitest";
import { placeholder, profileData, projectEntry } from "./__fixtures__/content";
import {
  isRealProject,
  presentSiteContent,
  renderDecision,
  visibleProfile,
  visibleProjects,
  visibleSections,
} from "./visibility";

const contexts = ["local", "preview", "production"] as const;

describe("renderDecision", () => {
  it("shows a real value in every context", () => {
    for (const context of contexts) {
      expect(renderDecision("A real title", context), context).toBe("show");
    }
  });

  it("hatches a placeholder on local and preview builds", () => {
    expect(renderDecision(placeholder, "local")).toBe("hatch");
    expect(renderDecision(placeholder, "preview")).toBe("hatch");
  });

  it("omits a placeholder from production", () => {
    expect(renderDecision(placeholder, "production")).toBe("omit");
  });

  it("shows an imported image, which is not a placeholder", () => {
    const image = { src: "/a.jpg", width: 1, height: 1, format: "jpg" };
    expect(renderDecision(image, "production")).toBe("show");
  });
});

describe("a real project", () => {
  it("has no placeholder in a required field and none in the body", () => {
    expect(isRealProject(projectEntry("a"))).toBe(true);
  });

  it("is not real with a placeholder in a required field", () => {
    for (const field of [
      "title",
      "summary",
      "headline",
      "status",
      "period",
      "setup",
      "change",
      "result",
      "descriptor",
    ]) {
      expect(
        isRealProject(projectEntry("a", { [field]: placeholder })),
        field,
      ).toBe(false);
    }
  });

  it("is not real when the body has a TODO, a TODOs or a todo anywhere", () => {
    for (const body of [
      "TODO: write this",
      "Prose.\n\nStill TODOs here.",
      "todo write the result",
    ]) {
      expect(isRealProject(projectEntry("a", {}, body)), body).toBe(false);
    }
  });

  it("is judged on its fields alone when the entry has no body", () => {
    expect(isRealProject({ ...projectEntry("a"), body: undefined })).toBe(true);
  });

  it("stays real when only an optional field is a placeholder", () => {
    expect(
      isRealProject(
        projectEntry("a", {
          kind: "personal",
          descriptor: undefined,
          org: placeholder,
        }),
      ),
    ).toBe(true);
    expect(
      isRealProject(
        projectEntry("a", { links: [{ label: "Source", url: placeholder }] }),
      ),
    ).toBe(true);
  });

  it("is not real when every stack item is a placeholder", () => {
    expect(isRealProject(projectEntry("a", { stack: [placeholder] }))).toBe(
      false,
    );
  });
});

describe("visibleProjects", () => {
  const real = projectEntry("real", { code: "R01", order: 1, featured: true });
  const draft = projectEntry("draft", {
    code: "R02",
    order: 2,
    title: placeholder,
  });
  const alsoReal = projectEntry("also-real", { code: "R03", order: 3 });

  it("keeps every project, placeholders and all, on local and preview builds", () => {
    for (const context of ["local", "preview"] as const) {
      expect(
        visibleProjects([real, draft, alsoReal], context).map((p) => p.id),
        context,
      ).toEqual(["real", "draft", "also-real"]);
    }
  });

  it("leaves a project that has a placeholder out of production, keeping the order", () => {
    expect(
      visibleProjects([real, draft, alsoReal], "production").map((p) => p.id),
    ).toEqual(["real", "also-real"]);
  });

  it("leaves out a project whose body has a TODO", () => {
    const unfinished = projectEntry(
      "unfinished",
      { code: "R04", order: 4 },
      "TODOs below",
    );
    expect(
      visibleProjects([real, unfinished], "production").map((p) => p.id),
    ).toEqual(["real"]);
  });

  it("drops just an optional field that is a placeholder, and keeps the project", () => {
    const entry = projectEntry("named", {
      kind: "personal",
      descriptor: undefined,
      org: placeholder,
    });
    const [kept] = visibleProjects([entry], "production");
    expect(kept?.id).toBe("named");
    expect(kept?.data).not.toHaveProperty("org");
  });

  it("drops a link with a placeholder label or URL and keeps the others", () => {
    const entry = projectEntry("linked", {
      links: [
        { label: "Source", url: "https://github.com/example/repo" },
        { label: "Write-up", url: placeholder },
        { label: placeholder, url: "https://example.com" },
      ],
    });
    const [kept] = visibleProjects([entry], "production");
    expect(kept?.data.links).toEqual([
      { label: "Source", url: "https://github.com/example/repo" },
    ]);
  });

  it("drops a placeholder stack item and keeps the real ones", () => {
    const entry = projectEntry("stacked", {
      stack: ["Terraform", placeholder, "Azure"],
    });
    const [kept] = visibleProjects([entry], "production");
    expect(kept?.data.stack).toEqual(["Terraform", "Azure"]);
  });

  it("leaves a real project untouched, including its measurements and body", () => {
    const entry = projectEntry("measured", {
      measurements: [{ label: "Time", before: "3 wk", after: "1 hr" }],
    });
    const [kept] = visibleProjects([entry], "production");
    expect(kept).toEqual(entry);
  });

  describe("featured", () => {
    it("keeps the tag on a real featured project", () => {
      const [first] = visibleProjects([real, alsoReal], "production");
      expect(first?.data.featured).toBe(true);
    });

    it("shows no featured tag, and promotes no other project, when the featured one is a placeholder", () => {
      const featuredDraft = projectEntry("featured-draft", {
        code: "R01",
        order: 1,
        featured: true,
        title: placeholder,
      });
      const shown = visibleProjects([featuredDraft, alsoReal], "production");
      expect(shown.map((p) => p.id)).toEqual(["also-real"]);
      expect(shown.some((p) => p.data.featured)).toBe(false);
    });

    it("still shows the featured placeholder on a preview", () => {
      const featuredDraft = projectEntry("featured-draft", {
        featured: true,
        title: placeholder,
      });
      const [shown] = visibleProjects([featuredDraft], "preview");
      expect(shown?.data.featured).toBe(true);
    });
  });
});

describe("visibleProfile", () => {
  const allReal = new Set(["R01"]);

  it("is the profile unchanged on local and preview builds", () => {
    const profile = profileData({
      intro: placeholder,
      email: placeholder,
      exploring: [placeholder],
    });
    for (const context of ["local", "preview"] as const) {
      expect(visibleProfile(profile, allReal, context), context).toEqual(
        profile,
      );
    }
  });

  describe("a garage entry's imported photo", () => {
    // Astro publishes the original of an image it sees used, and reading an imported image's `src`
    // is how it sees that. Looking for placeholders in an entry must not read it.
    function trackedPhoto(onSrcRead: () => void) {
      const imported = { width: 800, height: 600, format: "jpg" };
      Object.defineProperty(imported, "src", {
        enumerable: true,
        get() {
          onSrcRead();
          return "/_astro/car.abc123.jpg";
        },
      });
      return imported;
    }
    const entry = (photo: unknown) => ({
      name: "Cars",
      note: "A note.",
      photo,
      alt: "A car at a show.",
      caption: "Event, vehicle.",
    });

    it("is not read for its address when production looks for placeholders", () => {
      let reads = 0;
      const photo = trackedPhoto(() => reads++);
      const view = visibleProfile(
        profileData({ garage: [entry(photo)] }),
        allReal,
        "production",
      );
      expect(view.garage).toHaveLength(1);
      expect(view.garage[0]?.photo).toBe(photo);
      expect(reads).toBe(0);
    });

    it("does not stop an entry with a placeholder in another part from being left out", () => {
      let reads = 0;
      const view = visibleProfile(
        profileData({
          garage: [{ ...entry(trackedPhoto(() => reads++)), alt: placeholder }],
        }),
        allReal,
        "production",
      );
      expect(view.garage).toEqual([]);
      expect(reads).toBe(0);
    });
  });

  describe("in production", () => {
    it("omits a placeholder single value and keeps a real one", () => {
      const view = visibleProfile(
        profileData({
          roleLine: placeholder,
          intro: "A real intro.",
          careerLine: placeholder,
          region: placeholder,
          email: "hello@louislawson.co.uk",
          cv: placeholder,
          garageIntro: placeholder,
          links: {
            github: placeholder,
            linkedin: "https://www.linkedin.com/in/x",
          },
        }),
        allReal,
        "production",
      );
      expect(view.garageIntro).toBeUndefined();
      expect(view.roleLine).toBeUndefined();
      expect(view.intro).toBe("A real intro.");
      expect(view.careerLine).toBeUndefined();
      expect(view.region).toBeUndefined();
      expect(view.email).toBe("hello@louislawson.co.uk");
      expect(view.cv).toBeUndefined();
      expect(view.links.github).toBeUndefined();
      expect(view.links.linkedin).toBe("https://www.linkedin.com/in/x");
    });

    it("keeps a real garage intro", () => {
      expect(
        visibleProfile(
          profileData({ garageIntro: "Cars, trucks and tractors." }),
          allReal,
          "production",
        ).garageIntro,
      ).toBe("Cars, trucks and tractors.");
    });

    it("keeps a real cv path", () => {
      expect(visibleProfile(profileData(), allReal, "production").cv).toBe(
        "/cv.pdf",
      );
    });

    it("drops availability when either part is a placeholder", () => {
      for (const availability of [
        { text: placeholder, until: "2099-12-31" },
        { text: "Open to work", until: placeholder },
      ]) {
        expect(
          visibleProfile(profileData({ availability }), allReal, "production")
            .availability,
        ).toBeUndefined();
      }
      expect(
        visibleProfile(profileData(), allReal, "production").availability,
      ).toEqual({ text: "Open to contract work", until: "2099-12-31" });
    });

    describe("skills", () => {
      const skill = (overrides: Record<string, unknown> = {}) => ({
        group: "Platform",
        context: "Running platforms on Azure.",
        tools: ["Azure"],
        runs: ["R01"],
        ...overrides,
      });

      it("drops a row whose group or context is a placeholder", () => {
        const view = visibleProfile(
          profileData({
            skills: [
              skill({ group: placeholder }),
              skill({ context: placeholder }),
              skill({ group: "Delivery" }),
            ],
          }),
          allReal,
          "production",
        );
        expect(view.skills.map((s) => s.group)).toEqual(["Delivery"]);
      });

      it("drops placeholder tools, and the row if none are left", () => {
        const view = visibleProfile(
          profileData({
            skills: [
              skill({ tools: ["Azure", placeholder] }),
              skill({ group: "Empty", tools: [placeholder] }),
            ],
          }),
          allReal,
          "production",
        );
        expect(view.skills).toHaveLength(1);
        expect(view.skills[0]?.tools).toEqual(["Azure"]);
      });

      it("links only to projects that are real, and still shows the row without a link", () => {
        const view = visibleProfile(
          profileData({ skills: [skill({ runs: ["R01", "R02"] })] }),
          new Set(["R01"]),
          "production",
        );
        expect(view.skills[0]?.runs).toEqual(["R01"]);

        const none = visibleProfile(
          profileData({ skills: [skill({ runs: ["R02"] })] }),
          new Set(["R01"]),
          "production",
        );
        expect(none.skills[0]?.runs).toEqual([]);
      });
    });

    it("drops placeholder exploring items", () => {
      const view = visibleProfile(
        profileData({ exploring: ["Platform engineering", placeholder] }),
        allReal,
        "production",
      );
      expect(view.exploring).toEqual(["Platform engineering"]);
    });

    describe("certifications", () => {
      const cert = (overrides: Record<string, unknown> = {}) => ({
        title: "A certification",
        issuer: "An issuer",
        date: "2025-06",
        ...overrides,
      });

      it("drops an entry whose title, issuer or date is a placeholder", () => {
        const view = visibleProfile(
          profileData({
            certifications: [
              cert({ title: placeholder }),
              cert({ issuer: placeholder }),
              cert({ date: placeholder }),
              cert(),
            ],
          }),
          allReal,
          "production",
        );
        expect(view.certifications).toHaveLength(1);
      });

      it("drops just a placeholder verify link and keeps the entry", () => {
        const view = visibleProfile(
          profileData({ certifications: [cert({ verify: placeholder })] }),
          allReal,
          "production",
        );
        expect(view.certifications).toHaveLength(1);
        expect(view.certifications[0]).not.toHaveProperty("verify");
      });
    });

    it("drops a garage entry with a placeholder in any field", () => {
      const photo = { src: "/a.jpg", width: 1, height: 1, format: "jpg" };
      const entry = (overrides: Record<string, unknown> = {}) => ({
        name: "Cars",
        note: "A note.",
        photo,
        alt: "A car.",
        caption: "Event, vehicle.",
        ...overrides,
      });
      const view = visibleProfile(
        profileData({
          garage: [
            entry({ name: placeholder }),
            entry({ note: placeholder }),
            entry({ photo: placeholder }),
            entry({ alt: placeholder }),
            entry({ caption: placeholder }),
            entry(),
          ],
        }),
        allReal,
        "production",
      );
      expect(view.garage).toHaveLength(1);
    });
  });
});

describe("visibleSections", () => {
  const projects = [projectEntry("a")];
  const profile = profileData();

  it("lists the five sections in order, numbered from 1", () => {
    expect(visibleSections(projects, profile)).toEqual([
      { id: "projects", number: 1 },
      { id: "skills", number: 2 },
      { id: "certifications", number: 3 },
      { id: "garage", number: 4 },
      { id: "contact", number: 5 },
    ]);
  });

  it("drops an empty section and renumbers the rest", () => {
    expect(
      visibleSections(projects, { ...profile, certifications: [] }),
    ).toEqual([
      { id: "projects", number: 1 },
      { id: "skills", number: 2 },
      { id: "garage", number: 3 },
      { id: "contact", number: 4 },
    ]);
  });

  it("drops every empty section at once", () => {
    expect(
      visibleSections([], {
        ...profile,
        skills: [],
        exploring: [],
        certifications: [],
        garage: [],
      }),
    ).toEqual([{ id: "contact", number: 1 }]);
  });

  it("keeps skills when only the exploring list has items, and the reverse", () => {
    expect(
      visibleSections(projects, { ...profile, skills: [] }).map((s) => s.id),
    ).toContain("skills");
    expect(
      visibleSections(projects, { ...profile, exploring: [] }).map((s) => s.id),
    ).toContain("skills");
    expect(
      visibleSections(projects, { ...profile, skills: [], exploring: [] }).map(
        (s) => s.id,
      ),
    ).not.toContain("skills");
  });

  it("keeps contact while any one way to get in touch remains", () => {
    const bare = { ...profile, email: undefined, cv: undefined, links: {} };
    expect(visibleSections(projects, bare).map((s) => s.id)).not.toContain(
      "contact",
    );
    for (const way of [
      { email: "hello@louislawson.co.uk" },
      { cv: "/cv.pdf" as const },
      { links: { github: "https://github.com/example" } },
      { links: { linkedin: "https://www.linkedin.com/in/example" } },
    ]) {
      expect(
        visibleSections(projects, { ...bare, ...way }).map((s) => s.id),
      ).toContain("contact");
    }
  });
});

describe("presentSiteContent", () => {
  const content = {
    projects: [
      projectEntry("real", { code: "R01", order: 1, featured: true }),
      projectEntry("draft", { code: "R02", order: 2, title: placeholder }),
    ],
    profile: profileData({
      skills: [
        {
          group: "Platform",
          context: "Running platforms on Azure.",
          tools: ["Azure"],
          runs: ["R01", "R02"],
        },
      ],
      certifications: [
        { title: placeholder, issuer: "An issuer", date: "2025" },
      ],
    }),
  };

  it("in production leaves out placeholders, links only real projects and drops empty sections", () => {
    const view = presentSiteContent(content, "production");
    expect(view.projects.map((p) => p.id)).toEqual(["real"]);
    expect(view.profile.skills[0]?.runs).toEqual(["R01"]);
    expect(view.sections.map((s) => s.id)).toEqual([
      "projects",
      "skills",
      "garage",
      "contact",
    ]);
  });

  it("on a preview keeps everything, so a placeholder can be seen and filled in", () => {
    const view = presentSiteContent(content, "preview");
    expect(view.projects.map((p) => p.id)).toEqual(["real", "draft"]);
    expect(view.profile.skills[0]?.runs).toEqual(["R01", "R02"]);
    expect(view.sections.map((s) => s.id)).toContain("certifications");
  });
});
