import { getCollection } from "astro:content";
import { profile } from "../data/profile";
import { assembleSiteContent } from "./assemble";

/**
 * Every page reads content through this loader, so a problem that spans entries (two featured
 * projects, a skill pointing at a project that does not exist) fails the build, and fails it with
 * all the problems listed. The daily production rebuild (PR 2.4) is what lets an availability
 * statement expire without a push.
 */
export async function getSiteContent() {
  return assembleSiteContent(
    await getCollection("projects"),
    profile,
    new Date(),
  );
}
