import type { Project } from "../../content/schema";

/** Up to this many projects are shown in full, as strips; more are compact rows. */
export const STRIP_LIMIT = 3;

export type ProjectLayout = "strip" | "row";

export function projectLayout(count: number): ProjectLayout {
  return count <= STRIP_LIMIT ? "strip" : "row";
}

/**
 * The projects in the order the section shows them: the featured one first, then the rest by
 * `order`. The contract has the featured run lead the list, which `order` alone would only do
 * while the featured project happened to be the first. A build can have no featured project
 * (production leaves a placeholder one out and promotes no other), and then this is `order`
 * alone. It returns a new list, and the entries themselves are the ones it was given.
 */
export function featuredFirst<
  E extends { data: { featured: boolean; order: number } },
>(projects: readonly E[]): E[] {
  return [...projects].sort(
    (a, b) =>
      Number(b.data.featured) - Number(a.data.featured) ||
      a.data.order - b.data.order,
  );
}

/**
 * The two halves of a project's meta line. A work project says what kind of organisation it was
 * for, which is anonymised. A personal or open-source project names its organisation when it has
 * one, and otherwise says what kind of project it is. Either half may be a placeholder, which
 * the page shows hatched.
 */
export function metaParts(data: Project): { lead: string; period: string } {
  const lead =
    data.kind === "work"
      ? data.descriptor
      : (data.org ??
        (data.kind === "personal"
          ? "personal project"
          : "open-source project"));
  return { lead, period: data.period };
}

/** The word a status is shown as. A placeholder never gets here: <Status> hatches it instead. */
export function statusLabel(status: string): string {
  return status === "in-service" ? "in service" : status;
}

/** The number of projects shown, as the heading carries it: "(02)". */
export function countLabel(count: number): string {
  return `(${String(count).padStart(2, "0")})`;
}
