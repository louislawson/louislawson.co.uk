# Build plan: louislawson.co.uk

Status (2026-10-16): **Phases 0, 1a and 1b approved for build.** Phases 2–8 are a draft: they will be reviewed, and may change substantially, after Phase 1b is complete. Sessions working on 1a or 1b treat later phases as context only.

This plan turns the agreed design and product decisions into phases and pull requests. Each phase is handed to a fresh agent session; Louis reviews and merges every PR and reviews each phase before the next one starts.

## Read first

| File                                                                                                | What it holds                                                                                                                                |
| --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| [`PRODUCT.md`](../PRODUCT.md)                                                                       | Product truth: audience, purpose, content honesty rules, privacy commitments, principles                                                     |
| [`.impeccable/surfaces/src-pages-index-astro.md`](../.impeccable/surfaces/src-pages-index-astro.md) | Surface brief and **direction contract** (the design authority)                                                                              |
| [`docs/design/`](design/)                                                                           | How the design was reached, plus the reference mock (`mock/`)                                                                                |
| [`CLAUDE.md`](../CLAUDE.md)                                                                         | Guardrails, definition of done and conventions for every PR                                                                                  |
| `PRIVATE-NOTES.md`                                                                                  | **Local only, gitignored.** Environment details. Read it; never copy anything from it into committed files, PRs, commit messages or the site |

Where the mock and the contract differ, **the contract wins**.

## Ground rules for every PR

The guardrails, definition of done and conventions every PR follows live in [`CLAUDE.md`](../CLAUDE.md), which every agent session loads automatically. This plan adds only what is phase-specific:

- **Squash merges** into a protected `main`.
- **Tooling beyond `CLAUDE.md`:** Prettier (+ `prettier-plugin-astro`), ESLint flat config (+ `eslint-plugin-astro`, `typescript-eslint`), Vitest, Playwright + `@axe-core/playwright` (no visual-regression snapshots), Trivy IaC scanning in CI.
- **Preview URLs** are expected in PR bodies from PR 1.5 onward.

---

## Phase 0 · Louis's prep (no agent PRs)

- [x] Create the **empty** public repo `louislawson/louislawson.co.uk` (no README, licence or `.gitignore` from GitHub).
- [x] GitHub email privacy settings ("Keep my email addresses private", "Block command line pushes that expose my email").
- [x] Install the Microsoft **Playwright MCP** plugin for agent sessions.
- [x] Confirm `PRIVATE-NOTES.md` is present in the working folder.
- Branch protection on `main` is set **after PR 1.2 merges**, because required status checks can only be selected once they have run.

## Phase 1a · Scaffold and bootstrap code

### PR 1.1 · `chore(repo): scaffold Astro site and repo hygiene`

