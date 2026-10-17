import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const root = new URL("../", import.meta.url);
const read = (url: URL) => readFileSync(url, "utf-8");

// Every workflow and every local composite action, whatever the extension.
const yamlFiles: URL[] = [
  ...readdirSync(new URL(".github/workflows/", root))
    .filter((name) => /\.ya?ml$/.test(name))
    .map((name) => new URL(`.github/workflows/${name}`, root)),
  ...readdirSync(new URL(".github/actions/", root), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((dir) =>
      readdirSync(new URL(`.github/actions/${dir.name}/`, root))
        .filter((name) => /^action\.ya?ml$/.test(name))
        .map((name) => new URL(`.github/actions/${dir.name}/${name}`, root)),
    ),
];

const clientDir = new URL(".github/actions/swa-client/", root);

// Microsoft's Static Web Apps client is run by the local swa-client action rather than through
// the Azure/static-web-apps-deploy Docker action, which hands its container the job's whole
// environment (including the OIDC request and runtime tokens) and the runner's Docker socket.
describe("the Static Web Apps deployment client", () => {
  it("is not run through the Azure/static-web-apps-deploy action", () => {
    for (const url of yamlFiles) {
      expect(read(url), url.pathname).not.toMatch(
        /uses:\s*["']?Azure\/static-web-apps-deploy/i,
      );
    }
  });

  it("is pinned by digest in one FROM line of the client action's Dockerfile", () => {
    const froms = read(new URL("Dockerfile", clientDir)).match(/^FROM .*$/gm);
    expect(froms).toHaveLength(1);
    expect(froms?.[0]).toMatch(
      /^FROM mcr\.microsoft\.com\/appsvc\/staticappsclient:[\w.-]+@sha256:[0-9a-f]{64}$/,
    );
  });

  it("is kept current by a Dependabot docker entry for that directory", () => {
    const dependabot = read(new URL(".github/dependabot.yml", root));
    const entry = dependabot
      .split(/\n {2}- package-ecosystem: /)
      .find((block) => block.startsWith("docker"));
    expect(entry).toBeDefined();
    expect(entry).toMatch(/\/\.github\/actions\/swa-client\b/);
  });

  it("uploads from the deploy workflow and closes previews from the cleanup workflow", () => {
    const step =
      /uses: \.\/\.github\/actions\/swa-client[^\n]*\n(?:\s+.*\n)*?\s+action: (\w+)/;
    const deploy = read(new URL(".github/workflows/deploy.yml", root));
    const cleanup = read(
      new URL(".github/workflows/preview-cleanup.yml", root),
    );
    expect(deploy.match(step)?.[1]).toBe("upload");
    expect(cleanup.match(step)?.[1]).toBe("close");
  });

  it("never hands the container credentials, the runner's environment or the Docker socket", () => {
    const action = read(new URL("action.yml", clientDir));
    expect(action).toMatch(/docker run /);
    for (const forbidden of [
      "ACTIONS_ID_TOKEN_REQUEST",
      "ACTIONS_RUNTIME_TOKEN",
      "ACTIONS_CACHE_URL",
      "ACTIONS_RESULTS_URL",
      "GITHUB_TOKEN",
      "ARM_",
      "docker.sock",
      "--env-file",
      "--privileged",
      "--network host",
    ]) {
      expect(action).not.toContain(forbidden);
    }
  });
});

// preview-cleanup.yml and deploy.yml cooperate through two strings that live in separate files.
// Nothing else ties them together, so a rename in one would silently reopen a preview leak.
describe("the deploy and cleanup workflows' shared strings", () => {
  const deploy = read(new URL(".github/workflows/deploy.yml", root));
  const cleanup = read(new URL(".github/workflows/preview-cleanup.yml", root));

  it("use the same per-pull-request concurrency group, so a close never overlaps a deploy", () => {
    const pattern = /group: Deploy-\$\{\{ github\.event\.pull_request\.number/;
    expect(deploy).toMatch(pattern);
    expect(cleanup).toMatch(pattern);
  });

  it("keep the workflow-level ordering group a different name from the shared one", () => {
    // If they matched, a run would wait on itself.
    expect(deploy).toMatch(/format\('Deploy-runs-\{0\}'/);
    expect(deploy).toMatch(/'Deploy-production-runs'/);
  });

  it("use the same marker for the sticky preview comment", () => {
    const marker = "<!-- deploy-preview -->";
    expect(deploy).toContain(marker);
    expect(cleanup).toContain(marker);
  });
});

// The placeholder warning is for pull requests only: GitHub shows at most 10 annotations per step,
// so the script prints one with the count and puts the full list in the job summary.
describe("the placeholders job in ci.yml", () => {
  const ci = read(new URL(".github/workflows/ci.yml", root));
  const job = ci.match(/^ {2}placeholders:\n(?:(?! {2}\S).*\n?)*/m)?.[0] ?? "";

  it("exists", () => {
    expect(job).not.toBe("");
  });

  it("runs on pull requests only", () => {
    expect(job).toMatch(/if: github\.event_name == 'pull_request'/);
  });

  it("only reads the repository and installs nothing", () => {
    expect(job).toMatch(/permissions:\n\s+contents: read/);
    expect(job).not.toMatch(/npm ci|npm install/);
  });

  it("asks the script for the annotation and summary", () => {
    expect(job).toContain("npm run placeholders -- --github");
  });

  it("is not a failing check: a placeholder is a warning", () => {
    expect(job).not.toMatch(/continue-on-error|exit 1/);
  });
});
