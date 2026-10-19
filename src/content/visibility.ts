import type { DeployContext } from "../config/site";
import type { Profile, Project } from "./schema";
import { containsTodo, isPlaceholder } from "./todo.ts";

// How content is shown follows the deploy context, never `launch`: local and preview builds show
// placeholders hatched so they can be found and filled in, and production leaves them out, before
// and after launch. Production leaves out the smallest unit that would otherwise look unfinished.

export type RenderDecision = "show" | "hatch" | "omit";

/**
 * What to do with one value. A hatched placeholder also carries a visually hidden "Placeholder:"
 * for screen readers; Phase 3 renders that.
 */
export function renderDecision(
  value: unknown,
  context: DeployContext,
): RenderDecision {
  if (!isPlaceholder(value)) return "show";
  return context === "production" ? "omit" : "hatch";
}

/** The values an object holds as data. An accessor is not called: see hasPlaceholder. */
function dataValues(object: object): unknown[] {
  return Object.values(Object.getOwnPropertyDescriptors(object))
    .filter((descriptor) => descriptor.enumerable && "value" in descriptor)
    .map((descriptor) => descriptor.value);
}

// An imported image's `src` is an accessor, and Astro publishes the original of an image whose `src`
// is read. Looking for a placeholder in an entry that holds one must not call it: there can be no
// placeholder in an address Astro made.
function hasPlaceholder(value: unknown): boolean {
  if (isPlaceholder(value)) return true;
  if (Array.isArray(value)) return value.some(hasPlaceholder);
  if (value !== null && typeof value === "object") {
    return dataValues(value).some(hasPlaceholder);
  }
  return false;
}

export interface ProjectLike {
  id: string;
  data: Project;
  /** The Markdown body, which no schema covers. */
  body?: string | undefined;
}

/**
 * Drops the placeholders in a project's optional parts: the organisation name, links and stack
 * items. What is left is judged as a whole by isRealProject.
 */
function withoutOptionalPlaceholders<E extends ProjectLike>(entry: E): E {
  const { org, ...rest } = entry.data;
  const data: Project = {
    ...(isPlaceholder(org) ? rest : entry.data),
    links: entry.data.links.filter((link) => !hasPlaceholder(link)),
    stack: entry.data.stack.filter((item) => !isPlaceholder(item)),
  };
  return { ...entry, data };
}

function isComplete(entry: ProjectLike): boolean {
  return (
    entry.data.stack.length > 0 &&
    !hasPlaceholder(entry.data) &&
    !(entry.body !== undefined && containsTodo(entry.body))
  );
}

/**
 * A project is real when it has no placeholder anywhere, body included, once its optional parts
 * (organisation name, links, stack items) that are still placeholders have been dropped.
 */
export function isRealProject(entry: ProjectLike): boolean {
  return isComplete(withoutOptionalPlaceholders(entry));
}

/**
 * The projects to show, in the order given. Production leaves out any project that is not real
 * and drops the placeholders from the optional parts of the rest. A featured project that is left
 * out takes its tag with it: no other project is promoted.
 */
export function visibleProjects<E extends ProjectLike>(
  entries: E[],
  context: DeployContext,
): E[] {
  if (context !== "production") return entries;
  return entries.map(withoutOptionalPlaceholders).filter(isComplete);
}

export interface VisibleProfile extends Omit<
  Profile,
  | "roleLine"
  | "intro"
  | "careerLine"
  | "region"
  | "email"
  | "cv"
  | "links"
  | "garageIntro"
> {
  roleLine?: string | undefined;
  intro?: string | undefined;
  careerLine?: string | undefined;
  region?: string | undefined;
  email?: string | undefined;
  cv?: string | undefined;
  garageIntro?: string | undefined;
  links: { github?: string | undefined; linkedin?: string | undefined };
}

const real = (value: string): string | undefined =>
  isPlaceholder(value) ? undefined : value;

/**
 * The profile to show. Production leaves out a placeholder single value; an availability
 * statement, skill row, certification or garage entry with a placeholder in a required part;
 * and placeholder tools, exploring items and verify links. `realCodes` are the projects that
 * will have a page, so a skill never links to one that is left out.
 */
export function visibleProfile(
  profile: Profile,
  realCodes: ReadonlySet<string>,
  context: DeployContext,
): VisibleProfile {
  if (context !== "production") return profile;
  return {
    ...profile,
    roleLine: real(profile.roleLine),
    intro: real(profile.intro),
    careerLine: real(profile.careerLine),
    region: real(profile.region),
    email: real(profile.email),
    cv: real(profile.cv),
    garageIntro: real(profile.garageIntro),
    links: {
      github: real(profile.links.github),
      linkedin: real(profile.links.linkedin),
    },
    availability: hasPlaceholder(profile.availability)
      ? undefined
      : profile.availability,
    skills: profile.skills.flatMap((skill) => {
      const tools = skill.tools.filter((tool) => !isPlaceholder(tool));
      if (
        isPlaceholder(skill.group) ||
        isPlaceholder(skill.context) ||
        tools.length === 0
      ) {
        return [];
      }
      return [
        { ...skill, tools, runs: skill.runs.filter((c) => realCodes.has(c)) },
      ];
    }),
    exploring: profile.exploring.filter((item) => !isPlaceholder(item)),
    certifications: profile.certifications.flatMap((cert) => {
      const { verify, ...required } = cert;
      if (hasPlaceholder(required)) return [];
      return [isPlaceholder(verify) ? required : cert];
    }),
    garage: profile.garage.filter((entry) => !hasPlaceholder(entry)),
  };
}

export type SectionId =
  "projects" | "skills" | "certifications" | "garage" | "contact";

export interface Section {
  id: SectionId;
  /** Position among the sections that are shown, from 1: the number key that jumps to it. */
  number: number;
}

/**
 * The sections that have something to show, in page order, numbered from 1. A section with
 * nothing in it disappears with its nav link, and the rest renumber. Phase 3 renders from this.
 */
export function visibleSections(
  projects: readonly unknown[],
  profile: VisibleProfile,
): Section[] {
  const hasContent: Record<SectionId, boolean> = {
    projects: projects.length > 0,
    skills: profile.skills.length > 0 || profile.exploring.length > 0,
    certifications: profile.certifications.length > 0,
    garage: profile.garage.length > 0,
    contact: Boolean(
      profile.email ||
      profile.cv ||
      profile.links.github ||
      profile.links.linkedin,
    ),
  };
  return (Object.keys(hasContent) as SectionId[])
    .filter((id) => hasContent[id])
    .map((id, index) => ({ id, number: index + 1 }));
}

/**
 * Whether the garage is on the page: it has entries and is one of the sections shown. The page
 * prepares the photos only then, and the component renders only then, by this one rule.
 */
export function garageShown(
  garage: readonly unknown[],
  sections: readonly Section[],
): boolean {
  return (
    garage.length > 0 && sections.some((section) => section.id === "garage")
  );
}

/** What the pages render: the content for one deploy context, and the sections it fills. */
export function presentSiteContent<E extends ProjectLike>(
  content: { projects: E[]; profile: Profile },
  context: DeployContext,
) {
  const projects = visibleProjects(content.projects, context);
  const realCodes = new Set(projects.map((project) => project.data.code));
  const profile = visibleProfile(content.profile, realCodes, context);
  return { projects, profile, sections: visibleSections(projects, profile) };
}
