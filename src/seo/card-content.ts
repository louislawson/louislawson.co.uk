import { projectPath, statusLabel } from "../components/home/project-display";
import type { Project } from "../content/schema";
import { realText } from "../content/todo";

/** The domain the cards print, which is the site's own and a confirmed fact. */
const DOMAIN = "louislawson.co.uk";
const BRAND = "louis.lawson";

/** Where the cards are published. Each is a plain file on the site's own origin. */
export const cardPath = {
  home: "/og/home.png",
  project: (id: string) => `/og/projects/${id}.png`,
};

export interface HomeCard {
  kind: "home";
  brand: string;
  /** The name on two lines, as the hero sets it. */
  name: [string, string];
  role?: string;
  address: string;
}

export interface ProjectCard {
  kind: "project";
  brand: string;
  code: string;
  title?: string;
  headline?: string;
  status?: { key: string; label: string };
  address: string;
}

export type Card = HomeCard | ProjectCard;

/**
 * The home page's card: the name, and the role line when it is real. A card is a picture, so it
 * cannot hatch a placeholder the way a page does: a placeholder is left off in every build, and
 * so is a value that production already dropped.
 */
export function homeCard(profile: { roleLine?: string | undefined }): HomeCard {
  const role = realText(profile.roleLine);
  return {
    kind: "home",
    brand: BRAND,
    name: ["Louis", "Lawson"],
    ...(role === undefined ? {} : { role }),
    address: `${DOMAIN}/`,
  };
}

/** A project page's card, for the page at `id`. The code is always real: its schema allows no placeholder. */
export function projectCard(
  id: string,
  data: Pick<Project, "code" | "title" | "headline" | "status">,
): ProjectCard {
  const title = realText(data.title);
  const headline = realText(data.headline);
  const status = realText(data.status);
  return {
    kind: "project",
    brand: BRAND,
    code: data.code,
    ...(title === undefined ? {} : { title }),
    ...(headline === undefined ? {} : { headline }),
    ...(status === undefined
      ? {}
      : { status: { key: status, label: statusLabel(status) } }),
    address: `${DOMAIN}${projectPath(id)}`,
  };
}
