import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Azure/static-web-apps-deploy is tracked by hand (see "Manually tracked" in the README): it is
// pinned by commit, Dependabot is told to ignore it, and the pin appears in more than one file.
// These checks keep the copies from drifting apart.
const root = new URL("../", import.meta.url);
const read = (url: URL) => readFileSync(url, "utf-8");

// Every workflow and every local composite action, whatever the extension.
const yamlFiles: URL[] = [
  ...readdirSync(new URL(".github/workflows/", root))
    .filter((name) => /\.ya?ml$/.test(name))
    .map((name) => new URL(`.github/workflows/${name}`, root)),
  ...readdirSync(new URL(".github/actions/", root)).flatMap((dir) =>
    readdirSync(new URL(`.github/actions/${dir}/`, root))
      .filter((name) => /^action\.ya?ml$/.test(name))
      .map((name) => new URL(`.github/actions/${dir}/${name}`, root)),
  ),
];

const pins = yamlFiles.flatMap((url) =>
  [...read(url).matchAll(/Azure\/static-web-apps-deploy@(\S+)/g)].map(
    (match) => ({ file: url.pathname.split("/").slice(-1)[0], ref: match[1] }),
  ),
);

describe("the Azure/static-web-apps-deploy pin", () => {
  it("is used by at least the deploy and cleanup workflows", () => {
    const files = pins.map((pin) => pin.file);
    expect(files).toContain("deploy.yml");
    expect(files).toContain("preview-cleanup.yml");
  });

  it("is a full commit SHA, the same wherever it is used", () => {
    for (const pin of pins) expect(pin.ref).toMatch(/^[0-9a-f]{40}$/);
    expect(new Set(pins.map((pin) => pin.ref)).size).toBe(1);
  });

  it("is the commit the README names as manually tracked", () => {
    expect(read(new URL("README.md", root))).toContain(pins[0]?.ref);
  });

  it("is on the ignore list of Dependabot's github-actions entry, as the README says", () => {
    const dependabot = read(new URL(".github/dependabot.yml", root));
    const entry = dependabot
      .split(/\n {2}- package-ecosystem: /)
      .find((block) => block.startsWith("github-actions"));
    expect(entry).toBeDefined();
    expect(entry).toMatch(/dependency-name:\s*Azure\/static-web-apps-deploy/);
  });
});
