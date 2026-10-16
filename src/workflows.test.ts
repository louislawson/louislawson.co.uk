import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Azure/static-web-apps-deploy is tracked by hand (see "Manually tracked" in the README): it is
// pinned by commit, Dependabot is told to ignore it, and the pin appears in more than one file.
// These checks keep the copies from drifting apart.
const root = new URL("../", import.meta.url);
const workflowsDir = new URL(".github/workflows/", root);
const read = (url: URL) => readFileSync(url, "utf-8");

const pins = readdirSync(workflowsDir)
  .filter((name) => name.endsWith(".yml"))
  .flatMap((name) =>
    [
      ...read(new URL(name, workflowsDir)).matchAll(
        /Azure\/static-web-apps-deploy@(\S+)/g,
      ),
    ].map((match) => ({ file: name, ref: match[1] })),
  );

describe("the Azure/static-web-apps-deploy pin", () => {
  it("is used by the deploy and cleanup workflows", () => {
    expect(pins.map((pin) => pin.file).sort()).toEqual([
      "deploy.yml",
      "preview-cleanup.yml",
    ]);
  });

  it("is a full commit SHA, the same in every workflow", () => {
    for (const pin of pins) expect(pin.ref).toMatch(/^[0-9a-f]{40}$/);
    expect(new Set(pins.map((pin) => pin.ref)).size).toBe(1);
  });

  it("is the commit the README names as manually tracked", () => {
    expect(read(new URL("README.md", root))).toContain(pins[0]?.ref);
  });

  it("is on Dependabot's ignore list, as the README says", () => {
    const dependabot = read(new URL(".github/dependabot.yml", root));
    expect(dependabot).toMatch(
      /dependency-name:\s*Azure\/static-web-apps-deploy/,
    );
  });
});
