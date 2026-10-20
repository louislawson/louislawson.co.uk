import type { Project } from "../content/schema";
import { realText } from "../content/todo";
import { cardAlt, cardPath, homeCard, projectCard } from "./card-content";
import type { PageMeta } from "./meta";

/** What a page gives Base for its sharing tags: the title and the address come from the page itself. */
export type PageMetaInput = Pick<
  PageMeta,
  "description" | "image" | "imageAlt" | "type"
>;

/** The home page: the intro describes it, and it has its own card, which its role line may be on. */
export function homeMeta(profile: {
  intro?: string | undefined;
  roleLine?: string | undefined;
}): PageMetaInput {
  return {
    description: realText(profile.intro),
    image: cardPath.home,
    imageAlt: cardAlt(homeCard(profile)),
    type: "website",
  };
}

/** A project page: its summary describes it, and the project has its own card. */
export function projectMeta(
  id: string,
  data: Pick<Project, "summary" | "code" | "title" | "headline" | "status">,
): PageMetaInput {
  return {
    description: realText(data.summary),
    image: cardPath.project(id),
    imageAlt: cardAlt(projectCard(id, data)),
    type: "article",
  };
}
