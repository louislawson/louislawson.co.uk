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

// Louis adds this job's name to the required checks, so a rename would leave main unprotected
// without any check going red: the required check would simply never report.
describe("the metadata job in ci.yml", () => {
  const ci = read(new URL(".github/workflows/ci.yml", root));
  const job = ci.match(/^ {2}metadata:\n(?:(?! {2}\S).*\n?)*/m)?.[0] ?? "";

  it("exists", () => {
    expect(job).not.toBe("");
  });

  it('is named exactly "Metadata check"', () => {
    expect(job).toMatch(/^ {4}name: Metadata check$/m);
  });

  it("runs on every pull request and every push to main, which the workflow triggers cover", () => {
    expect(job).not.toMatch(/^ {4}if:/m);
    expect(ci).toMatch(
      /^on:\n {2}pull_request:\n {2}push:\n {4}branches: \[main\]/m,
    );
  });

  it("only reads the repository", () => {
    expect(job).toMatch(/permissions:\n\s+contents: read/);
    expect(job).toMatch(/persist-credentials: false/);
  });

  it("installs the locked dependencies and runs the check script", () => {
    expect(job).toContain("npm ci");
    expect(job).toContain("npm run metadata:check");
  });

  it("is not allowed to fail quietly", () => {
    expect(job).not.toMatch(/continue-on-error|\|\| true/);
  });
});