- In the existing working folder: `git init -b main`; **set the repo-local `user.email` to the no-reply address in `PRIVATE-NOTES.md` before the first commit**; add the GitHub remote.
- Write `.gitignore` **first**, covering: `PRIVATE-NOTES.md`, `.claude/`, `.impeccable/mocks/`, `.impeccable/decision/`, `.impeccable/questions/`, `.impeccable/review/`, `.impeccable/hook.cache.json`, `.impeccable/config.local.json`, `node_modules/`, `dist/`, `.astro/`, `.env*` (except `.env.example`), `**/.terraform/`, `*.tfstate*`, `*.tfplan`, `crash.log`.
- Write `.gitattributes` alongside `.gitignore`, before anything else is staged, so every file is normalised from the first commit (authoring is on Windows, CI on Linux):
  - `* text=auto eol=lf` (matches Prettier's LF default and `.editorconfig`).
  - `binary` for images, fonts and PDFs (`*.png`, `*.jpg`, `*.jpeg`, `*.webp`, `*.avif`, `*.gif`, `*.ico`, `*.woff`, `*.woff2`, `*.pdf`).
  - `docs/design/mock/** linguist-documentation` so the mock doesn't skew GitHub's language stats.
- Write `.npmrc` with `min-release-age=7` **before** scaffolding, so every dependency resolved from the first install onward is at least a week old (most malicious npm releases are caught and pulled within days). `npm ci` in CI installs exactly the lockfile, so this gate protects what enters the lockfile; Dependabot's `cooldown: 7` (PR 1.2) is the matching control for automated updates. Add `devEngines.packageManager` (`npm`, `>=11.19.0`) to `package.json` so an npm too old to honour the setting can't be used.
- `npm create astro@latest . -- --template minimal --install --no-git --skip-houston --yes`; add `@astrojs/check` and `typescript@^6`; Prettier and ESLint configs. Versions resolve to the latest release older than 7 days, so Astro may land on an earlier 7.x than the newest.
- Markdown linting with `markdownlint-cli2` (0.23.x; needs Node ≥ 22) and a single `.markdownlint-cli2.jsonc`:
  - `config`: extends `markdownlint/style/prettier` (so it never fights Prettier), with `MD013` (line length) off for prose.
  - `globs`: `**/*.md`; `ignores`: `node_modules/**`, `.impeccable/**` (generated tooling files), `dist/**`, `CHANGELOG.md` if one appears.
  - Content Markdown under `src/content/` is linted too; frontmatter is supported.
- Scripts: `lint` (ESLint + markdownlint), `lint:md`, `format`, `format:check`, `check`. CI calls these scripts rather than separate actions, so local and CI runs use the same tools.
- `.nvmrc` (24), `engines` (`node >=22.22.0`), `.editorconfig` (`end_of_line = lf`), `LICENSE` (MIT, code only), `README.md` (what this is, how to run, licence note: "Code MIT; site content and photos © Louis Lawson, all rights reserved").
- Commit the planning docs: `CLAUDE.md`, `PRODUCT.md`, `docs/`, `.impeccable/surfaces/`. Fix any markdownlint findings in them in this PR.
- Minimal placeholder home page.
- **Acceptance:** `npm run build`, `check`, `lint`, `format:check` pass; `npm config get min-release-age` returns `7` in the repo; `git ls-files --eol` shows `i/lf` for every text file; first commit's file list matches the expected list in the PR; `PRIVATE-NOTES.md` and mocks are untracked; commit author email is the no-reply address.

### PR 1.2 · `ci: baseline workflow, workflow linting and Dependabot`

- `.github/workflows/ci.yml` on pull requests and pushes to `main`:
  - `permissions: {}` at workflow level; each job declares only what it needs (`contents: read` for most).
  - `concurrency: { group: ${{ github.workflow }}-${{ github.ref }}, cancel-in-progress: true }`; `timeout-minutes` on every job.
  - `actions/checkout` v7 with `persist-credentials: false`; `actions/setup-node` v7 with `node-version-file: .nvmrc` and `cache: npm`; `npm ci`.
  - Jobs: lint (ESLint and markdownlint via `npm run lint`), format check, `astro check`, build.
  - Untrusted event data (PR titles, branch names) reaches scripts only through `env:`, never interpolated into `run:`.
- Secret scanning: `gitleaks/gitleaks-action` v3 with `fetch-depth: 0` (GitHub's own secret scanning also runs automatically on public repos).
- Workflow security: **zizmor** (`zizmorcore/zizmor-action`, configured so findings fail the job rather than SARIF-only mode) and **actionlint** (version-pinned binary), both run on every change under `.github/`.
- `.github/dependabot.yml` (`version: 2`):
  - `npm` at `/` and `github-actions` at `/`. The `terraform` entry is added by PR 1.3 (`directories: ["/infra/bootstrap"]`, `group-by: dependency-name`) and PR 1.4 adds `/infra/site`, so Dependabot never points at a directory that does not exist yet.
  - Weekly schedule; one `minor-patch` group per ecosystem, majors as separate PRs; `cooldown: { default-days: 7 }` (security updates are never delayed); `commit-message: { prefix: "chore", include: "scope" }`; `labels: ["dependencies"]` (the label must exist first); `versioning-strategy: increase` for npm only.
- **Acceptance:** CI, zizmor and actionlint pass on the PR; a deliberately committed fake secret in a throwaway branch is caught (shown in the PR description, branch deleted); every third-party action is pinned to a full SHA with a `# vX.Y.Z` comment.
- **After merge (Louis):** protect `main` (require a PR and the CI checks, squash merge only, delete branches on merge); under Settings → Advanced Security enable Dependabot alerts, security updates and grouped security updates; create the `dependencies` label.

### PR 1.3 · `infra(bootstrap): state storage, CI identities and role assignments`

- `infra/bootstrap/` Terraform, applied **once, locally, by Louis** with `az login` (the agent writes and validates it, never applies it). Layout per the HashiCorp style guide: `terraform.tf`, `providers.tf`, `main.tf`, `variables.tf`, `outputs.tf`, `locals.tf`.
- **Versions:** `required_version = ">= 1.15, < 2.0"` (Dependabot's Terraform support currently ends at 1.15.x); `azurerm ~> 5.10`; no `azuread` provider. `.terraform.lock.hcl` committed, locked for `windows_amd64` and `linux_amd64`.
- **Dependabot:** add the `terraform` entry to `.github/dependabot.yml` for `directories: ["/infra/bootstrap"]` (weekly, `cooldown: { default-days: 7 }`, a `minor-patch` group with `group-by: dependency-name`, and the same `labels` and `commit-message` as the other ecosystems).
- **Provider:** `storage_use_azuread = true`; `resource_providers_to_register = ["Microsoft.Web", "Microsoft.Storage", "Microsoft.ManagedIdentity"]` (azurerm 5.x no longer registers providers automatically).
- **State storage:** resource group `rg-louislawson-tfstate-weu`; StorageV2 account `stlouislawsontfstate` with `shared_access_key_enabled = false`, `min_tls_version = "TLS1_2"`, `https_traffic_only_enabled = true`, `allow_nested_items_to_be_public = false`, `infrastructure_encryption_enabled = true`, `account_replication_type = "ZRS"` (a few KB of versioned state has no stated need for a second-region copy), blob versioning, 30-day blob and container soft delete, `lifecycle { prevent_destroy = true }`; two private containers, `tfstate` (site stack state, used by the CI identities) and `tfstate-bootstrap` (this stack's own state, operator only), both with `prevent_destroy` and created with `azurerm_storage_container` using `storage_account_id` (azurerm 5.x creates it through Azure Resource Manager, so no data-plane role is needed to create it). Public network access stays enabled (GitHub-hosted runners have no stable IPs); Entra-only auth and RBAC are the control. The provider sets `features { storage { data_plane_available = false } }` so creating the account never touches the storage data plane, where the signed-in Owner has no role until the same apply creates it.
- **Tags** (shared by `infra/bootstrap` and `infra/site`, same keys): `project = "personal-website"`, `env = "prod"`, `managed-by = "terraform"`, `repo = "louislawson/louislawson.co.uk"`, plus `stack` (`bootstrap` or `site`).
- **Site resource group** `rg-louislawson-web-prod-weu`, created here so the CI identities can be scoped to it.
- **Two user-assigned managed identities** with federated credentials (no app registration, no Entra directory roles needed):
  - `id-louislawson-web-plan`, trusted for `pull_request` and `ref:refs/heads/main`. Used for Terraform plan, PR preview deploys and production site deploys. Roles: Reader and a custom Static Web App Reader role on the site resource group (the custom role adds the `listSecrets` and `listAppSettings` actions that Reader lacks, so plan can refresh the app and the deploy workflows can fetch its deployment token; the built-in Website Contributor covers `sites/*`, not `staticSites/*`); Storage Blob Data Contributor on the `tfstate` container only (plan takes a blob lease lock). It has no access to `tfstate-bootstrap`: it is trusted for every pull request, so it must not be able to tamper with the state of the stack that owns the identities.
  - `id-louislawson-web-apply`, trusted only for `environment:production`. Used for Terraform apply. Roles: Contributor on the site resource group; Storage Blob Data Contributor on the `tfstate` container only.
  - Nothing at subscription scope.
- **OIDC subjects use GitHub's immutable format.** Repos created after 15 July 2026 emit `repo:<owner>@<ownerId>/<repo>@<repoId>:<context>`; credentials in the older `repo:<owner>/<repo>:…` form silently fail to match. Subjects are built from variables (`github_owner`, `github_owner_id`, `github_repo`, `github_repo_id`); the README shows how to read the repo ID (`gh api repos/<owner>/<repo> --jq .id`) and how to confirm the subject from the "Federated token details" line of the first `azure/login` run. Mismatches surface as `AADSTS700213`.
- **Louis's own access:** Storage Blob Data Contributor on both containers for the signed-in user (Owner covers the control plane only), so the bootstrap state can be migrated and the site stack can be planned locally.
- **Outputs (non-secret):** plan client ID, apply client ID, tenant ID, subscription ID.
- `infra/bootstrap/README.md`, exact steps for Louis:
  1. `az login`, `terraform init`, `terraform apply` with the GitHub variables.
  2. Back up the local state, add the `azurerm` backend block (`storage_account_name`, `container_name = "tfstate-bootstrap"`, `key = "bootstrap.tfstate"`, `use_azuread_auth = true`, `use_cli = true`; the tenant comes from the signed-in CLI session) and run `terraform init -migrate-state`. Bootstrap only ever runs locally, so CLI auth is fixed in the block.
  3. Set GitHub **Actions secrets** `AZURE_PLAN_CLIENT_ID`, `AZURE_APPLY_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`, and **Dependabot secrets** with the same names (Dependabot-triggered runs read only the Dependabot secrets; these IDs never go into committed files). Never repository variables: the repository is public, and a variable is printed unmasked in the env header of the step that masks it, whereas the runner masks a secret from the first log line.
  4. Create the `production` environment with Louis as required reviewer.
  5. Note: federated credentials can take a few minutes to propagate (`AADSTS70021`).
- **Acceptance:** `fmt`, `validate`, `tflint` (with the azurerm ruleset) clean; Trivy and Snyk IaC clean or findings explained; no IDs, tfvars with real values, state or secrets committed.

**Handback point:** the session stops after 1.3. Louis merges, applies the bootstrap, migrates its state, sets the Actions and Dependabot secrets and the environment. Phase 1b starts in a new session.

## Phase 1b · Walking skeleton live

### PR 1.4 · `infra(site): Static Web App and infrastructure pipeline`

- **Dependabot:** add `/infra/site` to the `directories` of the **existing** `terraform` entry in `.github/dependabot.yml` (added by PR 1.3), not a new entry; `group-by: dependency-name` only takes effect across the entry's multiple directories.
- **Tags:** use the same tag keys as bootstrap (`project`, `env`, `managed-by`, `repo`, `stack`); the mocked test asserts them.
- `infra/site/` (same layout and version pins as bootstrap): committed `azurerm` backend block holding only non-sensitive placement and the auth type (`storage_account_name`, `container_name = "tfstate"`, `key = "site.tfstate"`, `use_azuread_auth = true`); **credentials and the auth method come from environment variables**, as the backend docs recommend (values passed with `-backend-config` are written into `.terraform/` and plan files). CI sets `ARM_USE_OIDC=true`, `ARM_CLIENT_ID`, `ARM_TENANT_ID` and `ARM_SUBSCRIPTION_ID` from Actions secrets (same-named Dependabot secrets for Dependabot runs; never repository variables, which print unmasked in a public log), and the provider and backend both pick up GitHub's OIDC token automatically; a local plan by Louis sets `ARM_USE_CLI=true` instead. `lookup_blob_endpoint` stays `false`, so no `resource_group_name` and no Reader role on the storage account are needed; data source for the site resource group; `azurerm_static_web_app` (`sku_tier`/`sku_size` Free, West Europe, tags, `preview_environments_enabled = true`, and `lifecycle { ignore_changes = [repository_branch, repository_url] }`, because deploying with the API key from CI makes Azure record those fields and the provider would otherwise show drift on every plan). Written as the resource directly rather than through a wrapper module (one resource gains nothing from indirection), following the conventions of Microsoft's Azure Verified Module for Static Web Apps: typed and described variables for name, location, SKU and tags; `sku_tier`/`sku_size` set explicitly to Free even though it is the default; and `lifecycle { prevent_destroy = true }` as deletion protection (the AVM module offers a `CanNotDelete` management lock instead, which would need Owner-level rights the apply identity doesn't have). The AVM module itself can't be called here: version 0.6.x requires azurerm 4.x (`< 5.0.0`). Output: default hostname.
- `infra/site/tests/static_web_app.tftest.hcl`: `terraform test` with `mock_provider "azurerm"`, so it runs in CI without Azure access. It asserts the Free SKU, West Europe, the required tags, `preview_environments_enabled = true` and SKU validation. `terraform test` cannot observe lifecycle rules (nor seed non-computed attributes in a mocked state), so a workflow step greps the Static Web App block for `ignore_changes` on `repository_branch` and `repository_url` and for `prevent_destroy = true`; the proof that there is no drift is the plan after the first deploy.
- `.github/workflows/infra.yml`:
  - **Plan** on PRs touching `infra/**` (plan identity, no environment so the `pull_request` subject applies; `id-token: write`, `pull-requests: write`): `fmt -check`, `init -lockfile=readonly`, `validate`, `tflint` (azurerm ruleset), Trivy, `terraform test`, `plan`; post the plan as a sticky PR comment, which a failed plan overwrites with a notice so it is never stale. **Dependabot's own run skips the plan job** (`github.triggering_actor != 'dependabot[bot]'`; checks still run, unprivileged): the plan identity can read the deployment token, so Louis reads a provider bump first and then re-runs the workflow, which makes him the triggering actor; the re-run keeps Dependabot's privileges, so it uses the same-named Dependabot secrets and posts no comment.
  - **Plan on `main` and manual dispatch:** pushes to `main` that change `infra/site` (not Markdown or tests) plan too, so the plan is on screen while the production approval is pending. `workflow_dispatch` from `main` runs checks and plan only, never apply, to prove a plan against the live app.
  - **Apply** on those pushes to `main` (apply identity, `environment: production` so Louis approves). It re-plans, because a saved plan would embed the `api_key`, and refuses a commit only when a later commit on `main` changed `infra/site` (outside Markdown and tests), since that commit has a run of its own; a later docs-only or non-infra merge starts no run and must not strand this one. Nothing is cancelled mid-run (a killed run can leave the state lease held); the workflow-level concurrency group serialises applies, so there is no separate `tf-site-prod` group. Azure IDs come from Actions secrets only.
  - Trivy: `aquasecurity/trivy-action` pinned to the SHA of **0.35.0 or later**. Earlier tags were compromised in March 2026 (CVE-2026-33634).
  - `actions/setup-node` is not used in these jobs; any privileged job that does use it sets `package-manager-cache: false`.
- **Acceptance:** plan comment appears on the PR; after merge and approval the Static Web App exists. Verify the plan identity's Reader + custom Static Web App Reader role is enough for plan to refresh the Static Web App (the provider reads its API key and app settings); if not, document the fix in the PR. Troubleshooting: if the first `apply` hangs after the Static Web App has already been created (a reported provider issue), retry with `-parallelism=1` before changing anything else. To see more, debug **locally** (or log to a file with `TF_LOG_PATH` that is never uploaded), never with `TF_LOG` in a public CI log: debug output includes full response bodies, and the `listSecrets` response carries the deployment token, which `add-mask` does not cover.

### PR 1.5 · `ci(deploy): build and deploy via OIDC with PR previews`

- `.github/workflows/deploy.yml`:
  - **Build** job (unprivileged, `contents: read`): build with `SITE_URL`, `BUILD_NUMBER` (`GITHUB_RUN_NUMBER`) and `GIT_SHA` (short); upload `dist` as an artifact.
  - **Deploy** job (privileged, plan identity, `id-token: write`, no `npm install`): download the artifact; `azure/login` v3 with OIDC; fetch the deployment token at run time with `az staticwebapp secrets list … --query properties.apiKey -o tsv`, mask it with `::add-mask::` (never stored as a GitHub secret or printed). Note the Static Web App resource exports `api_key`, so the token does exist in Terraform state; that state lives in a private container reachable only through Entra ID, and the workflow never reads it from Terraform outputs; deploy with `Azure/static-web-apps-deploy@v1` (`action: upload`, `skip_app_build: true`, `app_location: dist`, `output_location: ''`).
  - **Azure IDs** come from `secrets.*` only, never `vars.*`. YAML anchors do not cross files, so `deploy.yml` cannot reuse the `&mask_azure_ids` step in `infra.yml`. This PR extracts it into a local composite action (for example `.github/actions/mask-azure-ids/action.yml`) and uses it from both workflows (it masks first, then fails naming the secret if one is empty or not a GUID, never printing a value). Check that actionlint and zizmor accept the composite action, and that the secrets still reach it as environment variables rather than inputs that print in the log.
  - PRs deploy to preview environments and post the URL; a `close_pull_request_job` on `pull_request` `types: [closed]` runs `action: close`, so environments never leak.
  - **Preview slots:** the Free plan allows **3 preview environments per app**. Previews are skipped for Dependabot PRs (`github.actor != 'dependabot[bot]'`) and, via a `paths` filter, for PRs that change only `docs/**`, `infra/**`, `.github/**` (other than the deploy workflow) or Markdown outside `src/`; those PRs still build and test. If a fourth preview is needed the deploy step fails clearly; merging or closing an older PR frees a slot. Preview URLs are public.
- `public/staticwebapp.config.json`: baseline security headers (strict CSP starting at `default-src 'self'`, `frame-ancestors 'none'`, HSTS, `Referrer-Policy`, `Permissions-Policy`, `X-Content-Type-Options`), 404 route, long cache for hashed assets, short revalidation for HTML.
- `src/config/site.ts`: `launch: false`; site URL from env. The build job passes `DEPLOY_CONTEXT` (`preview` for pull requests, `production` for `main`), and `noindex` (meta tag and an `X-Robots-Tag` header in the generated `staticwebapp.config.json`) is sent when **either** the site isn't launched **or** the build is a preview. Preview URLs are public and served from `*.azurestaticapps.net`, so after launch they would otherwise be indexed as duplicates of the real site.
- **Acceptance:** production URL serves the skeleton with `noindex`; the PR shows a working preview URL; response headers verified in the PR description.

## Phase 2 · Content model and gates

### PR 2.1 · `feat(content): content schema and placeholder content`

- Projects collection (`src/content.config.ts`): `code`, `title`, `summary`, `status` (in-service / commissioning / complete / archived), `period`, `featured`, `descriptor` **or** `org` (org only for personal/open-source work), `headline` (2–5 words), `setup`, `change`, `result`, `measurements` (optional, real only), `stack`, `links`, `order`.
- `src/data/profile.ts`: role line, intro, career line, region, availability `{ text, until }`, email, links, skills `[{ group, context, tools, runs }]`, exploring list, certifications, garage `[{ name, note, photo, alt, caption }]`.
- Placeholder convention: strings starting `TODO:`. Placeholder entries for everything except R04 (real).
- Vitest, test-first: invalid entries fail the build; exactly one featured project; `descriptor` xor `org`; every skill `runs` code exists; availability past `until` is dropped.
- **Acceptance:** Louis can start writing content and the build says exactly what is wrong.

### PR 2.2 · `feat(content): placeholder gate and launch switch`

- `npm run placeholders` lists every remaining placeholder.
- Preview builds render placeholders hatched and announced; production builds omit optional placeholders and hide any section left empty (and its nav link and number key).
- Required set for launch: intro with career line, role line, ≥2 real projects, email, LinkedIn, CV.
- CI: PRs get a warning annotation listing placeholders; with `launch: true`, a production deploy fails if any required item is missing.
- **Acceptance:** tests cover preview vs production rendering decisions and the gate.

### PR 2.3 · `ci(privacy): photo location and PDF metadata checks`

- Script and CI job: fail on any committed image with GPS metadata; fail on any committed PDF with author, creator-path or similar metadata. Fixtures for both.
- README section: how to strip metadata before committing.
- **Acceptance:** fixtures with metadata fail, clean fixtures pass.

## Phase 3 · Design system and shell

### PR 3.1 · `feat(ui): design tokens, fonts and base styles`

- Self-host `@fontsource-variable/martian-mono` (width and weight axes).
- Tokens exactly as the contract's OWN-WORLD block; browser surfaces (selection, caret, focus ring, scrollbar, underline offset, tabular numerals); reduced-motion base; authored icon component (24px, 1.6 stroke).
- **Acceptance:** contrast ratios for every text/ground pairing listed in the PR; no external font requests.

### PR 3.2 · `feat(ui): layout, navigation, footer and 404`

- Base layout (meta, canonical from site URL, `noindex` logic), skip link.
- Sticky nav: `louis.lawson`, section links with number keys 1–5 (only for rendered sections), mobile menu, current-section state.
- Footer: updated date, built-with and repo link, one-line analytics note. 404 page in the same world.
- **Acceptance:** keyboard-only navigation works; matches the mock's nav and footer.

### PR 3.3 · `feat(ui): inspect mode`

- `data-inspect` labels authored in components (each states a true fact about how that part is built or served); toggle button and `i` key; 12-column grid overlay; accessible explanatory note.
- **Acceptance:** labels are accurate for the real build; toggling is announced; no contract text leaks into the page.

## Phase 4 · Home page

### PR 4.1 · `feat(home): hero`

Name with block caret (still under reduced motion), role, intro, career line, actions. Matches the mock hero (left column).

### PR 4.2 · `feat(home): trace panel`

- Harvest the trace logic into pure functions (hop list and timings from Navigation Timing, bar proportions, LCP) with unit tests; a small client script renders and replays it.
- Hop labels are generic and name no providers: "DNS lookup for `<host>`", "connection", "first byte from the nearest edge server", "this page", "painted".
- Build number and commit come from build env; local builds show "local build".
- Without JavaScript the panel explains that timings need JavaScript, rather than showing empty values. Unmeasured steps show an ellipsis, never a guess.
- **Acceptance:** real values on the preview URL; replay works; reduced motion shows a still panel.

### PR 4.3 · `feat(home): projects section`

Full run-sheet strips for ≤3 projects, compact rows for ≥4; curated order with periods; featured first and tagged; whole entry links to its run sheet. Tests for the strip/row switch.

### PR 4.4 · `feat(home): skills, exploring and certifications`

Context-first skill rows with "seen in" links (absent when no public project); quieter exploring list; certifications with verify links.

### PR 4.5 · `feat(home): garage with ASCII wheel and photo dither`

- Harvest the wheel renderer as a pure frame function (unit-tested); animation at ~30fps pauses off-screen and when the tab is hidden; still under reduced motion.
- Build-time photo pipeline: `sharp` reads each photo and writes the ASCII dither into the HTML; Astro image optimisation strips metadata; full-colour photo loads lazily on hover/focus. Designed empty state when a photo is missing.
- **Acceptance:** zero client-side image processing; captions name event and vehicle only.

### PR 4.6 · `feat(home): contact and availability`

Mailto alias, LinkedIn, GitHub, CV (disabled-looking in preview when unset), availability that disappears after its `until` date, region.

## Phase 5 · Project pages and sharing

### PR 5.1 · `feat(projects): run-sheet pages`

`/projects/[slug]`: setup/change/result panel, measurements as a before/after diff (hidden when empty), tools, write-up prose styles, next project. R04 "This website" written for real (Terraform, OIDC, GitHub Actions, Static Web Apps), status `commissioning` until launch.

### PR 5.2 · `feat(seo): social preview images, sitemap and robots`

Per-page Open Graph images generated at build (`satori` + `@resvg/resvg-js`); meta tags; `@astrojs/sitemap` and a permissive `robots.txt` only when `launch: true`, otherwise disallow all.

## Phase 6 · Hardening

### PR 6.1 · `test(e2e): Playwright, axe, HTML validation and link checks`

Playwright against the built site: pages render, number keys, inspect mode, reduced motion, 404; axe on home and a project page; `html-validate`; `lychee` link check. All in CI.

### PR 6.2 · `feat(security): final CSP and analytics`

Cloudflare Web Analytics snippet (token is public config); CSP updated to allow only its beacon; headers asserted by a test.

### PR 6.3 · `fix(ui): responsive and accessibility pass`

Run Impeccable `adapt` and `audit`; fix what they find at phone, tablet and desktop widths.

### PR 6.4 · `ci(security): OpenSSF Scorecard`

Its own workflow (`ossf/scorecard-action` v2, SHA-pinned) on push to `main` and a weekly schedule, `publish_results: true`, results uploaded to code scanning, badge in the README. Expected low scores on Code-Review and Branch-Protection for a solo repo are noted in the PR rather than gamed.

## Phase 7 · Finish and document

### PR 7.1 · `docs(design): finish review and DESIGN.md`

Impeccable finish workflow: detector run, desktop and mobile captures, the `impeccable-finish-reviewer` agent, one batch of fixes, then the `impeccable-documenter` writes `DESIGN.md` and `.impeccable/design.json`.

### PR 7.2 · `docs: runbook`

README runbook: editing content, the placeholders command, adding photos safely, the launch checklist, and generic steps for connecting a custom domain to Azure Static Web Apps (provider-specific details stay in `PRIVATE-NOTES.md`).

## Phase 8 · Louis's launch (no agent PRs)

- [ ] Real content, photos (metadata stripped) and the web-safe CV.
- [ ] Flip `launch: true` (the gate now enforces the required set).
- [ ] Connect the domain (steps in `PRIVATE-NOTES.md`), update `SITE_URL`.
- [ ] Set R04 to `in-service`.

---

## Handoff per phase

Each phase is handed to a fresh Sonnet session using the **`handoff` skill** (`mattpocock-skills:handoff`), which writes a handoff document; the new session starts from that document. The handoff carries:

- **Goal and stop condition:** the phase's PR list; open the PRs in order, then stop and report. Never merge.
- **Read first:** this plan, `PRODUCT.md`, the surface brief and contract, `docs/design/`, and the local `PRIVATE-NOTES.md`.
- **Suggested skills and tools:**
  - All phases: `code-review`, Snyk MCP scans, context7 for docs.
  - Phase 1: `terraform-style-guide`, `terraform-skill`, the Terraform MCP (provider docs and versions).
  - Phases 2, 4.2, 4.5: `mattpocock-skills:tdd`.
  - Phases 3–7: `impeccable` (load `craft-floor.md` before UI edits), Playwright MCP or the built-in browser for checking previews.
- **Constraints:** `CLAUDE.md` (loaded automatically), especially the privacy guardrails and no invented content.

## Decisions from the phase review

1. **Trace labels are generic** and name no providers (PR 4.2).
2. **Handoffs use the `handoff` skill** to write a document per phase.
3. **Preview environments:** the Free plan's limit of 3 is handled by skipping previews for PRs that can't change the rendered site, and by merging or closing PRs promptly (PR 1.5). The Free plan's 2 custom domains per app exactly covers the apex and `www`.

## References

### CI workflow (PR 1.2, 1.4, 1.5)

- [Secure use reference for GitHub Actions](https://docs.github.com/en/actions/reference/security/secure-use): least-privilege tokens, full-SHA pinning, script injection, `pull_request_target` risks.
- [Workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax): `permissions`, `concurrency`, `timeout-minutes`.
- [OpenID Connect reference](https://docs.github.com/en/actions/reference/security/oidc): subject formats and precedence, including the immutable `repo:OWNER@ID/REPO@ID:…` format.
- [Configuring OpenID Connect in Azure](https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-azure) and [Microsoft Learn: authenticate to Azure from GitHub Actions by OIDC](https://learn.microsoft.com/en-us/azure/developer/github/connect-from-azure-openid-connect).
- [Azure/login](https://github.com/Azure/login), [actions/checkout](https://github.com/actions/checkout), [actions/setup-node](https://github.com/actions/setup-node).
- [zizmor](https://docs.zizmor.sh/), [actionlint](https://github.com/rhysd/actionlint), [OpenSSF Scorecard checks](https://github.com/ossf/scorecard/blob/main/docs/checks.md), [scorecard-action](https://github.com/ossf/scorecard-action).
- [gitleaks-action](https://github.com/gitleaks/gitleaks-action); [About secret scanning](https://docs.github.com/en/code-security/secret-scanning/introduction/about-secret-scanning).
- [Trivy advisory GHSA-69fq-xp46-6x23 (CVE-2026-33634)](https://github.com/aquasecurity/trivy/security/advisories/GHSA-69fq-xp46-6x23): why `trivy-action` must be pinned to 0.35.0 or later.
- [Static Web Apps build configuration](https://learn.microsoft.com/en-us/azure/static-web-apps/build-configuration), [PR preview environments](https://learn.microsoft.com/en-us/azure/static-web-apps/review-publish-pull-requests), [hosting plans](https://learn.microsoft.com/en-us/azure/static-web-apps/plans), [`az staticwebapp secrets`](https://learn.microsoft.com/en-us/cli/azure/staticwebapp/secrets).

### Dependabot (PR 1.2)

- [Dependabot options reference](https://docs.github.com/en/code-security/dependabot/working-with-dependabot/dependabot-options-reference): ecosystems (Terraform supported up to 1.15.x), `directories`, groups, `group-by`, cooldown, labels, commit messages.
- [Optimizing PR creation](https://docs.github.com/en/code-security/dependabot/dependabot-version-updates/optimizing-pr-creation-version-updates): grouping and cooldown.
- [Keeping your actions up to date](https://docs.github.com/en/code-security/dependabot/working-with-dependabot/keeping-your-actions-up-to-date-with-dependabot) and [supported ecosystems](https://docs.github.com/en/code-security/dependabot/ecosystems-supported-by-dependabot/supported-ecosystems-and-repositories): SHA-pinned actions and same-line version comments.
- [Troubleshooting Dependabot on GitHub Actions](https://docs.github.com/en/code-security/dependabot/troubleshooting-dependabot/troubleshooting-dependabot-on-github-actions): read-only tokens and Dependabot secrets.
- [Configuring Dependabot security updates](https://docs.github.com/en/code-security/dependabot/dependabot-security-updates/configuring-dependabot-security-updates).

### Terraform bootstrap and state (PR 1.3, 1.4)

- [azurerm backend for Terraform 1.15](https://developer.hashicorp.com/terraform/language/v1.15.x/backend/azurerm) (the lowest version the plan allows; see also the [latest](https://developer.hashicorp.com/terraform/language/backend/azurerm)): Entra ID auth and its OIDC and Azure CLI sub-types, environment variables for credentials, Storage Blob Data Contributor at container scope, `lookup_blob_endpoint`.
- [azurerm provider configuration](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs) (5.10): `storage_use_azuread` (defaults to `false`), `resource_provider_registrations` (defaults to `none` in 5.x), `resource_providers_to_register`, `use_cli` / `use_oidc` defaults. Resource pages for [`azurerm_static_web_app`](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/static_web_app) (the `repository_*` drift note, `api_key` attribute) and [`azurerm_storage_container`](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/storage_container) (`storage_account_id`).
- [Prevent Shared Key authorization](https://learn.microsoft.com/en-us/azure/storage/common/shared-key-authorization-prevent) and [Store Terraform state in Azure Storage](https://learn.microsoft.com/en-us/azure/developer/terraform/store-state-in-azure-storage) (useful background; its examples use access keys and an older provider).
- [Backend configuration](https://developer.hashicorp.com/terraform/language/backend), [`terraform init`](https://developer.hashicorp.com/terraform/cli/commands/init), [`terraform providers lock`](https://developer.hashicorp.com/terraform/cli/commands/providers/lock), [dependency lock file](https://developer.hashicorp.com/terraform/language/files/dependency-lock), [style guide](https://developer.hashicorp.com/terraform/language/style).
- [Azure Landing Zones IaC accelerator](https://azure.github.io/Azure-Landing-Zones/accelerator/), [AVM CI/CD bootstrap module for GitHub](https://github.com/Azure/terraform-azure-avm-ptn-alz-application-landing-zone-cicd-bootstrap-github), [accelerator bootstrap modules](https://github.com/Azure/accelerator-bootstrap-modules): Microsoft's reference bootstraps (managed identities, separate plan and apply).
- [Federated credentials on a user-assigned managed identity](https://learn.microsoft.com/en-us/entra/workload-id/workload-identity-federation-create-trust-user-assigned-managed-identity), [workload identity federation considerations](https://learn.microsoft.com/en-us/entra/workload-id/workload-identity-federation-considerations), [migrating GitHub federated credentials to immutable subjects](https://learn.microsoft.com/en-us/entra/workload-id/workload-identities-github-immutable-subjects).
- [tflint-ruleset-azurerm](https://github.com/terraform-linters/tflint-ruleset-azurerm).

### Static Web App resource (PR 1.4, 1.5)

- [`azurerm_static_web_app`](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/static_web_app): arguments, the `repository_*` drift note for API-key deploys, the exported `api_key`.
- [Azure Verified Module for Static Web Apps](https://github.com/Azure/terraform-azurerm-avm-res-web-staticsite) (`Azure/avm-res-web-staticsite`): Microsoft's reference implementation and its free-tier example; conventions borrowed, module not used (requires azurerm 4.x).
- [Terraform tests](https://developer.hashicorp.com/terraform/language/tests) and [mocks](https://developer.hashicorp.com/terraform/language/tests/mocking): `terraform test`, `mock_provider`.
- [Quotas in Azure Static Web Apps](https://learn.microsoft.com/en-us/azure/static-web-apps/quotas): Free plan, 3 preview environments and 2 custom domains per app.
- [Review pull requests in pre-production environments](https://learn.microsoft.com/en-us/azure/static-web-apps/review-publish-pull-requests): previews are public, three on Free alongside production, deleted when the PR closes.
- [Microsoft Q&A: Terraform apply hanging on a static web app](https://learn.microsoft.com/en-ie/answers/questions/5509996/how-to-successfully-create-a-static-web-app-using): the troubleshooting note above.
