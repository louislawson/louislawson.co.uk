import { currentAvailability } from "./availability";
import type { Profile } from "./schema";
import {
  validateContent,
  type ProfileLike,
  type ProjectEntry,
} from "./validate";

interface WithAvailability extends ProfileLike {
  availability?: Profile["availability"];
}

/**
 * Puts the content together for the pages: projects sorted by `order`, every cross-entry problem
 * reported in one error, and an availability statement only while it is still true. It takes the
 * collection's entries rather than reading them, so it can be tested without Astro.
 */
export function assembleSiteContent<
  P extends ProjectEntry,
  F extends WithAvailability,
>(projects: P[], profile: F, now: Date) {
  // getCollection returns entries in no fixed order.
  const sorted = [...projects].sort((a, b) => a.data.order - b.data.order);
  const problems = validateContent(sorted, profile);
  if (problems.length > 0) {
    throw new Error(
      `The content has ${problems.length} ${problems.length === 1 ? "problem" : "problems"}:\n${problems.map((p) => `- ${p}`).join("\n")}`,
    );
  }
  return {
    projects: sorted,
    profile: {
      ...profile,
      availability: currentAvailability(profile.availability, now),
    },
  };
}