// Production is rebuilt every day so a statement that expires on a date disappears without a push.
// Several places in deploy.yml used to assume that production means a push; each is pinned here.
describe("the daily schedule in deploy.yml", () => {
  const deploy = read(new URL(".github/workflows/deploy.yml", root));
  /** One job's text, from its key to the next job's. */
  const job = (name: string) =>
    deploy.match(
      new RegExp(`^ {2}${name}:\\n(?:(?! {2}\\S).*\\n?)*`, "m"),
    )?.[0] ?? "";
  const build = job("build");
  const deployJob = job("deploy");

  it("is a schedule trigger at 04:17 UTC: an odd minute, away from the top of the hour", () => {
    expect(deploy).toMatch(
      /^ {2}schedule:\n {4}- cron: ["']17 4 \* \* \*["']$/m,
    );
  });

  it("queues a scheduled run with production, not in a pull-request group with no number", () => {
    // Any run that is not a pull request takes the production group.
    expect(deploy).toContain(
      "group: ${{ github.event_name == 'pull_request' && format('Deploy-runs-{0}', github.event.pull_request.number) || 'Deploy-production-runs' }}",
    );
    expect(deploy).not.toContain(
      "github.event_name == 'push' && 'Deploy-production-runs'",
    );
  });

  it("lets a schedule through the build job's condition", () => {
    const condition = /^ {4}if: >-\n((?: {6}.*\n)+)/m.exec(build)?.[1] ?? "";
    expect(condition).toContain("github.event_name == 'push'");
    expect(condition).toContain("github.event_name == 'schedule'");
  });

  it("builds a scheduled run as production, like a push", () => {
    expect(build).toContain(
      "DEPLOY_CONTEXT: ${{ github.event_name == 'pull_request' && 'preview' || 'production' }}",
    );
  });

  it("keeps a scheduled build's artifact for 1 day and any other for 7", () => {
    expect(build).toContain(
      "retention-days: ${{ github.event_name == 'schedule' && 1 || 7 }}",
    );
  });

  it("deploys through the production group when there is no pull request number", () => {
    expect(deployJob).toContain(
      "group: Deploy-${{ github.event.pull_request.number || 'production' }}",
    );
  });

  it("only checks a pull request's state for a pull request", () => {
    // The guard step must let any other event, a schedule included, straight through.
    expect(deployJob).toContain(
      'if [ "${EVENT_NAME}" != "pull_request" ]; then',
    );
  });
});

// The trace panel shows "build 412 · commit 0af5e05", which only the deploy build can know.
describe("the build info in deploy.yml", () => {
  const deploy = read(new URL(".github/workflows/deploy.yml", root));
  /** The build job's Build step, from its name to the next step. */
  const step =
    /^ {6}- name: Build\n[\s\S]*?(?=\n {6}- )/m.exec(deploy)?.[0] ?? "";

  it("has a Build step to read", () => {
    expect(step).toContain("npm run build");
  });

  it("passes the run number to the build as BUILD_NUMBER", () => {
    expect(step).toContain("BUILD_NUMBER: ${{ github.run_number }}");
  });

  it("passes the short head commit as GIT_SHA, from the pull request's head and not its merge commit", () => {
    expect(step).toContain(
      "HEAD_SHA: ${{ github.event.pull_request.head.sha || github.sha }}",
    );
    expect(step).toMatch(/GIT_SHA="\$\{HEAD_SHA::7\}" npm run build/);
  });

  it("gives them to the build step alone, which holds no credentials", () => {
    expect(deploy.match(/BUILD_NUMBER:/g)).toHaveLength(1);
    expect(deploy.match(/GIT_SHA=/g)).toHaveLength(1);
  });
});

// Louis adds this job's name to the required checks, so a rename would leave main unprotected
// without any check going red: the required check would simply never report.
describe("the E2E job in ci.yml", () => {
  const ci = read(new URL(".github/workflows/ci.yml", root));
  const job = ci.match(/^ {2}e2e:\n(?:(?! {2}\S).*\n?)*/m)?.[0] ?? "";

  it("exists", () => {
    expect(job).not.toBe("");
  });

  it('is named exactly "E2E"', () => {
    expect(job).toMatch(/^ {4}name: E2E$/m);
  });

  it("runs on every pull request and every push to main", () => {
    expect(job).not.toMatch(/^ {4}if:/m);
  });

  it("only reads the repository", () => {
    expect(job).toMatch(/permissions:\n\s+contents: read/);
    expect(job).toMatch(/persist-credentials: false/);
  });

  it("installs both browsers, at the version in the lockfile", () => {
    expect(job).toContain("npm ci");
    // npx runs the locked Playwright, so the browsers match the tests' version.
    expect(job).toContain("npx playwright install --with-deps chromium webkit");
    expect(job).not.toMatch(/playwright@|npm install/);
  });

  it("builds both contexts and runs the tests through the script", () => {
    expect(job).toContain("npm run test:e2e");
  });

  it("keeps the HTML report for 7 days, and only when a test failed", () => {
    expect(job).toMatch(/if: failure\(\)/);
    expect(job).toContain("path: playwright-report/");
    expect(job).toContain("retention-days: 7");
  });

  it("is not allowed to fail quietly", () => {
    expect(job).not.toMatch(/continue-on-error|\|\| true/);
  });
});

// Louis adds this job's name to the required checks, so a rename would leave main unprotected
// without any check going red: the required check would simply never report.
describe("the Static checks job in ci.yml", () => {
  const ci = read(new URL(".github/workflows/ci.yml", root));
  const job = ci.match(/^ {2}static:\n(?:(?! {2}\S).*\n?)*/m)?.[0] ?? "";
  /** The lychee steps, one per build. */
  const lychee = job
    .split(/^ {6}- /m)
    .filter((step) => step.includes("lycheeverse/lychee-action"));

  it("exists", () => {
    expect(job).not.toBe("");
  });

  it('is named exactly "Static checks"', () => {
    expect(job).toMatch(/^ {4}name: Static checks$/m);
  });

  it("runs on every pull request and every push to main", () => {
    expect(job).not.toMatch(/^ {4}if:/m);
  });

  it("only reads the repository", () => {
    expect(job).toMatch(/permissions:\n\s+contents: read/);
    expect(job).toMatch(/persist-credentials: false/);
  });

  it("builds both contexts, then validates the HTML, then checks the links", () => {
    const at = (text: string) => job.indexOf(text);
    expect(at("npm run build:e2e")).toBeGreaterThan(at("npm ci"));
    expect(at("npm run validate:html")).toBeGreaterThan(
      at("npm run build:e2e"),
    );
    expect(at("lycheeverse/lychee-action")).toBeGreaterThan(
      at("npm run validate:html"),
    );
  });

  it("pins lychee-action to a full commit SHA and sets the lychee version", () => {
    expect(lychee).toHaveLength(2);
    for (const step of lychee) {
      expect(step).toMatch(
        /uses: lycheeverse\/lychee-action@[0-9a-f]{40} # v\d+\.\d+\.\d+/,
      );
      expect(step).toMatch(/lycheeVersion: v\d+\.\d+\.\d+/);
    }
  });

  it("checks each build offline, with fragments, against its own absolute root", () => {
    for (const [index, name] of ["preview", "production"].entries()) {
      const step = lychee[index] ?? "";
      expect(step).toContain("--offline");
      expect(step).toContain("--include-fragments");
      // The action's shell expands the variable, so the root is an absolute path.
      expect(step).toContain(`--root-dir "$GITHUB_WORKSPACE/dist-e2e/${name}"`);
      expect(step).toContain(`'dist-e2e/${name}/**/*.html'`);
    }
  });

  it("is not allowed to fail quietly", () => {
    expect(job).not.toMatch(/continue-on-error|\|\| true/);
    for (const step of lychee) expect(step).not.toMatch(/fail: false/);
  });
});

// The weekly report of links to other sites. It is not a gate: LinkedIn answers bots with status
// 999 and GitHub rate-limits, and a remote site can be down for a day.
describe("the external links workflow", () => {
  const links = read(new URL(".github/workflows/links.yml", root));

  it("runs on a weekly schedule, and on demand", () => {
    expect(links).toMatch(
      /^ {2}schedule:\n(?: {4}#.*\n)* {4}- cron: ["']\d+ \d+ \* \* \d["']$/m,
    );
    expect(links).toMatch(/^ {2}workflow_dispatch:/m);
  });

  it("is not part of pull requests or pushes, so it can never block a merge", () => {
    expect(links).not.toMatch(/^ {2}(pull_request|push):/m);
  });

  it("only reads the repository", () => {
    expect(links).toMatch(/^permissions: \{\}$/m);
    expect(links).toMatch(/permissions:\n\s+contents: read/);
    expect(links).toMatch(/persist-credentials: false/);
  });

  it("checks the production build's external links", () => {
    expect(links).toMatch(/DEPLOY_CONTEXT: production/);
    expect(links).toContain("'dist/**/*.html'");
    expect(links).toContain("--scheme https --scheme http");
    // Online: unlike the gate, it is meant to reach other sites.
    expect(links).not.toContain("--offline");
  });

  it("does not fail on LinkedIn's status 999 or on a rate limit", () => {
    const accept = links.match(/--accept '([^']+)'/)?.[1] ?? "";
    expect(accept.split(",")).toEqual(
      expect.arrayContaining(["200..=299", "429", "999"]),
    );
  });

  it("pins lychee-action to a full commit SHA and sets the lychee version", () => {
    expect(links).toMatch(
      /uses: lycheeverse\/lychee-action@[0-9a-f]{40} # v\d+\.\d+\.\d+/,
    );
    expect(links).toMatch(/lycheeVersion: v\d+\.\d+\.\d+/);
  });

  it("uses the same lychee version as the gate", () => {
    const version = (text: string) =>
      text.match(/lycheeVersion: (v[\d.]+)/)?.[1];
    expect(version(links)).toBeDefined();
    expect(version(links)).toBe(
      version(read(new URL(".github/workflows/ci.yml", root))),
    );
  });
});

describe("the HTML validation config", () => {
  it("starts from the recommended preset", async () => {
    const { default: config } = await import("../.htmlvalidate.mjs");
    expect(config.extends).toEqual(["html-validate:recommended"]);
  });
});

// After a deploy, scripts/check-live.ts asks the deployed site for its headers and compares them
// with the build that was uploaded. It runs in a job of its own: the deploy job holds the Azure
// identity and runs nothing from the project, and this one runs the project's script.
describe("the live check in deploy.yml", () => {
  const deploy = read(new URL(".github/workflows/deploy.yml", root));
  const job =
    deploy.match(/^ {2}live-check:\n(?:(?! {2}\S).*\n?)*/m)?.[0] ?? "";
  const script = read(new URL("scripts/check-live.ts", root));
  const rules = read(new URL("src/e2e/live.ts", root));

  it("exists", () => {
    expect(job).not.toBe("");
  });

  it("runs after the deploy, and only when the deploy reported an address", () => {
    expect(job).toMatch(/^ {4}needs: deploy$/m);
    expect(job).toMatch(/^ {4}if: needs\.deploy\.outputs\.url != ''$/m);
  });

  it("only reads the repository: no Azure identity, no write access", () => {
    expect(job).toMatch(/permissions:\n\s+contents: read\n/);
    expect(job).not.toMatch(/id-token|pull-requests|secrets\./);
    expect(job).toMatch(/persist-credentials: false/);
  });

  it("checks out only what the script needs, and installs nothing from npm", () => {
    const patterns = (
      /sparse-checkout: \|\n((?: {12}\S.*\n)+)/.exec(job)?.[1] ?? ""
    )
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    // The version file setup-node reads, package.json (whose "type": "module" Node reads to run
    // the TypeScript as modules, as it does locally), the script and the rules it imports.
    expect(patterns).toEqual([
      "/.nvmrc",
      "/package.json",
      "/scripts/",
      "/src/e2e/",
    ]);
    expect(job).toContain("node-version-file: .nvmrc");
    expect(job).toContain("sparse-checkout-cone-mode: false");
    expect(job).not.toMatch(/npm ci|npm install|cache: npm/);
    // With package.json checked out, setup-node would turn its npm cache on by itself, and look for
    // a lockfile this job does not have.
    expect(job).toContain("package-manager-cache: false");
  });

  it("takes the address from the deploy step's output, passed through the environment", () => {
    expect(job).toContain("LIVE_URL: ${{ needs.deploy.outputs.url }}");
    expect(job).toContain('--url "${LIVE_URL}"');
    // An expression inside the script itself would be injected into it as text.
    expect(job.match(/run: [\s\S]*/)?.[0] ?? "").not.toContain("${{");
  });

  it("compares with the config of the build that was uploaded, in the build's own context", () => {
    expect(job).toMatch(/actions\/download-artifact@[0-9a-f]{40}/);
    expect(job).toContain("name: site");
    expect(job).toContain("--config dist/staticwebapp.config.json");
    expect(job).toContain(
      "DEPLOY_CONTEXT: ${{ github.event_name == 'pull_request' && 'preview' || 'production' }}",
    );
    expect(job).toContain('--context "${DEPLOY_CONTEXT}"');
  });

  it("pins its actions to full commit SHAs", () => {
    const uses = [...job.matchAll(/uses: (\S+)@(\S+) # v/g)];
    expect(uses.length).toBeGreaterThanOrEqual(3);
    for (const [, , ref] of uses) expect(ref).toMatch(/^[0-9a-f]{40}$/);
  });

  it("does not hide a failure", () => {
    expect(job).not.toMatch(/continue-on-error|\|\| true/);
  });

  it("does not stop the preview comment, which only needs the deploy", () => {
    const comment =
      deploy.match(/^ {2}comment:\n(?:(?! {2}\S).*\n?)*/m)?.[0] ?? "";
    expect(comment).toMatch(/^ {4}needs: deploy$/m);
  });

  it("names no host: the script and its rules take the address they are given", () => {
    for (const text of [job, script, rules]) {
      expect(text).not.toMatch(/azurestaticapps\.net|louislawson\.co\.uk/);
    }
  });
});
