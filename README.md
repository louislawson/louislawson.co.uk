# louislawson.co.uk

[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/louislawson/louislawson.co.uk/badge)](https://scorecard.dev/viewer/?uri=github.com/louislawson/louislawson.co.uk)

The source for [louislawson.co.uk](https://louislawson.co.uk): a static [Astro](https://astro.build) site hosted on Azure Static Web Apps, with infrastructure in Terraform and delivery by GitHub Actions.

For how to edit content, add a photo, deploy, connect the domain or fix a failure, see the [runbook](docs/RUNBOOK.md). This file is the quick start and how the site works.

## Running it

Requires the Node version in `.nvmrc` and npm 11.19 or later.

```sh
npm ci
npm run dev
```

| Script                   | What it does                                   |
| ------------------------ | ---------------------------------------------- |
| `npm run dev`            | Start the dev server                           |
| `npm run build`          | Build the site into `dist/`                    |
| `npm run preview`        | Serve the built site locally                   |
| `npm run check`          | Type-check with `astro check`                  |
| `npm test`               | Unit tests (Vitest)                            |
| `npm run test:e2e`       | Build both contexts, run the Playwright tests  |
| `npm run build:e2e`      | Build both contexts into `dist-e2e/`           |
| `npm run validate:html`  | Validate the HTML in `dist-e2e/` (build first) |
| `npm run placeholders`   | List every `TODO` placeholder                  |
| `npm run metadata:check` | Check photos and PDFs for personal metadata    |
| `npm run lint`           | ESLint and markdownlint                        |
| `npm run format:check`   | Check formatting with Prettier                 |
| `npm run format`         | Format everything with Prettier                |

`.npmrc` sets `min-release-age=7`, so installs only resolve package versions published more than a week ago.

`package.json` overrides `fflate` to 0.7.5 for `satori` (which draws the social preview cards) because `satori` pins `fflate` 0.7.3, which has a high-severity denial-of-service finding. Remove the override once `satori` depends on a fixed `fflate`.

## End-to-end tests

The Playwright tests in `e2e/` run against both deploy contexts, built by `npm run build:e2e` into `dist-e2e/preview/` and `dist-e2e/production/`. `astro preview` does not send the headers Static Web Apps adds (the content security policy, HSTS, `X-Robots-Tag`), so `e2e/serve.ts` serves each folder with its own generated `staticwebapp.config.json` applied, the 404 page included. The rules it applies are in `src/e2e/rules.ts`, which Vitest tests. Run `npx playwright install chromium webkit` once, then `npm run test:e2e`; CI runs the same as the **E2E** job. The list of pages is read from the build output, never kept by hand. Every spec takes `test` from `e2e/test.ts`, which answers requests to Cloudflare's analytics hosts with an empty 204, so no test reaches the network; the smoke checks assert that only the production build asks for the beacon, and every test runs with the Trusted Types rule on.

## HTML and link checks

The **Static checks** job in CI builds both contexts with `npm run build:e2e`, then runs two checks over every HTML file in `dist-e2e/preview/` and `dist-e2e/production/`:

- **HTML validation:** `npm run validate:html` runs [html-validate](https://html-validate.org) with its `html-validate:recommended` preset, configured in [`.htmlvalidate.mjs`](.htmlvalidate.mjs), where each relaxed rule has its reason beside it.
- **Links:** [lychee](https://github.com/lycheeverse/lychee) runs offline, once per build, with `--include-fragments` and the build's folder as an absolute `--root-dir`. It checks every internal link, `#fragment` anchor and asset, and its settings are in `lychee.toml`. To run it locally, pass the same arguments with `--root-dir` set to the full path of `dist-e2e/preview` or `dist-e2e/production`.

Links to other sites are not a gate. The **External links** workflow (`links.yml`) checks the production build's links to other sites every Monday and when run by hand, and writes the result to its job summary. It accepts status 999 (LinkedIn answers bots with it) and 429 (the rate limit GitHub applies).

## Security

[`SECURITY.md`](SECURITY.md) asks for a vulnerability to be reported through GitHub's private vulnerability reporting (the **Security** tab, then **Report a vulnerability**).

The **Scorecard** workflow (`scorecard.yml`) runs [OpenSSF Scorecard](https://scorecard.dev) on every push to `main` and every Monday, publishes the result (which feeds the badge at the top of this file) and uploads it to code scanning. Publishing is only accepted from a workflow that has no `env` or `defaults`, no container, an Ubuntu runner and only the four actions it uses, so `src/workflows.test.ts` pins those rules. It reads the "Protect main" ruleset with the job's own `GITHUB_TOKEN`, so there is no personal access token. The badge reads "no data" until the first run on `main` has published.

The **CodeQL** workflow (`codeql.yml`) analyses the TypeScript and JavaScript and the workflows themselves on every pull request, every push to `main` and every Wednesday, and uploads the results to code scanning. It is CodeQL's advanced setup rather than GitHub's default setup, so that its config (`.github/codeql/codeql-config.yml`) can leave out test code: `**/*.test.ts`, `e2e/` and `src/__tests__/` (which holds one helper, shared by the build tests). GitHub refuses an advanced setup's results while the default setup is on, so the default setup stays switched off (Settings, then Advanced Security). Neither language needs a build, so the workflow runs none of the project's code, and `src/workflows.test.ts` pins its triggers, permissions, languages and ignored paths.

Some checks stay low for reasons that are not worth gaming:

- **Code-Review:** one maintainer merges every pull request, so no change has a second reviewer.
- **Maintained:** the check scores a young repository low until it has a longer history.
- **Contributors:** a personal site has one contributor, and the check counts contributing organisations.
- **CII-Best-Practices, Fuzzing, Signed-Releases and Packaging:** they do not apply to a website that releases nothing and parses no untrusted input.

## Content and placeholders

Content is a Markdown file per project in [`src/content/projects`](src/content/projects) plus [`src/data/profile.ts`](src/data/profile.ts). A value Louis has not supplied yet is a placeholder: a string that starts with `TODO:`. A `TODO` or `TODOs` inside otherwise real text fails the build, so a half-finished sentence cannot be published.

- **Local and preview builds** keep placeholders, so they can be seen and filled in.
- **Production** leaves them out, before and after launch, and omits the smallest unit that would otherwise look unfinished:
  - a placeholder in an optional part drops just that part: a link, an organisation name, a tool, an exploring item, a verify link;
  - a placeholder in a required part drops the whole item: the project, skill row, certification or garage entry;
  - a project is real only if it has no placeholder left, including a `TODO` or `TODOs` in its Markdown body;
  - a section with nothing left disappears with its nav link, and the rest renumber from 1.
- **`npm run placeholders`** lists every placeholder as `file:line`. On pull requests, CI adds one warning with the count and the full list in the job summary.
- **The launch gate.** While `LAUNCH` in [`src/config/site.ts`](src/config/site.ts) is `true`, any build fails until the intro, career line, role line, email, LinkedIn link and CV are real, `public/cv.pdf` exists, and there are at least two real projects with the featured one real.

## Write-ups

The body of a project's Markdown file is its write-up, rendered under the page's `# write-up` heading. The page already has the `h1` (the title) and that `h2`, so:

- **Headings are `###`.** A `#` or `##` heading, or a line underlined with `===` or `---`, fails the build, with the file and the line (counted from the first line below the frontmatter). Fenced code is not checked, so a shell comment in a code block is fine.
- **Code blocks are plain.** Syntax highlighting is off (`markdown.syntaxHighlight` in `astro.config.mjs`), because it writes inline `style` attributes that the content security policy blocks. A long line wraps.
- **A diagram is a plain Markdown image**, `![what it shows](./diagrams/name.svg)`, with the file in `src/content/projects/diagrams/`. SVG is preferred, on a dark ground in the site's colours; a PNG at 2× is accepted. An image with empty alt text fails the build. The paragraph after an image is its caption.
- **A write-up is Markdown, or one `TODO:` line.** A preview hatches the paragraph under the heading; production leaves out the whole project, as it does for any `TODO` in a body.

## Photos and PDFs

The repository is public, so a photo or PDF must not carry the person behind it. `npm run metadata:check` fails on any image, PDF or SVG that `git ls-files` lists, anywhere in the repository, and CI runs it on every pull request and push as the **Metadata check** job. A phone photo's EXIF holds where and when it was taken and on what device; a CV exported from a word processor holds the author, the application and often the file path.

**Images** (`jpg`, `jpeg`, `png`, `webp`, `avif`, `heic`, `heif`, `tif`, `tiff`, `gif`) fail on any EXIF, XMP or IPTC block except an orientation and a colour profile, and on free-text metadata: a PNG `tEXt`, `zTXt` or `iTXt` chunk (`Software` included), a JPEG comment or a GIF comment. A raw colour profile in a PNG is still allowed. Strip a file with [exiftool](https://exiftool.org), keeping only those two:

```sh
exiftool -all= -tagsFromFile '@' -Orientation -ICC_Profile -YCbCrPositioning= -overwrite_original photo.jpg
```

The `@` is quoted because PowerShell reads a bare `@` as an error, and `-YCbCrPositioning=` removes a harmless tag that exiftool adds back whenever it writes the orientation and that the check rejects. The [runbook](docs/RUNBOOK.md#3-adding-a-garage-photo-safely) has the whole procedure, with the install on Windows.

**SVGs** are text, and fail on a `<metadata>` element, on any `sodipodi:` or `inkscape:` attribute or namespace (Inkscape writes the file name, and often the full local path it was exported to), and on a path-like string anywhere in the file, and a photo pasted in as a `data:` URI is checked like any other image. In Inkscape, save as Plain SVG, which leaves its own data out, and delete by hand anything the check still reports.

**PDFs** fail on any of:

- more than one revision (more than one `%%EOF`), because an incremental update keeps the old metadata readable. A "fast web view" (linearized) PDF also has two, so do not linearize;
- any XMP creator or tool field;
- any document-info key other than `Title` and `Producer`;
- a path-like string (`C:\`, `/Users/`, `/home/`) in the metadata;
- an embedded JPEG or JPEG 2000 image that carries any of the image metadata above, reported with its object number;
- XMP metadata on any object other than the catalog, such as a page or an image;
- a file attached to the PDF, because an attachment is not checked.

A PDF needs a clean rewrite, not an edit: exiftool's PDF edits are incremental updates, so the old metadata stays in the file and can be undone. Rewrite it with [qpdf](https://qpdf.sourceforge.io), which copies the pages and not the document-level metadata:

```sh
qpdf --empty --pages cv.pdf -- cv-clean.pdf
```

**Strip photos before they go into the document.** A JPEG in a PDF is stored as the original file, so a phone photo's location travels inside the PDF, and the `qpdf` rewrite above copies images unchanged, so it does not remove it. Run the `exiftool` command above on each photo first, then build the PDF. JPEG 2000 images cannot be read by the check, so a PDF that holds one fails; use JPEG.

Printing to PDF from a browser also works, but browsers often add a `Creator` and dates, so run the result through `npm run metadata:check` first. The check is what decides: it reports each file and what is left in it.

## Deploying

[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) builds the site and deploys it to Azure Static Web Apps. [`infra.yml`](.github/workflows/infra.yml) manages the Static Web App itself (see [`infra/site`](infra/site/README.md)).

| Event                                             | What happens                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Push to `main`                                    | Builds with `DEPLOY_CONTEXT=production` and deploys to production, unless the push changes only docs, `infra/`, `scripts/`, tooling folders, the e2e tests, code only the scripts and tests use (`src/metadata/`, `src/content/list-placeholders.ts`, `src/e2e/`), tests, the test, lint, format, link-check and secret-scan configs (`lychee.toml`, `.htmlvalidate.mjs`, `.gitleaks.toml`), editor and ignore files, the licence, Markdown outside `src/`, or workflows other than the deploy workflow and the local actions (`links.yml`, `scorecard.yml` and `codeql.yml` among them). That deny-list fails safe: anything not excluded deploys, so a new build input can never leave production on an old build (pull requests use an allow-list, where a wrong guess only costs a preview) |
| Daily at 04:17 UTC                                | Rebuilds `main` with `DEPLOY_CONTEXT=production` and deploys to production, so a statement that expires on a date (the availability line) disappears without a push. It always deploys, since redeploying identical output is harmless, and it joins the production queue. Its build artifact is kept for 1 day rather than 7. GitHub switches schedules off in a public repository after 60 days without activity; `gh workflow enable deploy.yml` turns it back on                                                                                                                                                                                                                                                                                                                            |
| Pull request that changes the site                | Builds with `DEPLOY_CONTEXT=preview`, deploys to a preview environment and comments the URL (not for drafts: a draft builds in CI and gets its preview when marked ready)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Pull request closed, or converted to draft        | Removes its preview environment (a draft gets no preview, so it should not hold one of the 3 slots)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Dependabot or fork pull request                   | No deploy or cleanup: neither can reach the Azure identity. CI still builds and tests                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Pull request that changes nothing the build reads | No preview: only `src/` (except tests, specs, fixtures, `src/metadata/`, `src/content/list-placeholders.ts` and `src/e2e/`), `public/`, `astro.config.mjs`, `package.json`, `package-lock.json`, `.npmrc`, `.nvmrc`, `tsconfig.json`, the deploy workflow and `.github/actions/` can change the built site. Tests, lint, format, link-check and secret-scan configs (`lychee.toml`, `.htmlvalidate.mjs`, `.gitleaks.toml`), the other workflows (`links.yml`, `scorecard.yml`, `codeql.yml`), docs, `infra/`, `scripts/`, `e2e/` and tooling folders cannot, and still build and test in CI                                                                                                                                                                                                     |

- **Previews are public** and served from `*.azurestaticapps.net`. The Free plan allows 3 at a time, so merge or close pull requests promptly; a fourth fails at the upload step.
- **Ordering.** Runs for the same target queue in the order they started: one queue for production (pushes and the daily rebuild), one per pull request. A newer pending run replaces an older pending one (it contains the older commit), and nothing running is ever cancelled. If that newer run then fails, production stays on the last successful deploy until the next push, which carries the skipped commit with it. The deploy job also re-checks, as its first step and inside the group it shares with the cleanup workflow, that a pull request is still open and not a draft, so a run that was already building when its pull request was closed cannot upload a preview afterwards. Without that, deploys would go out in the order their builds finished, and a slow older build could overwrite a newer deploy while every run stayed green.
- **noindex.** Every page carries `<meta name="robots" content="noindex">` and every response carries `X-Robots-Tag: noindex` while `launch` in [`src/config/site.ts`](src/config/site.ts) is `false`. After launch, production is indexable and previews still send noindex.
- **`robots.txt` and the sitemap** follow the same rule (`shouldNoindex`). An indexable build allows crawling, ends `robots.txt` with a `Sitemap:` line and builds a sitemap of the home page and the project pages with `@astrojs/sitemap`. Every other build disallows everything, names no sitemap and builds none. `robots.txt` is generated by [`src/pages/robots.txt.ts`](src/pages/robots.txt.ts), so there is no `public/robots.txt`: a static file would be the same in every build. Disallowing everything keeps well-behaved crawlers from fetching a non-indexable page at all, so they never read its `noindex`: the `noindex` is what stops a page that is fetched anyway (by a crawler that ignores `robots.txt`, or a cached copy) from being indexed.
- **`SITE_URL`** is plain configuration: set a `SITE_URL` repository variable when the domain is connected. Unset, the site uses the default in `src/config/site.ts`.
- **Headers** come from [`public/staticwebapp.config.json`](public/staticwebapp.config.json), plus what the build adds (`buildStaticWebAppConfig` in [`src/config/staticwebapp.ts`](src/config/staticwebapp.ts)): the robots header, the Trusted Types rules (`require-trusted-types-for 'script'; trusted-types 'none'`, in every build) and, in a build with the analytics beacon, `script-src` and `connect-src` for Cloudflare. Edit the committed file for any other policy change.
- **Analytics.** The production build loads [Cloudflare Web Analytics](https://www.cloudflare.com/web-analytics/)' beacon, which measures visits and page-load timings without cookies or storage. Each page view sends Cloudflare the page's address, the browser's navigation timings, first paint and first contentful paint, the browser engine and version, and (in Chromium) JavaScript heap sizes, under a random per-load ID that is not stored. The footer says "anonymous visit and load-time stats" for that reason (checked in a browser before it was added: no cookie on any domain, no `Set-Cookie` header, nothing in local or session storage, and no Trusted Types violation under the policy the site sends, in Chromium and WebKit). Previews and local builds never load it. The token is public configuration in [`src/config/site.ts`](src/config/site.ts) (`ANALYTICS_TOKEN`); while it is a `TODO:` placeholder the beacon is left out of the page and the policy. Counting starts once the domain is connected, because Cloudflare matches hostnames by suffix.
- **Live check.** After every deploy, preview or production, the **Live check** job runs [`scripts/check-live.ts`](scripts/check-live.ts) against the address the deploy step reported. The deployed site must send exactly the content security policy the uploaded build generated, HSTS, and the `X-Robots-Tag` that build sends (a preview must always send `noindex`), and a made-up path must answer 404. A production deploy address may redirect once, and only to the site's own origin (read from the build's canonical link); that origin is then the one checked, with the same headers and 404 rule, but the deploy address itself is not compared (it serves nothing once it redirects). This is what the address does once the custom domain is the app's default domain, and until then the address is checked as it stands. A preview is always checked at its own address. A failure straight after a deploy is retried for about a minute. The rules are in `src/e2e/live.ts`, which Vitest tests.
- **Azure access** is OIDC through the plan identity, with the IDs read from Actions secrets only. The deploy token is fetched at run time with `az staticwebapp secrets list`, masked, and never stored or printed. The deploy job installs nothing from npm: it downloads the build artifact.
- **Deployment client.** Uploads and preview closes run Microsoft's Static Web Apps client (`StaticSitesClient`), the code inside the `Azure/static-web-apps-deploy` action, through the local [`swa-client`](.github/actions/swa-client/action.yml) action rather than that action itself. The action's repository has been dormant since 2024 and is only a wrapper. Run as a Docker action, the client would also be handed the job's whole environment, including the OIDC request and Actions runtime tokens, and the runner's Docker socket. The local action instead:
  - builds the image from [its Dockerfile](.github/actions/swa-client/Dockerfile), which pins `mcr.microsoft.com/appsvc/staticappsclient:stable` by digest. Dependabot's `docker` entry proposes each new digest weekly, after the usual 7-day cooldown.
  - runs it with `docker run`, passing only the deployment token, the client's settings and the job's public GitHub context. It sends no credentials, mounts no Docker socket and leaves the job's own file commands alone. A test (`src/workflows.test.ts`) fails if any of those appear.
  - gives the client an output file of its own, and passes back only a URL that matches `*.azurestaticapps.net`.

  Dependabot pull requests get no preview, so a new digest is first exercised by the production deploy after merge. If the client has changed in a breaking way, that deploy fails and the last good build stays live.

- **Local actions.** [`.github/actions/swa-deployment-token`](.github/actions/swa-deployment-token/action.yml) is the step the upload and cleanup jobs use before the client. It masks and validates the Azure IDs (through [`mask-azure-ids`](.github/actions/mask-azure-ids/action.yml), which `infra.yml` also uses), signs in, and fetches the masked deployment token. The IDs are set as environment variables on the masking step only, so the deployment client never receives them. The local actions are referenced with `./` because actionlint does not yet accept GitHub's `$/` syntax.
- **No inline styles.** The content security policy allows no inline styles, so Astro is configured never to inline stylesheets; a test pins this. Add a `style-src` to the policy deliberately if that ever needs to change.
- **Preview cleanup** is its own workflow, [`preview-cleanup.yml`](.github/workflows/preview-cleanup.yml), with no paths filter, so it runs for every closed pull request, even one that was reduced to a docs-only diff after it had deployed a preview. It checks that a preview exists first, and afterwards edits the sticky preview comment to say it was removed. It runs on `closed` and on `converted_to_draft`. If one is ever stuck anyway, remove it by hand with `az staticwebapp environment delete --name stapp-louislawson-web-prod-weu --resource-group rg-louislawson-web-prod-weu --environment-name <pull request number>`.

## Licence

Code is MIT. Site content and photos are © Louis Lawson, all rights reserved.
