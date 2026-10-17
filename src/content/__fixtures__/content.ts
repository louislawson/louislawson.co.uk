import {
  profileSchema,
  projectSchema,
  type Profile,
  type Project,
} from "../schema";

export interface TestEntry {
  id: string;
  data: Project;
  body?: string;
}

const photo = {
  src: "/_astro/car.abc123.jpg",
  width: 800,
  height: 600,
  format: "jpg",
};

/** A complete, real work project. Overrides replace whole fields; the result is schema-checked. */
export function projectData(overrides: Record<string, unknown> = {}): Project {
  return projectSchema.parse({
    code: "R01",
    title: "Landing zone",
    summary: "One line about the result.",
    headline: "Weeks to hours",
    status: "complete",
    period: "2024 – 2025",
    featured: false,
    order: 1,
    kind: "work",
    descriptor: "A UK public-sector body",
    setup: "Where it started.",
    change: "What was done.",
    result: "What changed.",
    stack: ["Terraform"],
    ...overrides,
  });
}

export function projectEntry(
  id: string,
  overrides: Record<string, unknown> = {},
  body = "A real write-up.",
): TestEntry {
  return { id, data: projectData(overrides), body };
}

/** A complete, real profile. Overrides replace whole fields; the result is schema-checked. */
export function profileData(overrides: Record<string, unknown> = {}): Profile {
  return profileSchema.parse({
    roleLine: "Cloud and DevOps engineer",
    intro: "An intro.",
    careerLine: "Ten years in two sectors.",
    region: "North West England",
    availability: { text: "Open to contract work", until: "2099-12-31" },
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
    ...overrides,
  });
}

export const placeholder = "TODO: not supplied yet";
