import type { Project } from "../content/schema";
import { realText } from "../content/todo";
import { cardPath } from "./card-content";
import type { PageMeta } from "./meta";

/** What a page gives Base for its sharing tags: the title and the address come from the page itself. */
export type PageMetaInput = Pick<PageMeta, "description" | "image" | "type">;

/** The home page: the intro describes it, and it has its own card. */
export function homeMeta(profile: {
  intro?: string | undefined;
}): PageMetaInput {
  return {
    description: realText(profile.intro),
    image: cardPath.home,
    type: "website",
  };
}

/** A project page: its summary describes it, and the project has its own card. */
export function projectMeta(
  id: string,
  data: Pick<Project, "summary">,
): PageMetaInput {
  return {
    description: realText(data.summary),
    image: cardPath.project(id),
    type: "article",
  };
}
