# Build plan: louislawson.co.uk

Status (2026-10-23): **Phases 0 to 7 are built.** Phase 8 is Louis's own launch, following section 7 of [`docs/RUNBOOK.md`](RUNBOOK.md#7-the-launch-checklist). Sessions treat any phase not approved for build as context only.

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
  - **Plan** on PRs touching `infra/**` (plan identity, no environment so the `pull_request` subject applies; `id-token: write`, `pull-requests: write`): `fmt -check`, `init -lockfile=readonly`, `validate`, `tflint` (azurerm ruleset), Trivy, `terraform test`, `plan`; post the plan as a sticky PR comment, which a failed plan overwrites with a notice so it is never stale. **Dependabot's own run skips the plan job** (`github.triggering_actor != 'dependabot[bot]'`; checks still run, unprivileged): the plan identity can read the deployment token, so Louis reads a provider bump first and then re-runs the workflow, which makes Louis the triggering actor; the re-run keeps Dependabot's privileges, so it uses the same-named Dependabot secrets and posts no comment.
  - **Plan on `main` and manual dispatch:** pushes to `main` that change `infra/site` (not Markdown or tests) plan too, so the plan is on screen while the production approval is pending. `workflow_dispatch` from `main` runs checks and plan only, never apply, to prove a plan against the live app.
  - **Apply** on those pushes to `main` (apply identity, `environment: production` so Louis approves). It re-plans, because a saved plan would embed the `api_key`, and refuses a commit only when a later commit on `main` changed `infra/site` (outside Markdown and tests), since that commit has a run of its own; a later docs-only or non-infra merge starts no run and must not strand this one. Nothing is cancelled mid-run (a killed run can leave the state lease held); the workflow-level concurrency group serialises applies, so there is no separate `tf-site-prod` group. Azure IDs come from Actions secrets only.
  - Trivy: `aquasecurity/trivy-action` pinned to the SHA of **0.35.0 or later**. Earlier tags were compromised in March 2026 (CVE-2026-33634).
  - `actions/setup-node` is not used in these jobs; any privileged job that does use it sets `package-manager-cache: false`.
- **Acceptance:** plan comment appears on the PR; after merge and approval the Static Web App exists. Verify the plan identity's Reader + custom Static Web App Reader role is enough for plan to refresh the Static Web App (the provider reads its API key and app settings); if not, document the fix in the PR. Troubleshooting: if the first `apply` hangs after the Static Web App has already been created (a reported provider issue), retry with `-parallelism=1` before changing anything else. To see more, debug **locally** (or log to a file with `TF_LOG_PATH` that is never uploaded), never with `TF_LOG` in a public CI log: debug output includes full response bodies, and the `listSecrets` response carries the deployment token, which `add-mask` does not cover.

### PR 1.5 · `ci(deploy): build and deploy via OIDC with PR previews`

- `.github/workflows/deploy.yml`:
  - **Build** job (unprivileged, `contents: read`): build with `SITE_URL`, `BUILD_NUMBER` (`GITHUB_RUN_NUMBER`) and `GIT_SHA` (short); upload `dist` as an artifact.
  - **Deploy** job (privileged, plan identity, `id-token: write`, no `npm install`): download the artifact; `azure/login` v3 with OIDC; fetch the deployment token at run time with `az staticwebapp secrets list … --query properties.apiKey -o tsv`, mask it with `::add-mask::` (never stored as a GitHub secret or printed). Note the Static Web App resource exports `api_key`, so the token does exist in Terraform state; that state lives in a private container reachable only through Entra ID, and the workflow never reads it from Terraform outputs; deploy with Microsoft's Static Web Apps client (`StaticSitesClient`, the code inside `Azure/static-web-apps-deploy`), run by the local `swa-client` action from `mcr.microsoft.com/appsvc/staticappsclient` pinned by digest (tracked by a Dependabot `docker` entry), with `upload`, `app_location: dist` and the app and API builds skipped. The container gets only the deployment token, those settings and the job's public GitHub context: not the job's environment (OIDC request and runtime tokens) or the runner's Docker socket, which the Docker action would hand it.
  - **Azure IDs** come from `secrets.*` only, never `vars.*`. YAML anchors do not cross files, so `deploy.yml` cannot reuse the `&mask_azure_ids` step in `infra.yml`. This PR extracts it into a local composite action (for example `.github/actions/mask-azure-ids/action.yml`) and uses it from both workflows (it masks first, then fails naming the secret if one is empty or not a GUID, never printing a value). Check that actionlint and zizmor accept the composite action. Inputs or environment variables are both fine for the Azure IDs: the protection is that every value comes from `secrets.*`, which the runner masks from the first log line, and never from `vars.*` or a literal, which would print unmasked in a public log.
  - PRs deploy to preview environments and post the URL; removing a preview is a separate workflow, `preview-cleanup.yml`, on `pull_request` `types: [closed, converted_to_draft]` with no paths filter. It checks that a preview environment exists for the pull request number and runs `action: close` only if so, so environments never leak and a pull request that never had a preview still finishes green.
  - **Preview slots:** the Free plan allows **3 preview environments per app**. Previews are skipped for Dependabot PRs (tested on the pull request author, `github.event.pull_request.user.login`, not the actor) and for drafts (a draft builds in CI and gets its preview when marked ready; a pull request converted back to draft has its preview removed), and, via a `paths` **allow-list** on pull requests (pushes to `main` use a **deny-list** instead, which fails safe: anything not explicitly excluded still deploys production, and only docs, `infra/`, tooling folders, tests, the test, lint and format configs, editor and ignore files, the licence, Markdown outside `src/` and the workflows other than the deploy workflow and the local actions are excluded, so a build input added later can never leave production on an old build), for PRs that change nothing the build reads: only `src/**` (except tests, specs and fixtures), `public/**`, `astro.config.mjs`, `package.json`, `package-lock.json`, `.npmrc`, `.nvmrc`, `tsconfig.json`, the deploy workflow and `.github/actions/**` can change the built site, so tests, lint and format configs, docs, `infra/` and tooling folders get no preview; those PRs still build and test. Removing a preview on close is a separate workflow (`preview-cleanup.yml`) with no paths filter, which checks that a preview exists first and then edits the sticky preview comment to say it was removed. If a fourth preview is needed the deploy step fails clearly; merging or closing an older PR frees a slot. Preview URLs are public.
- `public/staticwebapp.config.json`: baseline security headers (strict CSP starting at `default-src 'self'`, `frame-ancestors 'none'`, HSTS, `Referrer-Policy`, `Permissions-Policy`, `X-Content-Type-Options`), 404 route, long cache for hashed assets, short revalidation for HTML.
- `src/config/site.ts`: `launch: false`; site URL from env. The build job passes `DEPLOY_CONTEXT` (`preview` for pull requests, `production` for `main`), and `noindex` (meta tag and an `X-Robots-Tag` header in the generated `staticwebapp.config.json`) is sent when **either** the site isn't launched **or** the build is a preview. Preview URLs are public and served from `*.azurestaticapps.net`, so after launch they would otherwise be indexed as duplicates of the real site.
- **Acceptance:** production URL serves the skeleton with `noindex`; the PR shows a working preview URL; response headers verified in the PR description.

## Phase 2 · Content model and gates

