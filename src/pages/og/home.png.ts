import type { APIRoute } from "astro";
import { getSiteContent } from "../../content/site-content";
import { homeCard } from "../../seo/card-content";
import { cardResponse } from "../../seo/card-image";

// The home page's social preview card, made at build: a plain file on the site's own origin.
export const GET: APIRoute = async () => {
  const { profile } = await getSiteContent();
  return cardResponse(homeCard(profile));
};
