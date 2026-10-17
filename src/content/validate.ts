import type { Profile, Project } from "./schema";

interface ProjectEntry {
  /** The file name without its extension, which is also the page's URL. */
  id: string;
  data: Pick<Project, "code" | "order" | "featured">;
}

interface ProfileLike {
  skills: Pick<Profile["skills"][number], "group" | "runs">[];
}

/** Groups the ids of projects by a key, keeping only keys that more than one project has. */
function shared<K>(projects: ProjectEntry[], key: (p: ProjectEntry) => K) {
  const groups = new Map<K, string[]>();
  for (const project of projects) {
    const k = key(project);
    const ids = groups.get(k) ?? [];
    ids.push(project.id);
    groups.set(k, ids);
  }
  return [...groups].filter(([, ids]) => ids.length > 1);
}

/**
 * The problems that no single entry's schema can see: it returns every one, so the build can
 * report them all at once.
 */
export function validateContent(
  projects: ProjectEntry[],
  profile: ProfileLike,
): string[] {
  const problems: string[] = [];

  const featured = projects.filter((p) => p.data.featured).map((p) => p.id);
  if (featured.length !== 1) {
    problems.push(
      `Expected exactly one featured project, found ${featured.length === 0 ? "none" : `${featured.length} (${featured.join(", ")})`}`,
    );
  }

  for (const [code, ids] of shared(projects, (p) => p.data.code)) {
    problems.push(`Projects ${ids.join(", ")} share the code ${code}`);
  }
  for (const [order, ids] of shared(projects, (p) => p.data.order)) {
    problems.push(`Projects ${ids.join(", ")} share order ${order}`);
  }

  const codes = new Set(projects.map((p) => p.data.code));
  for (const skill of profile.skills) {
    for (const run of skill.runs) {
      if (!codes.has(run)) {
        problems.push(
          `Skill "${skill.group}" refers to ${run}, which no project has`,
        );
      }
    }
  }

  return problems;
}
