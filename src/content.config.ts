import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { projectSchema } from "./content/schema";

// One Markdown file per project: the file name is the page's URL (/projects/<name>), the
// frontmatter holds the fields and the body is the write-up.
const projects = defineCollection({
  loader: glob({ pattern: "*.md", base: "./src/content/projects" }),
  schema: projectSchema,
});

export const collections = { projects };
