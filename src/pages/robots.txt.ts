import type { APIRoute } from "astro";
import { robotsTxt } from "../config/robots";
import { site } from "../config/site";

// Made at build, so it follows the build's noindex rule. There is deliberately no public/robots.txt:
// a static file would be the same in every build, and a preview would then invite crawlers in.
export const GET: APIRoute = () =>
  new Response(robotsTxt({ noindex: site.noindex, siteUrl: site.url }), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
