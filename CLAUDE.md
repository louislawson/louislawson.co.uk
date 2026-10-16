# louislawson.co.uk

Louis Lawson's personal site: a static Astro site on Azure Static Web Apps, infrastructure in Terraform, delivery by GitHub Actions. The repository is public.

## Where things live

- **Your task:** `docs/BUILD-PLAN.md`. Read your phase and PR before starting; its acceptance criteria are the bar.
- **Product rules** (audience, content honesty, privacy): `PRODUCT.md`.
- **Design authority:** the direction contract in `.impeccable/surfaces/src-pages-index-astro.md`. Visual reference: `docs/design/mock/`, viewed over HTTP (`python -m http.server --directory docs/design/mock`). Where the mock and the contract differ, the contract wins.
- **Environment facts:** `PRIVATE-NOTES.md`, local and gitignored. Read it for facts; keep its contents out of everything committed.

## Guardrails

- **Louis merges.** Work on a `phase-N/short-slug` branch and open a PR; `main` changes only through a PR Louis merges.
- **Content is true or a placeholder.** Any fact Louis hasn't supplied (roles, dates, figures, certifications, links) is written as a `TODO:` placeholder. The "This website" project (R04) is the one write-up you may author.
- **Everything committed is public-safe.** Files, commit messages, PR text and the built site carry only public information: no personal email, account, tenant or subscription IDs, secrets, or anything from `PRIVATE-NOTES.md`. Commits use the repo-local no-reply identity; confirm `git config user.email` matches it before your first commit in a session.
- **Stage deliberately.** Run `git status` before every commit and stage files by path.
- **Terraform: you plan, Louis applies.** Bootstrap is applied locally by Louis; the site stack applies on merge after Louis approves the `production` environment.
- **Stop at handback points** named in the plan, and report what's done and what Louis needs to do.

## A PR is done when

- It holds one concern (roughly 150–400 changed lines) with a conventional-commit title, e.g. `feat(trace): …`.
- CI is green.
- New logic arrived test-first (`mattpocock-skills:tdd`, Vitest); end-to-end coverage is Playwright from phase 6.
- Snyk scans of what it touches (code, dependencies, IaC) are clean: scan, fix, rescan.
- `/code-review` has run on the diff and every finding is fixed or answered in the PR.
- The PR body (`mattpocock-skills:pr`) gives what and why, ticked acceptance criteria and the preview URL (a draft pull request gets no preview until it is marked ready, and a change the build does not read gets none at all, so say so instead); visual PRs add desktop and mobile screenshots and name the mock section they match.

## Conventions

- **Toolchain:** Node from `.nvmrc`, npm (≥ 11.19) with the committed lockfile, Astro 7.x, TypeScript 6.x (`@astrojs/check` does not yet accept 7). Commands are the scripts in `package.json`; `npm run lint` covers ESLint and markdownlint.
- **Line endings are LF** everywhere (`.gitattributes`), even though authoring happens on Windows.
- **The npm release-age gate is deliberate.** `.npmrc` sets `min-release-age=7`, so installs resolve only versions published over a week ago (supply-chain defence). When an urgent security fix is newer than that, add just that package to `min-release-age-exclude` in `.npmrc` and say why in the PR; the gate itself stays.
- **Current docs first:** check context7 or the Astro docs MCP before using an API from Astro, Playwright, Vitest, Terraform providers or GitHub Actions.
- **The mock is a spec.** Rebuild layout and components as Astro components on the design tokens; harvest only the trace maths, the ASCII wheel renderer and the photo dither, each behind unit tests.
- **GitHub Actions:** third-party actions pinned to full commit SHAs with a version comment; least-privilege `permissions` per job.
- **Terraform:** `required_version = ">= 1.15, < 2.0"` (Dependabot's Terraform support ends at 1.15.x), azurerm `~> 5.10`, lock file for `windows_amd64` and `linux_amd64`; `fmt`, `validate` and `tflint` clean before pushing. Backend blocks hold only placement (`storage_account_name`, `container_name`, `key`) and `use_azuread_auth = true`; credentials and the auth method come from `ARM_*` environment variables (`ARM_USE_OIDC` in CI, `ARM_USE_CLI` locally). The one exception is the bootstrap backend, which only ever runs locally and may also set `use_cli = true`.
- **Azure access from CI** is OIDC through two managed identities: _plan_ (read, plus deploys) and _apply_ (write, `production` environment only). Their IDs live in GitHub Actions secrets and same-named Dependabot secrets (not repository variables, which would print in public logs); reference them as `secrets.*` only.

## Skills for the work

- **UI work** (phases 3–7): `impeccable`; load its `reference/craft-floor.md` before any UI edit.
- **Logic:** `mattpocock-skills:tdd`.
- **Terraform:** `terraform-style-guide`, `terraform-skill`, `terraform-test` (for `.tftest.hcl` with mocked providers), and the Terraform MCP for provider docs and versions.
- **Checking a preview in a browser:** the Playwright MCP or the built-in browser.
