// Fails if any image or PDF tracked by git carries personal metadata: EXIF, XMP or IPTC in a photo,
// an author, tool or file path in a PDF. Run it with `npm run metadata:check`; CI runs it on
// every pull request and push as the "Metadata check" job. Node runs this TypeScript directly.
//
// It checks what `git ls-files` lists, from the top of the repository wherever it is run from, so
// no folder is left out. README.md explains how to strip a file that fails.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { checkFiles, parseFileList } from "../src/metadata/check.ts";

const git = (args: string[], cwd?: string) =>
  execFileSync("git", args, {
    cwd,
    encoding: "utf-8",
    maxBuffer: 256 * 1024 * 1024,
  });

const root = git(["rev-parse", "--show-toplevel"]).trim();
const paths = parseFileList(git(["ls-files", "-z"], root));

const { checked, failures } = await checkFiles(paths, (path) => {
  try {
    return readFileSync(join(root, path));
  } catch (error) {
    // Tracked but deleted from the working tree: nothing there to leak.
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
});

for (const { file, problems } of failures) {
  console.log(`${file}:`);
  for (const problem of problems) console.log(`  - ${problem}`);
}

const noun = checked === 1 ? "image or PDF" : "images and PDFs";
if (failures.length > 0) {
  console.log(
    `\nChecked ${checked} ${noun}: ${failures.length} carry metadata that must be removed. See "Photos and PDFs" in README.md.`,
  );
  process.exitCode = 1;
} else {
  console.log(`Checked ${checked} ${noun}: none carry personal metadata.`);
}
