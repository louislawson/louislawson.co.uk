import type { Project } from "../../content/schema";
import { isPlaceholder } from "../../content/todo";

/** Up to this many projects are shown in full, as strips; more are compact rows. */
export const STRIP_LIMIT = 3;

export type ProjectLayout = "strip" | "row";

/** What the lists read of a collection entry: its file name, and what puts it in order. */
type Listed = { id: string; data: { featured: boolean; order: number } };

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
export function featuredFirst<E extends Pick<Listed, "data">>(
  projects: readonly E[],
): E[] {
  return [...projects].sort(
    (a, b) =>
      Number(b.data.featured) - Number(a.data.featured) ||
      a.data.order - b.data.order,
  );
}

/** A project's page: its file name (the collection's id) under /projects/. */
export function projectPath(id: string): string {
  return `/projects/${id}/`;
}

/**
 * The project after this one in a list that is in the home page's order, which wraps from the last
 * to the first. A project that stands alone has none to point to, and neither has one that is not
 * in the list.
 */
function following<E extends Listed>(
  ordered: readonly E[],
  id: string,
): E | undefined {
  const index = ordered.findIndex((project) => project.id === id);
  if (index === -1 || ordered.length < 2) return undefined;
  return ordered[(index + 1) % ordered.length];
}

/**
 * The browser tab's title. A placeholder title is shown hatched on the page, which a tab cannot
 * do, so the tab names the project by its code instead.
 */
export function pageTitle(data: { title: string; code: string }): string {
  return `${isPlaceholder(data.title) ? data.code : data.title} · Louis Lawson`;
}

/**
 * What getStaticPaths() returns: a page for each project it is given, at its file name, with the
 * project to link on to. The pages built in a deploy context are the projects that context shows.
 */
export function projectPages<E extends Listed>(projects: readonly E[]) {
  // The order is the same for every page, so it is worked out once.
  const ordered = featuredFirst(projects);
  return projects.map((project) => ({
    params: { slug: project.id },
    props: { project, next: following(ordered, project.id) },
  }));
}

export type WriteUpKind =
  { kind: "none" } | { kind: "placeholder"; text: string } | { kind: "prose" };

/**
 * What a project's Markdown body is for the page. A body with nothing in it has no write-up
 * section. A body that is one placeholder paragraph is hatched in a preview like any other
 * placeholder. Anything else is rendered as written: a half-finished body keeps its project out of
 * production, and a preview shows it as it stands.
 */
export function writeUpKind(body: string | undefined): WriteUpKind {
  const text = body?.trim() ?? "";
  if (text === "") return { kind: "none" };
  if (isPlaceholder(text) && !/\n\s*\n/.test(text)) {
    return { kind: "placeholder", text };
  }
  return { kind: "prose" };
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
