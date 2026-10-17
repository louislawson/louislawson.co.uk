import { getCollection } from "astro:content";
import { profile } from "../data/profile";
import { currentAvailability } from "./availability";
import { validateContent } from "./validate";

/**
 * Every page reads content through this loader, so a problem that spans entries (two featured
 * projects, a skill pointing at a project that does not exist) fails the build, and fails it with
 * all the problems listed.
 */
export async function getSiteContent() {
  // getCollection returns entries in no fixed order.
  const projects = (await getCollection("projects")).sort(
    (a, b) => a.data.order - b.data.order,
  );
  const problems = validateContent(projects, profile);
  if (problems.length > 0) {
    throw new Error(
      `The content has ${problems.length} ${problems.length === 1 ? "problem" : "problems"}:\n${problems.map((p) => `- ${p}`).join("\n")}`,
    );
  }
  // Availability expires on its date, so pages never see a statement that is no longer true. The
  // daily production rebuild (PR 2.4) is what makes the expiry happen without a push.
  return {
    projects,
    profile: {
      ...profile,
      availability: currentAvailability(profile.availability, new Date()),
    },
  };
}
