import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { TAGS, tiff } from "./__fixtures__/exif";
import { jpeg } from "./__fixtures__/jpeg";
import { pdf } from "./__fixtures__/pdf";

// Runs the real script against a throwaway git repository, so what it checks is what
// `git ls-files` says is tracked: the whole repository, with nothing left out.
const script = join(process.cwd(), "scripts", "check-metadata.ts");
const repos: string[] = [];

const located = tiff([{ tag: TAGS.make, text: "Acme Camera" }], {
  gps: [{ tag: TAGS.gpsLatitudeRef, text: "N" }],
});

function repoWith(files: Record<string, Uint8Array>): string {
  const dir = mkdtempSync(join(tmpdir(), "metadata-check-"));
  repos.push(dir);
  execFileSync("git", ["init", "-q"], { cwd: dir });
  for (const [path, bytes] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), bytes);
  }
  execFileSync("git", ["add", "-A"], { cwd: dir });
  return dir;
}

function run(cwd: string): { status: number; output: string } {
  try {
    const stdout = execFileSync(process.execPath, [script], {
      cwd,
      encoding: "utf-8",
      stdio: "pipe",
    });
    return { status: 0, output: stdout };
  } catch (error) {
    const { status, stdout, stderr } = error as {
      status: number;
      stdout: string;
      stderr: string;
    };
    return { status, output: `${stdout}${stderr}` };
  }
}

afterAll(() => {
  for (const dir of repos) rmSync(dir, { recursive: true, force: true });
});

describe("npm run metadata:check", () => {
  it("passes a repository whose images and PDFs are clean, and says how many it checked", () => {
    const dir = repoWith({
      "photo.jpg": jpeg(),
      "public/cv.pdf": pdf({ info: { Title: "CV", Producer: "qpdf" } }),
      "README.md": new TextEncoder().encode("# hello"),
    });
    const result = run(dir);
    expect(result.status).toBe(0);
    expect(result.output).toContain("Checked 2 images and PDFs");
  });

  it("passes a repository with nothing to check", () => {
    const result = run(
      repoWith({ "README.md": new TextEncoder().encode("#") }),
    );
    expect(result.status).toBe(0);
    expect(result.output).toContain("Checked 0 images and PDFs");
  });

  it("fails, naming the file and what is wrong, for a photo anywhere in the repository", () => {
    const dir = repoWith({
      "photo.jpg": jpeg(),
      "docs/design/garage/located.jpg": jpeg({ exif: located }),
    });
    const result = run(dir);
    expect(result.status).toBe(1);
    expect(result.output).toContain("docs/design/garage/located.jpg");
    expect(result.output).toContain("GPS");
    expect(result.output).not.toContain("photo.jpg:");
  });

  it("fails for a PDF with an author", () => {
    const result = run(
      repoWith({ "public/cv.pdf": pdf({ info: { Author: "Louis" } }) }),
    );
    expect(result.status).toBe(1);
    expect(result.output).toContain("public/cv.pdf");
    expect(result.output).toContain("Author");
  });

  it("checks the whole repository even when run from a subdirectory", () => {
    const dir = repoWith({
      "located.jpg": jpeg({ exif: located }),
      "src/pages/index.astro": new TextEncoder().encode("<h1>hi</h1>"),
    });
    const result = run(join(dir, "src", "pages"));
    expect(result.status).toBe(1);
    expect(result.output).toContain("located.jpg");
  });

  it("reports every failing file, not just the first", () => {
    const dir = repoWith({
      "a.jpg": jpeg({ exif: located }),
      "b/c.jpg": jpeg({ exif: located }),
    });
    const result = run(dir);
    expect(result.output).toContain("a.jpg");
    expect(result.output).toContain("b/c.jpg");
  });
});
