import type { Profile, Project } from "./schema";
import { writeUpProblems } from "./write-up";

/** The design shows 2 to 12 projects; the launch gate (PR 2.2) decides the minimum. */
const MAX_PROJECTS = 12;

export interface ProjectEntry {
  /** The file name without its extension, which is also the page's URL. */
  id: string;
  data: Pick<Project, "code" | "order" | "featured">;
  /** The Markdown body, the write-up, which no schema covers. */
  body?: string | undefined;
}

export interface ProfileLike {
  skills: Pick<Profile["skills"][number], "group" | "runs">[];
}

/** One error message for a list of problems: a heading with the count, then one line each. */
export function problemsMessage(heading: string, problems: string[]): string {
  const count = `${problems.length} ${problems.length === 1 ? "problem" : "problems"}`;
  return `${heading} ${count}:\n${problems.map((p) => `- ${p}`).join("\n")}`;
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

  if (projects.length > MAX_PROJECTS) {
    problems.push(
      `Found ${projects.length} projects, but the design shows at most ${MAX_PROJECTS}`,
    );
  }

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

  // A body is checked whether or not the build shows the project, so a rule broken in a project
  // that production leaves out is found too.
  for (const project of projects) {
    for (const problem of writeUpProblems(project.body ?? "")) {
      problems.push(`src/content/projects/${project.id}.md, ${problem}`);
    }
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