Reviewed with Louis on 2026-10-17 against the Astro 7 docs and four Astro 7 sites with public source (Astro's own `examples/portfolio` and `examples/blog`, and three personal portfolios). New logic in every PR is test-first (Vitest).

### PR 2.1 · `feat(content): content schema and placeholder content`

- **Astro 7 collections API.** `src/content.config.ts` imports `defineCollection` from `astro:content`, `z` from `astro/zod` and `glob` from `astro/loaders`. Zod is version 4: use `z.httpUrl()`, `z.email()`, `z.iso.date()`, and `{ error: … }` for custom messages. Every collection needs a loader. No field may be named `slug`. `getCollection()` returns entries in no fixed order, so always sort by `order`.
- **Schemas live in `src/content/schema.ts`**, which imports only `astro/zod`, so Vitest can test them directly. `content.config.ts` only connects the loaders to them.
- **Placeholders.**
  - A shared `todo` schema (`z.string().startsWith("TODO:")`) that any field may accept instead of a real value, for example `z.httpUrl().or(todo)`.
  - An `isPlaceholder()` helper for PR 2.2 to build on.
  - `measurements` never accept `todo`: a measurement is real or absent.
- **Projects:** one Markdown file per project in `src/content/projects/`.
  - **File:** the frontmatter holds the fields and the body is the run-sheet write-up.
  - **URL:** the slug is the filename (`/projects/this-website`); `code` is only a label.
  - **Fields:**
    - `code` (`R` and two digits), `title`, `summary`, `headline` (2–5 words)
    - `status` (in-service / commissioning / complete / archived), `period` (free text, e.g. "2024 – 2025"), `featured`, `order`
    - `kind`, `setup`, `change`, `result`, `measurements` (optional), `stack`
    - `links` (`{ label, url }`)
  - **`kind`** is a discriminated union, so naming an employer on a work project is a build error:
    - `work` requires an anonymised `descriptor` and forbids `org`.
    - `personal` and `open-source` allow `org` and forbid `descriptor`.
  - **`measurements`:** `[{ label, before, after?, unit? }]`.
- **Profile:** `src/data/profile.ts` stays TypeScript, so garage photos are typed imports. A Zod schema parses it when it is imported, so bad data fails `npm run build` and not just `astro check`.
  - **Fields:**
    - role line, intro, career line, region
    - availability `{ text, until }`
    - email (`hello@louislawson.co.uk`, real), links, `cv`
    - skills `[{ group, context, tools, runs }]`, exploring
    - certifications `[{ title, issuer, date, verify? }]`
    - garage `[{ name, note, photo, alt, caption }]`
  - **Links:** `z.httpUrl()`, never `z.url()`, which accepts `javascript:` URLs.
  - **`cv`:** the fixed path `/cv.pdf` (the file is `public/cv.pdf`) or `todo`.
  - **Dates:**
    - `availability.until` is an ISO date (`z.iso.date()`), shown until the end of that day, UK time.
    - A certification `date` is `YYYY` or `YYYY-MM`, shown as written.
    - Never use `z.coerce.date()`, which reads a plain date as UTC midnight.
- **Checks across entries.** A pure `validateContent(projects, profile)` returns every problem: exactly one featured project, a unique `code` and `order` for each project, and an existing project for every skill's `runs` code. A single loader, `getSiteContent()`, calls it and throws one error that lists them all, and pages read content only through that loader. The skeleton index page calls it in this PR, so bad content already fails the build.
- **No `draft` flag.** A project that is still being written carries `TODO:` values, and production omits it (PR 2.2).
- **Content.**
  - R01–R03 are placeholders, with `TODO:` titles rather than the mock's examples.
  - R04, "This website", is the one real write-up.
  - The profile is all placeholders except the email.
  - Four projects exercise the compact-row layout.
- **Tests:**
  - schema unit tests for every rule above
  - availability past `until` is dropped
  - one real-build test, in the style of `src/build.test.ts`, proving an invalid entry fails `astro build` with the field named
- **Acceptance:** Louis can start writing content and the build says exactly what is wrong.

### PR 2.2 · `feat(content): placeholder rendering and launch gate`

- **Rendering follows the deploy context, not `launch`.** Local and preview builds render placeholders hatched, with a visually hidden "Placeholder:" for screen readers. Production omits them, before and after launch.
- **What production omits.** It leaves out the smallest unit that would otherwise look unfinished:
  - A placeholder in an optional field drops just that field.
  - A placeholder in a required field drops the whole item: the project, skill row, certification or garage entry.
  - A project is **real** only when it has no placeholder anywhere, including the body.
- **Empty sections.** A tested `visibleSections()` returns the sections that have content. A hidden section loses its nav link, and the rest renumber 1 to _n_. Phase 3 renders from it.
- **Featured.** Before launch, if the featured project is a placeholder, production shows no `featured` tag; no other project is promoted.
- **Launch gate.** Any build with `LAUNCH = true` (in `src/config/site.ts`) fails while the required set is incomplete, so the launch PR goes red before it merges. The required set is:
  - intro, career line and role line
  - at least two real projects, with the featured project real
  - email and LinkedIn
  - CV: the `cv` field is real and `public/cv.pdf` exists
- **`npm run placeholders`** lists every `TODO:` in the content files (`src/content/**` and `src/data/profile.ts`) as `file:line`. On pull requests, CI adds one warning annotation with the count and writes the full list to the job summary. GitHub shows at most 10 annotations per step.
- **Acceptance:** tests cover the preview and production rendering decisions, `visibleSections()` and the gate.

### PR 2.3 · `ci(privacy): photo and PDF metadata checks`

- **The check script.** A Node script, tested in Vitest, checks every tracked file (`git ls-files`) with an image or PDF extension, with no exclusions.
- **Images** (jpg, jpeg, png, webp, avif, heic, heif, tif, tiff, gif): fail on any EXIF, XMP or IPTC block except orientation and the colour profile. Use `exifr`, a devDependency.
- **PDFs fail on any of:**
  - more than one revision (more than one `%%EOF`), because an incremental update keeps the old metadata readable
  - any XMP creator or tool field
  - any document-info key other than `Title` and `Producer`
  - a path-like string (`C:\`, `/Users/`, `/home/`) in the metadata

  The PDF-parsing devDependency is chosen in the PR, after a Snyk package-health check.

- **Fixtures** are generated in memory by the tests, a bad and a clean one of each type. No file carrying metadata is committed.
- **CI:** its own **Metadata check** job in `ci.yml`. After its first run, Louis adds it to the "Protect main" required checks, along with **Unit tests** if that is still missing.
- **README:** how to strip metadata before committing. Use exiftool for images, keeping only orientation and the colour profile. A PDF needs a clean rewrite (qpdf, or print to PDF), because exiftool's PDF edits can be undone.
- **Acceptance:** generated fixtures with metadata fail, clean ones pass, and the job covers the whole repository.

### PR 2.4 · `ci(deploy): daily production rebuild`

- **Schedule.** `deploy.yml` gains `schedule: - cron: '17 4 * * *'`, so availability expires without a push. The odd minute avoids GitHub's top-of-the-hour delays.
- **Runs as production.** The run is on `main`: it builds with `DEPLOY_CONTEXT=production`, the plan identity already trusts it (no Azure change), and it joins the production ordering group. It always deploys; redeploying identical output is harmless.
- **Artifact retention:** `${{ github.event_name == 'schedule' && 1 || 7 }}` days.
- **Footer date.** The footer's "updated" date (Phase 3) comes from the last commit, not the build date.
- **Cost:** none.
  - Standard GitHub-hosted runners are free for public repositories.
  - The Static Web Apps Free plan has no limit on deployments and cannot incur bandwidth overage.
- **Auto-disable.** GitHub turns off schedules in a public repository after 60 days without activity. Louis's Dependabot merges keep the repository active. The runbook (PR 7.2) says how to spot a disabled schedule and re-enable it with `gh workflow enable`.
- **Acceptance:**
  - the first scheduled run after merge deploys production (checked and reported)
  - `src/workflows.test.ts` pins the cron and the retention expression

## Phase 3 · Design system and shell

Reviewed with Louis on 2026-10-17, against the Astro 7 source and the reference mock.

**Rebuild, don't design.** The mock is a spec, so each PR names the mock lines it rebuilds and lists where the real build must differ. Pieces the mock doesn't show (the 404 page, the keyboard-shortcut switch, focus styles) are designed using only the tokens and the contract, and approved through the PR's screenshots.

**Every PR in this phase:**

- **The content security policy stays as it is.** Nothing inline: no `<style>`, no inline `<script>`, no `style="…"` attribute, no `define:vars` or `style={…}`, no `data:` URL.
- **Logic is tested first in Vitest**, for example which key goes to which section.
- **Components are tested with Astro's Container API**, in Vitest's `node` environment.
- **Desktop and mobile screenshots of the preview** go in the PR body.

### PR 3.1 · `feat(ui): design tokens, fonts and base styles`

- **Mock source:** `docs/design/mock/styles.css:1–48` (tokens and base) and the `.ph` placeholder hatch.
- **Tokens:** exactly the contract's OWN-WORLD block, as CSS custom properties in a global stylesheet under `src/`.
- **Browser surfaces:** selection, caret, focus ring, scrollbar, underline offset and tabular numerals. Also `color-scheme: dark` and a reduced-motion base.
- **Font:**
  - Import `@fontsource-variable/martian-mono/wdth.css` into the bundled CSS. It covers weight 100–800 and width 75–112.5%; the family is "Martian Mono Variable".
  - Preload the Latin file with a `<link rel="preload">` whose URL comes from a `?url` import.
  - Fallback stack: `"Martian Mono Variable", ui-monospace, monospace`.
  - Don't use Astro's `<Font />`: it writes an inline `<style>`, which the policy blocks.
- **Nothing inlined:**
  - Set `vite.build.assetsInlineLimit: 0` in `astro.config.mjs`. Astro otherwise inlines any script under 4 KB and turns small CSS assets into `data:` URLs.
  - Extend `src/build.test.ts` to fail on any `style=` attribute or `data:` URL in the built HTML or CSS.
- **`<Icon>`:**
  - A small set of hand-drawn SVGs: 24px viewBox, 1.6 stroke, `currentColor`, square ends, `aria-hidden` unless labelled.
  - It starts with an arrow and an external-link mark; later PRs add icons as needed. No icon library.
- **`<Placeholder>`:** the orange hatch with a dashed outline and a visually hidden "Placeholder:", rendered wherever `renderDecision` (PR 2.2) says `hatch`.
- **Acceptance:**
  - The PR lists the contrast ratio of every text and ground pairing.
  - The built site makes no external font requests.
  - The build test covers `style=` attributes and `data:` URLs.

### PR 3.2 · `feat(ui): layout and footer`

- **Mock source:** the footer in `docs/design/mock/index.html` (`<footer class="foot">`) and `styles.css` from line 175.
- **Layout:** `src/layouts/Base.astro` already holds the shell and the `noindex` logic. Add:
  - a canonical URL from the site URL
  - a skip link to `<main>`
  - places for the nav (PR 3.3) and the footer
- **Footer:**
  - **Updated date:** the last commit's date from `git log -1 --format=%cs` at build, shown as written (`2026-10-17`). If git isn't available, leave it out.
  - **Built with:** the stack, plus a link to the repository.
  - **Privacy line:** "no cookies, no tracking" at first. PR 6.5 replaced it with the cookieless analytics note, whose wording is in `src/components/Footer.astro`.
  - **Keyboard-shortcut switch:**
    - A button that reads "keyboard shortcuts: on", with `aria-pressed`. Turning it off disables `1`–`5` and `i` together and hides the number hints in the nav.
    - The choice is remembered in `localStorage`, with every read and write in a try/catch; if storage is blocked, it falls back to on.
    - It's required by WCAG 2.1.4 (Character Key Shortcuts).
- **404:** the same world, with real facts only and no fake commands. A `404 · not found` heading, a line saying the page doesn't exist, and links to the home page and each visible section. It's static, with no script echoing the requested path.
- **Acceptance:**
  - Keyboard-only use works.
  - The footer matches the mock's footer, apart from the listed changes.
  - The 404 page and the shortcut switch are shown in screenshots.

### PR 3.3 · `feat(ui): navigation`

- **Mock source:** `docs/design/mock/index.html:21–30` (markup), `styles.css:49–66` (sticky, links, mobile menu), `mock.js:155–178` (menu, current section, number keys).
- **Sections:**
  - The links come from `visibleSections()`, so a hidden section loses its link and the numbers close up 1 to _n_.
  - Links point to `/#projects` and so on, so the same nav works on project pages and the 404; the number keys go to those sections from any page.
  - `louis.lawson` links home.
- **Works without JavaScript:** the links show by default, and the script collapses them into the mobile menu only once it runs. Number keys and the current-section highlight are extras on top.
- **Number hints:** the `<kbd>` hint is `aria-hidden`. While shortcuts are on (see PR 3.2), the link carries `aria-keyshortcuts="1"` and so on.
- **Current section:** shown with `aria-current`, on the home page only.
- **Script:** a processed `<script>`, kept external by PR 3.1's `assetsInlineLimit`. It respects the shortcut switch and ignores keys pressed with a modifier or while typing in a field.
- **Acceptance:**
  - Keyboard-only navigation works.
  - Without JavaScript, every link is reachable.
  - Tests cover the nav rendering only the visible sections and the key-to-section logic.
  - Screenshots show desktop, the open mobile menu, and a page with a hidden section.

### PR 3.4 · `feat(ui): inspect mode`

- **Mock source:** the `data-inspect` attributes in `docs/design/mock/index.html`, `styles.css:180–186` (outlines, labels, 12-column grid), the toggle in `mock.js:168–174`, and the `aria-live` `.inspect-note`.
- **Toggle:** the `[i] inspect` button and the `i` key, which also respects the shortcut switch. `aria-pressed`, plus the polite explanatory note, announce the change.
- **Labels:**
  - Section-level only, never per element: per-element labels would make the page too busy.
  - This PR labels the shell it owns: the nav, the footer and the 404's main content. Phase 4 adds a label to each section it builds.
  - Every label states a true fact about the real build. Some mock labels aren't true, for example "GPS check fails the build" (it's the Metadata check in CI).
- **Labels that state a config fact are pinned by a test,** so a config change that makes one false fails CI. For example:
  - cache lifetimes, checked against `public/staticwebapp.config.json`
  - "generated from `src/content/projects/*.md`", checked against the loader pattern
  - the Metadata check, checked against its job name
- **Acceptance:**
  - Toggling is announced.
  - Every label is accurate for the real build.
  - No text from the contract or the plan appears in the page.

## Phase 4 · Home page

Reviewed with Louis on 2026-10-18, against the reference mock. Each PR is deliberately narrow: one component, one mock section.

**The shape.** Each section is one component in `src/components/home/`: `Hero`, `Trace`, `Projects`, `Skills`, `Certifications`, `Garage` and `Contact`.

- **Composition:** `src/pages/index.astro` only composes them, in the contract's order.
- **Data:** each component takes its data as props from what `getSiteContent()` returns, and renders content values through `<Placeholder>`.
- **Hidden sections:** a section that `visibleSections()` leaves out is not rendered, so the nav and the page always agree.
- **Section heads:** a shared `<Section id title intro inspect>` component, built from the mock's `.shead`, arrives with the first section that needs it (PR 4.3).

**Every PR in this phase,** in addition to Phase 3's rules (CSP unchanged and nothing inline, tests in Vitest and the Container API, `pr-assets/phase-4` screenshots after the metadata check):

- **Mock source:** the exact lines it rebuilds, and every way it must differ from them.
- **Data:** the exact `getSiteContent()` fields it reads.
- **States:**
  - preview: placeholders hatched
  - production: placeholders omitted
  - what the section does when it is empty
- **Tests:** render the component in both the preview and the production context.
- **Screenshots:** desktop and mobile of the preview, plus the production rendering (the same build with `DEPLOY_CONTEXT=production`).
- **Fixed copy:**
  - Each section's intro line is fixed UI copy that makes no claims. The approved lines are listed per PR.
  - Anything personal is a profile field, and starts as a `TODO:`.
- **Inspect label:** each section's label is the approved one below, pinned by a test where it states a setting.
- **No links to project pages yet.** They arrive after the pages, in PR 5.4. Until then, project codes are plain text.

### PR 4.1 · `feat(home): hero`

- **Mock source:** `docs/design/mock/index.html:33–45` (the left column of `.hero`); `styles.css:70–86` (hero, caret, buttons).
- **Data:** `profile.roleLine`, `profile.intro`, `profile.careerLine`; `sections` (whether `#projects` is visible).
- **Markup:**
  - **Name:** `h1` "Louis Lawson" on two lines, with the hi-vis block caret. The name is a confirmed fact, so it is fixed text, not profile data.
  - **Text:** the role, intro and career line as paragraphs.
  - **Actions:**
    - "see projects", in hi-vis with the arrow icon, goes to `#projects`, and only when that section is visible.
    - "get in touch" goes to `#contact`.
  - **Right column:** left empty for PR 4.2's trace panel.
- **Caret:** it blinks, and stays still under reduced motion.
- **Inspect:**
  - The `h1` label is "h1 · Martian Mono 800 · static HTML, no JavaScript".
  - One global rule in `global.css` gives `main` top padding while inspecting, so the nav's label never covers the first content on a phone.
  - It replaces the 404 page's own `margin-top` rule, which this PR removes.
- **Acceptance:**
  - Placeholders are hatched in preview and the hero omits them in production.
  - The caret is still under reduced motion.
  - In inspect mode, the hero's label and the nav's label are both readable on a phone.

### PR 4.2 · `feat(home): trace panel`

- **Mock source:** `docs/design/mock/index.html:46–50`; `mock.js:186–252`; `styles.css:232–254`.
- **Pure logic:** harvest the trace logic into pure functions, with unit tests:
  - the hop list and timings from Navigation Timing
  - bar proportions
  - LCP

  A small client script renders the panel and replays it.

- **Hop labels:** generic, naming no providers: "DNS lookup for `<host>`", "connection", "first byte from the nearest edge server", "this page", "painted".
- **Build and commit:**
  - The footer shows "build 412 · commit 0af5e05". The deploy build step already passes `GIT_SHA`; this PR adds `BUILD_NUMBER: ${{ github.run_number }}` to the same step, pinned by `src/workflows.test.ts`.
  - A local build shows "local build".
- **Without JavaScript:** the panel explains that timings need JavaScript, rather than showing empty values. An unmeasured step shows an ellipsis, never a guess.
- **Inspect:** "measured in your browser by the Navigation Timing API · the trace sends nothing".
- **Acceptance:**
  - Real values on the preview URL.
  - Replay works.
  - Reduced motion shows a still panel.

### PR 4.3 · `feat(home): projects section`

- **Mock source:** `docs/design/mock/index.html:53–56`; `mock.js:105–132` (`renderRuns`); `styles.css:90–131` (section head, status, tag, strips, rows).
- **Data:** the visible `projects`, already sorted by `order`, and `sections`.
- **Shared component:** this PR introduces `<Section>`, which later sections use too.
- **Intro:** "Each one written up as setup, change and result."
- **Heading:** "projects" with the count of visible projects, as "(02)".
- **Strip or row:** 3 or fewer visible projects render as strips; 4 or more as compact rows.
  - **Strip:**
    - top line: code, title, a `featured` tag on the featured project, then status
    - a meta line
    - setup, change and result under their `h4`s
  - **Row:** code, title, `featured` tag, headline, status.
  - **Meta line:**
    - work: `descriptor · period`
    - personal and open-source: `org · period` when `org` is set, otherwise "personal project · period" or "open-source project · period"
  - **Status:** a square marker and the word: "in service", "commissioning", "complete", "archived". Only "in service" uses `ok` green.
  - **No links yet:** neither the entry nor a "read the run sheet" line links anywhere. PR 5.4 adds both.
- **Nav:** the current-section highlight changes from `aria-current="true"` to `aria-current="location"`, with the CSS selector and the tests to match.
- **Inspect:** "generated at build from src/content/projects/\*.md", pinned to the loader pattern.
- **Acceptance:**
  - Tests cover the strip and row switch at 3 and 4.
  - Tests cover the meta line for each `kind`.
  - Tests cover the featured tag.
  - Production shows R04 alone, as a strip.

### PR 4.4 · `feat(home): skills and exploring`

- **Mock source:** `docs/design/mock/index.html:58–62`; `mock.js:134–141` (`renderSkills`); `styles.css:135–146`.
- **Data:** `profile.skills`, `profile.exploring`.
- **Intro:** "Where I've used each one, and the projects that show it."
- **Skill row:**
  - The group as `h3`, the one-line context, and the tools joined with " / ".
  - "seen in R01 R04" as plain codes. A row with no `runs` has no "seen in" line.
  - In production, a row with a placeholder group or context is already dropped by PR 2.2's rules.
- **Exploring:**
  - Under `h3` "what I'm exploring next", after the rows.
  - Up to 5 plain items, no links.
  - Left out when empty.
- **Inspect:** "from profile.ts · 'seen in' codes checked at build", pinned to `validateContent`'s run check.
- **Acceptance:** tests cover a row with and without runs, and an empty exploring list.

### PR 4.5 · `feat(home): certifications`

- **Mock source:** `docs/design/mock/index.html:64–67`; `mock.js:143–146` (`renderCerts`); `styles.css:149–152`.
- **Data:** `profile.certifications`.
- **Intro:** "Certifications and achievements, each with a way to check it."
- **Row:**
  - The title, the issuer, and the date as written (`2025` or `2025-06`).
  - When `verify` is set and real, a "verify ↗" link with the external icon, in the same tab. Without one, the row has no link rather than a dead one.
- **Acceptance:** tests cover a row with and without a verify link, and a placeholder verify link in both contexts.

### PR 4.6 · `feat(home): garage section and wheel`

- **Mock source:** `docs/design/mock/index.html:69–73`; `mock.js:12–79` (the wheel) and `148–153` (`renderGarage`); `styles.css:156–162`.
- **Data:** `profile.garage` and a new profile field, `garageIntro`.
  - `garageIntro` is added to the schema with tests, and starts as a `TODO:` in `profile.ts`.
- **Intro:** "Cars, trucks and tractors: photos from shows and meets."
- **Wheel:**
  - Harvest it as a pure, unit-tested frame function, `frame(t)` → text.
  - The first frame is rendered at build into the `aria-hidden` `<pre>`, so with no JavaScript, or under reduced motion, there is a still wheel, never an empty box.
  - A client script animates it at about 30fps, and pauses off-screen and in a hidden tab.
  - The caption is "fig.01 · wheel." followed by `garageIntro`.
- **Cards:**
  - The name as a lower-case `h3`, the note, and the caption (event and vehicle only, never the owner).
  - The photo slot is a hatched placeholder in preview; PR 4.7 fills it.
- **Inspect:** "photos: metadata stripped before commit · Metadata check in CI", pinned to the Metadata check job name.
- **Acceptance:**
  - Unit tests on the frame function.
  - The wheel is still under reduced motion and without JavaScript.
  - The animation stops off-screen.

### PR 4.7 · `feat(home): garage photo dither`

- **Mock source:** `mock.js:85–102` (the placeholder dither, which shows the look only; the real one comes from the photo) and `styles.css:157–158`.
- **Photos:**
  - They live in `src/assets/garage/`.
  - They are found only through documented Astro or Vite APIs, for example `import.meta.glob`, never through Astro's hidden `fsPath`.
  - `sharp` becomes a direct dependency.
- **Dither:**
  - At build, each photo becomes a grid of 72 × 26 characters from greyscale brightness on the ramp `" .:-=+*#"`, written into an `aria-hidden` `<pre>`.
  - Zero client-side image processing.
- **Full-colour photo:**
  - The dither is a link to the optimised photo (Astro's image pipeline, which strips metadata), so without JavaScript it opens the photo.
  - With JavaScript, hover, focus or tap swaps the photo into the card in place. It is downloaded only then.
  - The photo's `alt` goes on the link and on the image.
- **Missing photo:** a designed empty state, in preview only. Production omits an entry whose photo is a placeholder.
- **Tests:** the pipeline is tested on an image generated in memory, so no photo is committed for tests.
- **Acceptance:**
  - The page loads no full-colour photo until asked.
  - Captions name the event and the vehicle only.

### PR 4.8 · `feat(home): contact`

- **Mock source:** `docs/design/mock/index.html:75–88`; `styles.css:166–171`.
- **Data:** `profile.email`, `profile.links`, `profile.cv`, `profile.availability`, `profile.region`.
- **Intro:** "About a role, a project, or just a conversation."
- **Email:** `hello@louislawson.co.uk` as a large `mailto:` link, with `<wbr>` after the `@`.
- **Links:** "linkedin ↗" and "github ↗", with the external icon.
- **CV:**
  - "download cv" goes to `/cv.pdf`, with the `download` attribute.
  - While `cv` is a placeholder, preview shows "cv not added yet" as an `aria-disabled` span, and production leaves it out.
- **Facts:** a `<dl>` with:
  - "availability": its row is gone once the statement has expired or is absent.
  - "based in": from `region`.
- **Inspect:** "mailto only · no forms, no backend, no cookies".
- **Acceptance:**
  - Tests cover the CV in both contexts.
  - Tests cover availability present, expired and absent.
  - Production shows the email, which is real.

## Phase 5 · Project pages and sharing

Reviewed with Louis on 2026-10-19, against the reference mock (`docs/design/mock/project.html` and `styles.css:189–229`). Each PR is narrow, as in Phase 4, and follows the same per-PR rules:

- the mock lines it rebuilds, and where it must differ from them
- the data it reads
- its preview, production and empty states
- tests in both the preview and production contexts
- screenshots in both contexts, pushed to `pr-assets/phase-5` after the metadata check
- an inspect label pinned to its source

Where the mock and the contract differ, the contract wins.

**What a project page reuses from Phase 4:**

- the layout: `Base.astro` with its nav, footer, inspect mode and shortcuts
- the content functions: `getSiteContent()`, the project schema, `renderDecision`
- the components and helpers: `<Status>`, `<Placeholder>` and `<Icon>`, the `.btn` styles, and `metaParts`, `statusLabel` and `featuredFirst` in `project-display.ts`

### PR 5.1 · `feat(projects): run-sheet pages`

- **Mock source:** `project.html:29–38` (head and sheet), `50` (tools), `76` (next project); `styles.css:189–204`, `214–215`, `226–229`.
- **Route:** `src/pages/projects/[slug].astro`, one page per visible project from `getStaticPaths()`, at `/projects/‹file name›/`. Production builds only real projects (today, only R04). Previews build every project, hatched. A hidden project has no page in that build, so its address gives the 404 page.
- **Head:**
  - A back link, "all projects", with a left-arrow icon, to `/#projects`. The mock's `cd ../projects` is a fake command, which the contract rules out.
  - The `h1` title.
  - A meta row: code, `featured` tag, status, period, and the organisation line from `metaParts`.
  - The browser tab title is "‹title› · Louis Lawson".
  - The `featured` tag's style moves from `Projects.astro` to `global.css`, so both pages share it.
- **Run sheet:** setup, change and result as three columns, with the mock's `$` and `>` prompts as structure.
- **Tools and links:**
  - **Tools:** the `stack` as the mock's tool list.
  - **Links:** the project's `links` follow it as "‹label› ↗" buttons with the external icon. A placeholder link is hatched in preview and omitted in production.
- **Next project:** a link to the next visible project in the home page's order (featured first, then `order`). The last one wraps to the first. With only one visible project there is no next link.
- **Inspect:** the `h1` label is "generated at build from src/content/projects/‹file›.md", with the page's real file name, pinned to the loader's pattern.
- **Acceptance:**
  - tests cover which pages are built in each context
  - tests cover the next-project wrap and the single-project case
  - tests cover the meta row for each `kind`
  - production builds `/projects/this-website/` alone

### PR 5.2 · `feat(projects): measurements`

- **Mock source:** `project.html:40–49`; `styles.css:206–213`.
- **Markup:** a real `<table>` (the mock uses ARIA roles on `div`s), with a visually hidden caption "Before and after measurements" and columns for measure, before and after. The `unit` is added to each value.
- **Values:**
  - **Single figure:** a measurement with no `after` is a single figure, like "70% of incidents caught before users". It shows once, across both value columns.
  - **Markers:** keep the mock's `-` and `+`.
  - **Colours:** before is dim, after is bone. The mock's red is not a token, and its green is reserved by the contract for live state.
- **Empty:** a project with no measurements has no table. Its `# measured` block holds only the tools, which is R04 today.
- **Acceptance:** tests cover a before-and-after row, a single figure, units and no measurements.

### PR 5.3 · `feat(projects): write-up`

- **Mock source:** `project.html:55–73`; `styles.css:216–225`.
- **Rendering:** the project's Markdown body is rendered with `render(entry)` under the `# write-up` heading, with the mock's prose styles.
- **Headings:** a write-up's headings are `###`, under the page's `h1` and the `h2` "# write-up". A test fails the build on a `#` or `##` heading in a project body. R04's `##` headings become `###`.
- **Code blocks:** no syntax highlighting (`markdown.syntaxHighlight: false`). Shiki writes inline `style` attributes, which the content security policy blocks. Code blocks are plain monospace on the panel colour, styled from the tokens.
- **Diagrams:**
  - **Format:** a plain Markdown image, `![alt](./diagrams/‹name›.svg)`, with the file in `src/content/projects/diagrams/`.
  - **File types:** SVG preferred, on a dark ground in the tokens' colours. PNG at 2× is accepted.
  - **Alt text:** a test fails the build on a write-up image with empty alt text.
  - **Caption:** the paragraph after the image is its caption, by convention, with no plugin.
  - **Metadata:** the Metadata check already covers both file types.
- **R04:** R04's write-up is the one write-up an agent may author. It is brought up to date with what the repo now shows: the placeholder gate, the metadata checks, the daily rebuild and inspect mode. Every claim must be checkable in the repo, and there are still no measurements.
- **Acceptance:**
  - Tests cover the heading rule, the alt-text rule and a code block with no `style=`.
  - R04's page renders the refreshed write-up.

### PR 5.4 · `feat(home): links to the run sheets`

- **Mock source:** `mock.js:105–132` (`renderRuns`: `.hit` and `.run__more`) and `134–141` (`renderSkills`: "seen in" links); `styles.css:122–124`, `140`.
- **Project entries:**
  - Each entry on the home page gets the mock's stretched link, one per entry, with the accessible name "Read the run sheet: ‹title›".
  - Strips gain the visible "read the run sheet →" line.
  - Rows gain the arrow.
- **Skills:** each "seen in" code becomes a link to its run sheet, named "R04, This website" for screen readers.
- **Previews:** placeholder projects link too, because their pages exist in preview builds. The section intros, "written up as setup, change and result" and "the projects that show it", are now backed by real pages.
- **Acceptance:**
  - tests cover one link per entry with its name
  - the "seen in" links and their names
  - every link resolves to a page that exists in that build

### PR 5.5 · `feat(seo): social preview images and meta tags`

- **Cards:**
  - **Size:** a 1200 × 630 PNG for the home page and for each project page, made at build by a prerendered endpoint with `satori` and `@resvg/resvg-js`. The cards are plain files on the same origin.
  - **Font:** `satori` cannot read WOFF2, so the cards use `@fontsource/martian-mono`, the non-variable package with WOFF files, at weights 400 and 800. It is a devDependency, never sent to visitors, and gets a Snyk package health check like `satori` and `@resvg/resvg-js`.
- **Design:**
  - **Every card:** the ground colour, Martian Mono, `louis.lawson` at the top left, and `louislawson.co.uk/…` in dim at the foot.
  - **Home:** "Louis Lawson" large, and the role line when it is real.
  - **Project:** the code in hi-vis, the title, the headline, and the status with its square marker.
  - **Placeholders:** a placeholder value is left off a card in every build, never hatched.
- **Meta tags:** the home page and each project page get these. The 404 page gets none.
  - `<meta name="description">`
  - `og:title`, `og:description`, `og:image`, `og:url`, `og:type` and `og:locale` (`en_GB`)
  - `twitter:card` (`summary_large_image`)
- **Descriptions:** the home page uses the intro and a project page its summary. Either is left out while it is a placeholder.
- **Absolute URLs:** `og:image` and `og:url` come from the site URL, as the canonical does.
- **No JSON-LD:** it would need an inline `<script>` block.
- **Acceptance:**
  - Tests cover the meta tags on each page type and their absence on the 404.
  - Tests cover a card's text for real and placeholder values.
  - The PR shows the generated cards.

### PR 5.6 · `feat(seo): sitemap and robots`

- **The rule:** crawling follows the `noindex` rule. `robots.txt` allows crawling, and `@astrojs/sitemap` builds a sitemap, only when the page would be indexable: `launch` is true and the build is production, as `shouldNoindex` decides.
- **Every other build:** a disallow-all `robots.txt` and no sitemap, so previews stay out of search after launch.
- **Acceptance:** a test for each combination of `launch` and deploy context.

## Phase 6 · Hardening

Reviewed with Louis on 2026-10-20. Phase 6 is eight narrow PRs, each with a fixed list of what it checks. The per-PR rules from Phase 5 still apply:

- tests in both the `preview` and `production` contexts
- screenshots for any visual change, pushed to `pr-assets/phase-6` after the metadata check

Anything a PR finds outside its list is reported to Louis, not fixed in that PR.

**The e2e harness (PRs 6.1–6.4):**

- **Reference:** Starlight's docs site (`withastro/starlight`, `docs/playwright.config.ts` and `docs/__a11y__/`), the Astro team's own Playwright and axe setup, and [Playwright's accessibility testing guide](https://playwright.dev/docs/accessibility-testing).
- **Why a custom server:** `astro preview` does not send the headers Azure Static Web Apps adds (the CSP, HSTS, `X-Robots-Tag`), so a blocked script or style would pass unnoticed. The tests run against a small server that applies the build's own `staticwebapp.config.json`.
- **No screenshot comparisons** (`toHaveScreenshot`): fonts render differently on Windows and on Linux CI. Phase 7's finish review covers how the site looks.

### PR 6.1 · `test(e2e): Playwright harness and smoke tests`

- **Builds:**
  - `npm run build:e2e` builds both deploy contexts into `dist-e2e/preview/` and `dist-e2e/production/` with `--outDir` (inside the project).
  - `LAUNCH` stays as committed.
  - `dist-e2e/`, `test-results/` and `playwright-report/` are ignored by git, Prettier and ESLint.
- **Server:**
  - `e2e/serve.ts` uses `node:http` only, with no new dependency. It serves one built folder on one port.
  - It applies that folder's generated `staticwebapp.config.json`: `globalHeaders`, the `routes` headers, and the `404` rewrite (status 404 with `404.html`).
  - The header and 404 rules are a pure function, and its Vitest tests live outside `e2e/`.
- **Config:**
  - `playwright.config.ts` at the root, tests in `e2e/*.spec.ts`. Vitest excludes `e2e/`.
  - Two `webServer` entries (preview on port 4400, production on 4401) serve the builds and never build.
  - **Projects:** `desktop-chromium` runs every spec. `mobile-webkit` (iPhone emulation) runs only the smoke spec. Both run against each context.
  - On CI: `retries: 2` and `forbidOnly`.
- **Pages:** the list of pages comes from the build output (every `index.html`, plus `404.html`), never a hand-kept list or the sitemap.
- **Smoke checks**, on every page in both contexts:
  - status 200
  - no console errors and no failed requests
  - no `securitypolicyviolation` event
  - no horizontal scroll at 320 px
  - a made-up path returns status 404 with the 404 page
- **Scripts:** `test:e2e` runs `build:e2e`, then `playwright test`.
- **CI:**
  - A new job, "E2E", installs Chromium and WebKit with `npx playwright install --with-deps chromium webkit`, at the lockfile's Playwright version.
  - The HTML report is uploaded only on failure, kept 7 days.
  - `e2e/` and `playwright.config.ts` stay out of `deploy.yml`'s allow-list, because they don't change the site.
- **Dependencies:** `@playwright/test` is a devDependency, with a Snyk package health check.
- **Acceptance:**
  - the server's rules are unit-tested
  - the smoke checks pass in both contexts
  - one deliberately broken page (an inline `style=`, never committed) fails the CSP check, shown in the PR

### PR 6.2 · `test(e2e): browser behaviour`

Only what needs a real browser. The markup is already covered by the Container API tests.

- **Number keys:**
  - each key jumps to its section
  - keys are ignored when shortcuts are off, while typing in a field, with Control, Alt or Meta held, and on key repeat
- **Shortcuts switch:**
  - `ariaSnapshot` shows `button "keyboard shortcuts:" [pressed]`, carried from PR 3.2
  - the state survives a reload, and the number hints show or hide to match it
- **Inspect mode:**
  - `i` turns it on and off, and the labels appear
  - the status region announces the change
  - at phone width the nav's label does not cover the first content
- **Reduced motion** (`emulateMedia({ reducedMotion: "reduce" })`): the trace's replay button is hidden and the wheel does not animate, in the preview build.
- **Trace:** it shows real numbers on the local server.
- **Project pages:**
  - the back link goes to `/#projects`
  - the next-project link wraps from the last project to the first in the preview build
- **Acceptance:** each item above is a test in `desktop-chromium`, in the contexts where it appears.

### PR 6.3 · `test(a11y): axe on every page`

- **Package:** `@axe-core/playwright`, Deque's official package, which is free and MPL-2.0. It is set up through one shared fixture (`makeAxeBuilder`), with a Snyk package health check. Snyk's licence policy may flag MPL-2.0; that is a warning only, for a devDependency that is never shipped.
- **Tags:** `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa` and `best-practice`.
- **Pages:** every page in both contexts, plus the home page with inspect mode on.
- **Gate:** zero violations. A disabled rule or an `exclude()` needs a code comment and a reason in the PR. The full results are attached to a failing test with `testInfo.attach()`.
- **Acceptance:** the scan passes on every page, and the PR lists anything it had to fix.

### PR 6.4 · `test(html): HTML validation and link checks`

- **HTML validation:**
  - `html-validate` (MIT, offline) with the `html-validate:recommended` preset, over every HTML file in both builds.
  - Each rule turned off is commented in `.htmlvalidate.json`.
  - Script: `validate:html`.
- **Links on PRs:**
  - lychee through `lycheeverse/lychee-action`, SHA-pinned.
  - It runs `--offline` with `--include-fragments` and `--root-dir` over both builds, covering internal links, `#fragment` anchors and assets.
  - Config is in `lychee.toml`. This is a gate.
- **External links:**
  - A separate workflow, `links.yml`, runs weekly on a schedule with `permissions: contents: read`.
  - It checks the production build's external links and reports in the job summary. It is not a gate: LinkedIn answers bots with status 999, and GitHub rate-limits.
- **CI:** a new job, "Static checks", runs `build:e2e`, then `html-validate` and lychee.
- **Acceptance:**
  - both checks pass on both builds
  - a deliberately broken anchor fails lychee, shown in the PR and never committed
- **Handback:** Louis adds "E2E" and "Static checks" to the "Protect main" required checks.

### PR 6.5 · `feat(security): final CSP and analytics`

- **Cookie proof first:**
  - Before any code, load the real Cloudflare beacon in a browser, from a local production build with the network allowed.
  - Record every cookie for every domain (`context.cookies()`), plus local and session storage. The result goes in the PR.
  - If anything is set, **stop and ask**. `PRODUCT.md` promises no cookies. The fallbacks are GoatCounter or no analytics.
- **Token:**
  - `ANALYTICS_TOKEN` in `src/config/site.ts`, public config that ships in the page anyway.
  - It starts as a `TODO:` placeholder, and the beacon is left out while it is one. It is not in the launch gate's required set.
  - Louis creates the Cloudflare Web Analytics site for `louislawson.co.uk` and supplies the token. Counting starts only once the domain is connected in Phase 8, because hostnames are matched by suffix.
- **Beacon:**
  - Production builds only, as `<script type="module" src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token":"…"}'>`.
  - No `integrity` attribute: Cloudflare updates the beacon without versioning it.
- **CSP:**
  - When the beacon is in, `buildStaticWebAppConfig` adds `script-src 'self' https://static.cloudflareinsights.com` and `connect-src 'self' https://cloudflareinsights.com`. Previews and local builds keep `default-src 'self'` alone.
  - Every build adds `require-trusted-types-for 'script'; trusted-types 'none'`. If the beacon trips it in the cookie proof, drop it and say so in the PR.
  - Not added: `upgrade-insecure-requests`, since nothing loads over HTTP.
  - HSTS `includeSubDomains` and `preload` wait for Phase 8.
- **E2E:**
  - The tests answer requests to `cloudflareinsights.com` with an empty 204 response, so no test reaches the network and the smoke test's "no failed requests" holds.
  - They assert that only the production build makes those requests.
- **Live check:**
  - A post-deploy step in `deploy.yml` runs `scripts/check-live.ts`, which is unit-tested, against the URL the deploy step reports, for both previews and production.
  - It asserts that the CSP is exactly what the build generated, HSTS is present, `X-Robots-Tag` matches the context, and a made-up path returns 404.
- **Footer:**
  - "no cookies, no tracking" becomes a cookieless analytics note, the same in every build. Louis chose its wording at review, once the beacon was found to send page-load timings as well as visits; it lives in `src/components/Footer.astro`, and is not quoted here because the copied-text test would then flag the page.
  - The contact label's "no cookies" stays.
- **Acceptance:**
  - tests cover the beacon and CSP for each context, with a real and a placeholder token
  - `check-live.ts` passes on the PR's own preview
  - the cookie proof is in the PR

### PR 6.6 · `fix(ui): reflow and touch`

- **Checklist.** Each item is a Playwright test on every page in both contexts. Anything failing is fixed in this PR.
  - **Widths:** at 320, 375, 768, 1024 and 1440 px, the page has no horizontal scroll, and no text element with hidden overflow is wider than its box. This covers WCAG 1.4.10 at 320 px.
  - **Text spacing (1.4.12):** the WCAG values are applied (line height 1.5, paragraph spacing 2em, letter spacing 0.12em, word spacing 0.16em) through a `bypassCSP` context, with the same width checks.
  - **Target size (2.5.8):** every link and button is at least 24 × 24 px, except inline links in a sentence, which the criterion exempts.
- **Impeccable:**
  - Run `adapt` and `audit`.
  - The full output goes to a local, untracked file, `%TEMP%\impeccable-audit-6.6.md`. Nothing from it is committed or pasted into the PR.
  - At handback, give Louis a short "found, not fixed" summary in chat. Louis decides what, if anything, becomes an issue or a later PR.
- **PR body:** names only the checklist items, with desktop and mobile screenshots of anything fixed.

### PR 6.7 · `fix(a11y): keyboard and semantics`

- **Checklist.** Each item is a test, and anything failing is fixed in this PR.
  - **Focus ring:** tabbing through every page, each control shows a visible focus indicator (the computed outline or box shadow is not none).
  - **Focus not obscured (2.4.11):** a focused element is never under the sticky nav. The fix is `scroll-padding-top: var(--nav-height)`.
  - **Forced colours** (`emulateMedia({ forcedColors: "active" })`): placeholder hatching, the status squares and the focus rings stay visible. The PR shows screenshots, and a test checks that the focus outline is not none.
  - **Lists:** the project entries (both layouts, carried from PR 4.3), the skills rows and the certifications are `ul`/`li`. Container tests are updated, and accessible names are unchanged.
- **Impeccable:** the same as 6.6, to `%TEMP%\impeccable-audit-6.7.md`.

### PR 6.8 · `ci(security): OpenSSF Scorecard`

- **Workflow:** `.github/workflows/scorecard.yml`.
  - **Triggers:** a push to `main`, and weekly at `23 5 * * 1`.
  - **Permissions:** `permissions: {}` at the top. The job gets `contents: read`, `actions: read`, `security-events: write` and `id-token: write`.
  - **Publishing rules:** results are published, so there is no `env` or `defaults` at any level, no container, and an Ubuntu runner.
  - **Steps:** only these actions, each SHA-pinned:
    - `actions/checkout`, with `persist-credentials: false`
    - `ossf/scorecard-action` v2, with `publish_results: true` and `results_format: sarif`
    - `actions/upload-artifact`, kept 5 days
    - `github/codeql-action/upload-sarif`
  - **Tests:** `workflows.test.ts` pins these rules.
  - **Previews:** it stays out of `deploy.yml`'s allow-list.
- **Branch-Protection:** "Protect main" is a ruleset, which the default `GITHUB_TOKEN` can read. No personal access token.
- **`SECURITY.md`:** points to GitHub's private vulnerability reporting. No email address.
- **Fixed in the PR:** real Token-Permissions and Pinned-Dependencies findings.
- **Noted, not gamed:** each with its first-run score and one line of explanation:
  - Code-Review: the repo has one maintainer, who merges every PR.
  - Maintained: the repo is under 90 days old.
  - Contributors.
  - CII-Best-Practices, Fuzzing, Signed-Releases and Packaging: not applicable.
- **Badge:** in the README, `https://api.scorecard.dev/projects/github.com/louislawson/louislawson.co.uk/badge`. It reads "no data" until the first published run.
- **Handback:** Louis turns on:
  - private vulnerability reporting
  - CodeQL default setup for JavaScript and TypeScript, adding its check to "Protect main" after the first run if wanted

## Phase 7 · Finish and document

Reviewed with Louis on 2026-10-21. Phase 7 is six narrow PRs and one handback (7.3), in this order. The CI PRs come first, so every later PR gets the faster E2E and the quieter CodeQL, and the runbook comes last, so it can document the domain. The per-PR rules from Phase 6 still apply:

- tests in both the `preview` and `production` contexts
- screenshots for any visual change, pushed to `pr-assets/phase-7` after the metadata check

**The Impeccable finish workflow (7.3 to 7.5).** This is section 7 of the Impeccable skill's `reference/new-work.md`. The direction contract's last line commits the build to it:

1. **Capture.** Take full-page screenshots into `.impeccable/review/`, which git ignores.
2. **Detect.** Run the detector, `impeccable detect --json`.
3. **Review.** A fresh subagent, `impeccable-finish-reviewer`, reviews the captures against the contract and a reference. It has no browser and edits nothing. It returns one of four dispositions (`recapture`, `rebuild`, `fix` or `ship`), at most eight ordered material fixes, and one line on what to keep.
4. **Fix.** Apply one batch of fixes, recapture the same files, and send them back to the same reviewer, which scores each fix resolved, partial or unresolved. Two rounds at most.
5. **Document.** A second subagent, `impeccable-documenter`, writes `DESIGN.md` and its sidecar from the built code.

**What differs for this site:**

- **A code-led build.** There is no approved comp image. The chosen HTML mock is the critique reference, captured as screenshots because the reviewer cannot open HTML.
- **No quality-bar card.** The world was user-pinned from references, not picked from Impeccable's catalogue. The packet says so in one line.
- **The contract is complete.** It already carries the seed key and the FINISH line that the reviewer checks.

### PR 7.1 · `ci(e2e): faster end-to-end tests`

- **First step:** set Playwright's CI `workers` to 4, matching the hosted runner's 4 CPUs.
- **Measure:** the E2E job's time before and after, on CI, in the PR.
- **Shards only if needed:** if the job still takes more than about 4 minutes, split it into parallel shards.
- **The required check:** with shards, one job must still be named exactly `E2E` and wait for them, because "E2E" is a required check and a renamed job would never report. `workflows.test.ts` pins this.
- **Acceptance:**
  - the timing before and after, from CI
  - the full suite green, with no change in tests run or skipped

### PR 7.2 · `ci(security): CodeQL advanced setup`

- **Workflow:** `.github/workflows/codeql.yml`.
  - **Languages:** JavaScript and TypeScript, and the Actions workflows.
  - **Ignored paths:** a CodeQL config ignores `**/*.test.ts`, `e2e/**` and `src/__tests__/**`, so test code raises no alerts.
  - **Triggers:** pull requests, pushes to `main`, and a weekly schedule.
  - **Permissions:** `permissions: {}` at the top, then least privilege per job (`security-events: write`, `contents: read`, and `actions: read` where the action needs it).
  - **Actions:** `github/codeql-action` pinned to a full commit SHA with a version comment.
- **Tests and filters:** `workflows.test.ts` pins the above. The workflow stays out of `deploy.yml`'s pull-request allow-list and on its push deny-list.
- **Acceptance:** the first run on the PR shows no alerts from test code.
- **Handback:** Louis switches CodeQL default setup off when this merges (the two cannot run together), then adds the CodeQL check to "Protect main" after its first run on `main`.

### PR 7.3 · Finish review (a handback, no PR)

This step changes no code, so it opens no pull request. Sonnet runs the review and reports to Louis, who chooses the fixes for 7.4.

- **Builds:** `npm run build:e2e`, served by `e2e/serve.ts`, so the real headers apply. The preview build is the only one with every section; the production build is what visitors see today.
- **Captures:** into `.impeccable/review/`, motion settled, fonts loaded, from the top of the document, each image opened and checked before use:
  - the home page, preview build: `desktop.png` (1440 wide, full page) and `mobile.png` (390 wide)
  - the home page, production build: `production-desktop.png` and `production-mobile.png`
  - R04's project page: `project-desktop.png` and `project-mobile.png`
  - the 404 page: `404-desktop.png`
  - the reference mock, `docs/design/mock/index.html` and `project.html`, at the same widths: `reference-desktop.png`, `reference-mobile.png`, `reference-project-desktop.png` and `reference-project-mobile.png`
- **Detector:** `impeccable detect --json` over `src/`. Mechanical findings are fixed in 7.4, not here.
- **The packet** the reviewer is spawned with:
  - the original request: `PRODUCT.md` and the surface brief
  - the direction contract, from `.impeccable/surfaces/src-pages-index-astro.md`
  - the artifact paths: `src/pages/`, `src/components/`, `src/layouts/` and `src/styles/`
  - every capture above, named as required
  - the reference captures, labelled as the critique reference. Where the mock and the contract differ, the contract wins.
  - one line: code-led, and no quality-bar card exists because the world was user-pinned
  - one line: hatched `TODO:` text is a placeholder by design under `PRODUCT.md`, so the review judges composition and craft, not copy
  - the decisions Louis has already confirmed: the footer wording and the trace label (PR 6.5), and the heading break under a visitor's text spacing (PR 6.6)
  - the detector's findings
  - the existing findings, for the reviewer to rank against its own:
    - controls under 44 px on touch screens (the menu, inspect and the shortcuts switch at 40 px; replay at 24 px)
    - the sticky bar's share of a landscape phone screen
    - the footer's link to the repository, 16 px tall
    - the hero name breaking mid-word at 200 % text on a 320 px window
    - the footer's privacy line breaking at a hyphen on a phone
  - the path to the skill's `reference/craft-floor.md`
- **Output:** the reviewer's full return goes only to `%TEMP%\impeccable-finish-review.md`, never committed and never pasted into a PR. At handback, Sonnet gives Louis the disposition word, verbatim, and a short summary of the material fixes.
- **If the disposition is `recapture`:** recapture and run a full review again, as the workflow says.
- **If it is `rebuild`:** stop and ask Louis.

### PR 7.4 · `fix(ui): finish review fixes`

- **Scope:** only the fixes Louis chose from 7.3, in one batch, plus one carried test: an axe scan of the open phone menu at 390 px, in both builds, with the same tags as PR 6.3.
- **Evidence:** before and after screenshots for each fix, and a test wherever the fix can be tested.
- **Verdict pass:** recapture the same files in `.impeccable/review/`, then send them back to the same reviewer to score each fix resolved, partial or unresolved. If it cannot be continued, run the scoring fresh from the skill's `reference/degraded/finish-reviewer.md` Verdict Pass. Two rounds at most. The disposition goes to Louis word for word.
- **Stop and ask Louis:** on a `rebuild`, or before any change to approved wording or to the direction contract.
- **Acceptance:** the verdict pass, at its scope, in the PR body.

### PR 7.5 · `docs(design): DESIGN.md`

- **The documenter:** spawn `impeccable-documenter` with the project root, the artifact paths, the direction contract, `PRODUCT.md`, the skill's `reference/document.md` and the repository root as the write boundary.
- **Output:**
  - `DESIGN.md` at the repository root
  - `.impeccable/design.json`, which git does not ignore
- **Rules:**
  - Every token and rule is evidenced by the built code.
  - A craft-floor refusal is never written up as a rule.
  - Both files are public-safe.
- **Raster provenance:** one line in `DESIGN.md` covers the contract's FINISH line. The only rasters the site ships are the social cards, which the code generates at build, and Louis's photos, whose metadata is stripped and checked in CI.
- **`CLAUDE.md`:**
  - "The mock is a spec" is retired; the mock becomes history.
  - `DESIGN.md` becomes the record of the visual system.
  - The direction contract still decides direction.
- **Acceptance:** both files exist with tokens (not prose alone), and the documenter's summary is in the PR.

### PR 7.6 · `feat(infra): custom domain, off by default`

- **Terraform** in `infra/site`:
  - `azurerm_static_web_app_custom_domain` resources, made from a `custom_domains` variable that defaults to empty, so applying the merge changes nothing
  - the apex uses `dns-txt-token` validation (Azure requires it for an apex), and its `validation_token` is an output
  - `www` uses `cname-delegation`, which needs its CNAME record in place before the apply
  - `terraform test` with mocked providers covers empty, apex only, and apex plus `www`
  - `fmt`, `validate` and `tflint` are clean, and `terraform-style-guide` applies
- **What Terraform cannot do:** the redirect from `www` (and from the `azurestaticapps.net` address) to the apex is Azure's "Set default domain", a portal setting with no Terraform argument. The runbook covers it.
- **The Live check:** once the apex is the default domain, the production `azurestaticapps.net` address redirects, and the Live check would fail on the 301. So production checks the `SITE_URL` host after launch, and previews keep checking their own address. `workflows.test.ts` and the Live check's tests cover both.
- **Check first:** in the current Azure docs, whether "Set default domain" also redirects the `azurestaticapps.net` address, and whether the Free plan supports it. If it does not, stop and ask.
- **Acceptance:** a `terraform plan` with the variable empty shows no changes, from CI.

### PR 7.7 · `docs: runbook`

- **Where:** `docs/RUNBOOK.md`, linked from the README. The README stays the developer quick start and "how it works". The runbook is Louis's "how do I…". Where the README already explains something, the runbook links to it instead of repeating it.
- **Every section is a numbered procedure** with exact commands and a final "check it worked" step.
- **Proven, not recalled:** every command is run, and its output is shown in the PR. For example, a photo with GPS data fails the metadata check, then passes once it is stripped.
- **Sections:**
  1. **Editing content:** `profile.ts` and `src/content/projects/*.md`. The fields, the write-up rules (`###` headings, alt text, the diagrams folder) and the measurements.
  2. **Placeholders:** what `TODO:` does in a preview and in production, `npm run placeholders`, and the launch gate's required set.
  3. **Adding a garage photo safely:** where it goes, stripping its metadata with `exiftool` (everything except the orientation and colour profile), `npm run metadata:check` as the gate, the import in `profile.ts`, and its alt text.
  4. **The CV PDF:** exporting it web-safe, and the metadata check.
  5. **Previews and deploys:**
     - what triggers each
     - the 3-preview limit
     - the daily rebuild, and turning its schedule back on when GitHub disables it after 60 quiet days
     - the Live check
  6. **Connecting the custom domain:** the generic steps, in this order:
     1. add the DNS-only records
     2. set `custom_domains` and apply
     3. add the TXT validation token
     4. "Set default domain" on the apex

     Then check that the apex serves over HTTPS, `www` and the `azurestaticapps.net` address redirect to it, and the Live check passes against it. Provider-specific details stay in `PRIVATE-NOTES.md`.

  7. **The launch checklist:** Phase 8's steps, each with what it changes and how to check it (see Phase 8).
  8. **When something goes wrong:**
     - a failed Live check
     - a fourth preview failing to upload
     - Windows test flakes
     - CodeQL alerts on test code
     - a Scorecard score dropping
- **Acceptance:** every procedure's commands run, with their output in the PR.

## Phase 8 · Louis's launch (no agent PRs)

The domain is connected before the launch switch is flipped. Otherwise production would become indexable on a host whose canonical points at a domain that does not answer yet. Each step's commands and checks are in `docs/RUNBOOK.md` (PR 7.7).

- [ ] **Real content:** photos (metadata stripped), the web-safe CV and the rest. `npm run placeholders` shows nothing left in the required set, and the metadata check passes.
- [ ] **Connect the domain:**
  1. add the DNS-only records (provider details in `PRIVATE-NOTES.md`)
  2. set `custom_domains` and apply
  3. add the TXT validation token
  4. "Set default domain" on the apex
  5. check: HTTPS on the apex, the redirects to it, and the Live check against it
- [ ] **Flip `launch: true`.** Check:
  - production sends no `noindex`
  - `robots.txt` allows crawling, and the sitemap exists
  - the canonical and `og:` addresses use the domain
  - previews still send `noindex`
  - Cloudflare starts counting
- [ ] **Set R04 to `in-service`.**
- [ ] **HSTS:** add `includeSubDomains`. Leave `preload` out, because it is hard to undo.
- [ ] **Optional:** Google Search Console, which needs Louis's account.

`SITE_URL` already defaults to the domain, so it needs setting only if the site's address ever differs.

---

## Handoff per phase

Each phase is handed to a fresh Sonnet session using the **`handoff` skill** (`mattpocock-skills:handoff`), which writes a handoff document; the new session starts from that document. The handoff carries:

- **Goal and stop condition:** the phase's PR list; open the PRs in order, then stop and report. Never merge.
- **Read first:** this plan, `PRODUCT.md`, the surface brief and contract, `docs/design/`, and the local `PRIVATE-NOTES.md`.
- **Suggested skills and tools:**
  - All phases: `code-review`, Snyk MCP scans, context7 for docs.
  - Phase 1: `terraform-style-guide`, `terraform-skill`, the Terraform MCP (provider docs and versions).
  - Phases 2–4: `mattpocock-skills:tdd` (pure logic such as the trace, the wheel frame and the dither).
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
