import type { APIRoute, InferGetStaticPropsType } from "astro";
import { getSiteContent } from "../../../content/site-content";
import { projectCard } from "../../../seo/card-content";
import { cardResponse } from "../../../seo/card-image";

// One card for each project page this build has, from the same list as the pages themselves, so a
// project that is left out of a build has neither a page nor a card.
export async function getStaticPaths() {
  const { projects } = await getSiteContent();
  return projects.map((project) => ({
    params: { slug: project.id },
    props: { project },
  }));
}

type Props = InferGetStaticPropsType<typeof getStaticPaths>;

export const GET: APIRoute<Props> = ({ params, props }) =>
  cardResponse(projectCard(params.slug!, props.project.data));
