import { getCollection } from "astro:content";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { site } from "../config/site";
import { profile } from "../data/profile";
import { assembleSiteContent } from "./assemble";
import { launchGateProblems } from "./launch-gate";
import { problemsMessage } from "./validate";
import { presentSiteContent } from "./visibility";

/**
 * Every page reads content through this loader, so a problem that spans entries (two featured
 * projects, a skill pointing at a project that does not exist) fails the build, and fails it with
 * all the problems listed. The daily production rebuild (PR 2.4) is what lets an availability
 * statement expire without a push.
 *
 * What comes back is shaped for the deploy context, not for `launch`: local and preview builds
 * keep the placeholders so they can be seen and filled in, and production leaves them out. Any
 * build with `LAUNCH = true` also fails while the launch gate's required set is incomplete.
 */
export async function getSiteContent() {
  const content = assembleSiteContent(
    await getCollection("projects"),
    profile,
    new Date(),
  );
  if (site.launch) {
    const problems = launchGateProblems(content, {
      // The build runs from the project root, as every npm script and CI job does.
      cvFileExists: existsSync(join(process.cwd(), "public", "cv.pdf")),
    });
    if (problems.length > 0) {
      throw new Error(
        problemsMessage(
          "The launch gate (LAUNCH = true in src/config/site.ts) is not open:",
          problems,
        ),
      );
    }
  }
  return presentSiteContent(content, site.deployContext);
}
