import { describe, expect, it } from "vitest";
import { utf8 } from "./__fixtures__/bytes";
import { png } from "./__fixtures__/containers";
import { TAGS, tiff } from "./__fixtures__/exif";
import { jpeg } from "./__fixtures__/jpeg";
import { pdf } from "./__fixtures__/pdf";
import { checkFiles, isCheckedPath, parseFileList } from "./check";

const located = tiff([{ tag: TAGS.make, text: "Acme Camera" }], {
  gps: [{ tag: TAGS.gpsLatitudeRef, text: "N" }],
});

describe("isCheckedPath", () => {
  it("covers every image type in the plan, and PDFs, in any case", () => {
    for (const extension of [
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
      "svg",
      "pdf",
    ]) {
      expect(isCheckedPath(`a/b/file.${extension}`), extension).toBe(true);
      expect(
        isCheckedPath(`A/B/FILE.${extension.toUpperCase()}`),
        extension,
      ).toBe(true);
    }
  });

  it("covers a file anywhere in the repository: there are no exclusions", () => {
    for (const path of [
      "photo.jpg",
      "public/cv.pdf",
      "docs/design/mock/hero.png",
      "src/assets/garage/car.heic",
      "node_modules/pkg/logo.gif",
      "deeply/nested/folder/with.dots/scan.tiff",
    ]) {
      expect(isCheckedPath(path), path).toBe(true);
    }
  });

  it("leaves other files alone", () => {
    for (const path of [
      "README.md",
      "src/pages/index.astro",
      "favicon.ico",
      "jpg",
      "archive.jpg.zip",
      "notes.pdf.txt",
    ]) {
      expect(isCheckedPath(path), path).toBe(false);
    }
  });
});

describe("parseFileList", () => {
  it("splits git's NUL-separated list, ignoring the empty entry after the last NUL", () => {
    expect(parseFileList("a.jpg\0docs/b c.pdf\0")).toEqual([
      "a.jpg",
      "docs/b c.pdf",
    ]);
  });

  it("is empty for an empty list", () => {
    expect(parseFileList("")).toEqual([]);
  });
});

describe("checkFiles", () => {
  const files: Record<string, Uint8Array> = {
    "clean.jpg": jpeg(),
    "docs/located.jpg": jpeg({ exif: located }),
    "public/cv.pdf": pdf({ info: { Title: "CV", Author: "Louis" } }),
    "clean.PNG": png(),
    "public/icons/clean.svg": utf8(
      '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg>',
    ),
    "public/icons/inkscape.svg": utf8(
      '<svg xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" inkscape:export-filename="icon.png"/>',
    ),
    "README.md": new TextEncoder().encode("# readme"),
  };
  const read = (path: string) => files[path];

  it("checks every image and PDF it is given and counts them", async () => {
    const result = await checkFiles(Object.keys(files), read);
    expect(result.checked).toBe(6);
  });

  it("reports each file with a problem, with its path and what is wrong", async () => {
    const result = await checkFiles(Object.keys(files), read);
    expect(result.failures.map((f) => f.file).sort()).toEqual([
      "docs/located.jpg",
      "public/cv.pdf",
      "public/icons/inkscape.svg",
    ]);
    const jpegFailure = result.failures.find(
      (f) => f.file === "docs/located.jpg",
    );
    expect(jpegFailure?.problems.join("\n")).toContain("GPS");
    const pdfFailure = result.failures.find((f) => f.file === "public/cv.pdf");
    expect(pdfFailure?.problems.join("\n")).toContain("Author");
  });

  it("passes when every file is clean", async () => {
    const result = await checkFiles(
      ["clean.jpg", "clean.PNG", "README.md"],
      read,
    );
    expect(result).toEqual({ checked: 2, failures: [] });
  });

  it("passes when there is nothing to check", async () => {
    expect(await checkFiles(["README.md"], read)).toEqual({
      checked: 0,
      failures: [],
    });
  });

  it("skips a tracked file that is missing from the working tree", async () => {
    const result = await checkFiles(["gone.jpg"], () => undefined);
    expect(result).toEqual({ checked: 0, failures: [] });
  });

  it("fails a file it cannot read, rather than passing it", async () => {
    const result = await checkFiles(["locked.jpg"], () => {
      throw new Error("EACCES: permission denied");
    });
    expect(result.checked).toBe(1);
    expect(result.failures[0]?.problems[0]).toContain("EACCES");
  });
});
