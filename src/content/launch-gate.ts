import type { Profile } from "./schema";
import { isPlaceholder } from "./todo.ts";
import { isRealProject, type ProjectLike } from "./visibility";

/**
 * What a launched site must have. Production leaves out placeholders, so without these it would
 * open as an empty page: the intro, career line and role line, at least two real projects with
 * the featured one real, an email and LinkedIn, and a CV (the field is real and the file exists).
 * Returns every missing piece. Anything else may stay a placeholder, because production omits it.
 */
export function launchGateProblems(
  content: { projects: ProjectLike[]; profile: Profile },
  { cvFileExists }: { cvFileExists: boolean },
): string[] {
  const { projects, profile } = content;
  const problems: string[] = [];

  const required: [string, string][] = [
    ["intro", profile.intro],
    ["career line", profile.careerLine],
    ["role line", profile.roleLine],
    ["email", profile.email],
    ["LinkedIn link", profile.links.linkedin],
  ];
  for (const [name, value] of required) {
    if (isPlaceholder(value))
      problems.push(`The ${name} is still a placeholder`);
  }

  const real = projects.filter(isRealProject);
  if (real.length < 2) {
    problems.push(
      `At least two real projects are needed, found ${real.length}`,
    );
  }
  const featured = projects.find((project) => project.data.featured);
  if (!featured) {
    problems.push("There is no featured project");
  } else if (!isRealProject(featured)) {
    problems.push(
      `The featured project (${featured.id}) is not real: it has a placeholder`,
    );
  }

  if (isPlaceholder(profile.cv)) {
    problems.push("The cv field is still a placeholder");
  } else if (!cvFileExists) {
    problems.push(
      "The cv field points at /cv.pdf but public/cv.pdf does not exist",
    );
  }

  return problems;
}
