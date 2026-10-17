import { checkImage } from "./image.ts";
import { checkPdf } from "./pdf.ts";
import { checkSvg } from "./svg.ts";

// Which tracked files the metadata check looks at, and how it reports. The command-line script
// (scripts/check-metadata.ts) supplies the list from `git ls-files` and reads the files.

const IMAGE_EXTENSIONS = [
  "jpg",
  "jpeg",
  "png",
  "webp",
  "avif",
  "heic",
  "heif",
  "tif",
  "tiff",
  "gif",
];

const extensionOf = (path: string) =>
  /\.([^./\\]+)$/.exec(path)?.[1]?.toLowerCase();

/**
 * Every file with an image extension, or that of a PDF or an SVG, wherever it is in the
 * repository. There are no exclusions by folder.
 */
export function isCheckedPath(path: string): boolean {
  const extension = extensionOf(path);
  return (
    extension === "pdf" ||
    extension === "svg" ||
    IMAGE_EXTENSIONS.includes(extension ?? "")
  );
}

/** The paths in the NUL-separated output of `git ls-files -z`, which keeps odd names intact. */
export function parseFileList(output: string): string[] {
  return output.split("\0").filter((path) => path !== "");
}

export interface FileResult {
  file: string;
  problems: string[];
}

/**
 * Checks every image and PDF in `paths`. `read` returns a file's bytes, or undefined for a tracked
 * file that is missing from the working tree; if it throws, the file fails, because a file that
 * cannot be read cannot be shown to be clean.
 */
export async function checkFiles(
  paths: string[],
  read: (path: string) => Uint8Array | undefined,
): Promise<{ checked: number; failures: FileResult[] }> {
  let checked = 0;
  const failures: FileResult[] = [];
  for (const file of paths.filter(isCheckedPath)) {
    let bytes: Uint8Array | undefined;
    try {
      bytes = read(file);
    } catch (error) {
      checked++;
      failures.push({
        file,
        problems: [
          `could not be read (${error instanceof Error ? error.message : String(error)})`,
        ],
      });
      continue;
    }
    if (bytes === undefined) continue;
    checked++;
    const extension = extensionOf(file);
    const problems =
      extension === "pdf"
        ? await checkPdf(bytes)
        : extension === "svg"
          ? checkSvg(bytes)
          : await checkImage(bytes);
    if (problems.length > 0) failures.push({ file, problems });
  }
  return { checked, failures };
}
