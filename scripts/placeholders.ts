// Lists every TODO placeholder in the content files as file:line. Run it with
// `npm run placeholders`. Node runs this TypeScript directly, so there is no build step.
//
// With --github (pull requests in CI) it also prints one warning annotation with the count and
// appends the full list to the job summary. It always exits 0: a placeholder is a warning, and
// the launch gate is what blocks production.
import { appendFileSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import {
  annotation,
  findPlaceholders,
  isContentFile,
  summary,
} from "../src/content/list-placeholders.ts";

// Relative to the repository, whatever directory the script is run from.
const root = fileURLToPath(new URL("../", import.meta.url));

const files = readdirSync(join(root, "src"), {
  recursive: true,
  withFileTypes: true,
})
  .filter((entry) => entry.isFile())
  .map((entry) =>
    relative(root, join(entry.parentPath, entry.name)).replaceAll("\\", "/"),
  )
  .filter(isContentFile)
  .sort();

const hits = files.flatMap((file) =>
  findPlaceholders(file, readFileSync(join(root, file), "utf-8")),
);

for (const hit of hits) console.log(`${hit.file}:${hit.line}  ${hit.text}`);
console.log(
  hits.length === 0
    ? "No placeholders."
    : `${hits.length} placeholder${hits.length === 1 ? "" : "s"} in ${new Set(hits.map((h) => h.file)).size} files.`,
);

if (process.argv.includes("--github")) {
  const warning = annotation(hits);
  if (warning) console.log(warning);
  const summaryFile = process.env.GITHUB_STEP_SUMMARY;
  if (summaryFile) appendFileSync(summaryFile, summary(hits));
}
