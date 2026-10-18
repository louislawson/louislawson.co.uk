import type { SectionId } from "../content/visibility";

/** What each section is called where it is linked: the navigation and the 404 page. */
export const SECTION_LABELS: Record<SectionId, string> = {
  projects: "projects",
  skills: "skills",
  certifications: "certs",
  garage: "garage",
  contact: "contact",
};

/** Links go to the home page, so the same link works from a project page or the 404. */
export function sectionHref(id: SectionId): string {
  return `/#${id}`;
}
