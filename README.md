# louislawson.co.uk

The source for [louislawson.co.uk](https://louislawson.co.uk): a static [Astro](https://astro.build) site hosted on Azure Static Web Apps, with infrastructure in Terraform and delivery by GitHub Actions.

## Running it

Requires the Node version in `.nvmrc` and npm 11.19 or later.

```sh
npm ci
npm run dev
```

| Script                 | What it does                    |
| ---------------------- | ------------------------------- |
| `npm run dev`          | Start the dev server            |
| `npm run build`        | Build the site into `dist/`     |
| `npm run preview`      | Serve the built site locally    |
| `npm run check`        | Type-check with `astro check`   |
| `npm test`             | Unit tests (Vitest)             |
| `npm run placeholders` | List every `TODO` placeholder   |
| `npm run lint`         | ESLint and markdownlint         |
| `npm run format:check` | Check formatting with Prettier  |
| `npm run format`       | Format everything with Prettier |

`.npmrc` sets `min-release-age=7`, so installs only resolve package versions published more than a week ago.

## Content and placeholders

Content is a Markdown file per project in [`src/content/projects`](src/content/projects) plus [`src/data/profile.ts`](src/data/profile.ts). A value Louis has not supplied yet is a placeholder: a string that starts with `TODO:`. A `TODO` inside otherwise real text fails the build, so a half-finished sentence cannot be published.

- **Local and preview builds** keep placeholders, so they can be seen and filled in.
- **Production** leaves them out, before and after launch, and omits the smallest unit that would otherwise look unfinished:
  - a placeholder in an optional part drops just that part: a link, an organisation name, a tool, an exploring item, a verify link;
  - a placeholder in a required part drops the whole item: the project, skill row, certification or garage entry;
  - a project is real only if it has no placeholder left, including a `TODO` or `TODOs` in its Markdown body;
  - a section with nothing left disappears with its nav link, and the rest renumber from 1.
- **`npm run placeholders`** lists every placeholder as `file:line`. On pull requests, CI adds one warning with the count and the full list in the job summary.
- **The launch gate.** While `LAUNCH` in [`src/config/site.ts`](src/config/site.ts) is `true`, any build fails until the intro, career line, role line, email, LinkedIn link and CV are real, `public/cv.pdf` exists, and there are at least two real projects with the featured one real.

## Deploying

[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) builds the site and deploys it to Azure Static Web Apps. [`infra.yml`](.github/workflows/infra.yml) manages the Static Web App itself (see [`infra/site`](infra/site/README.md)).

| Event                                             | What happens                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Push to `main`                                    | Builds with `DEPLOY_CONTEXT=production` and deploys to production, unless the push changes only docs, `infra/`, tooling folders, tests, the test, lint and format configs, editor and ignore files, the licence, Markdown outside `src/`, or workflows other than the deploy workflow and the local actions. That deny-list fails safe: anything not excluded deploys, so a new build input can never leave production on an old build (pull requests use an allow-list, where a wrong guess only costs a preview) |
| Pull request that changes the site                | Builds with `DEPLOY_CONTEXT=preview`, deploys to a preview environment and comments the URL (not for drafts: a draft builds in CI and gets its preview when marked ready)                                                                                                                                                                                                                                                                                                                                          |
| Pull request closed, or converted to draft        | Removes its preview environment (a draft gets no preview, so it should not hold one of the 3 slots)                                                                                                                                                                                                                                                                                                                                                                                                                |
| Dependabot or fork pull request                   | No deploy or cleanup: neither can reach the Azure identity. CI still builds and tests                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Pull request that changes nothing the build reads | No preview: only `src/` (except tests, specs and fixtures), `public/`, `astro.config.mjs`, `package.json`, `package-lock.json`, `.npmrc`, `.nvmrc`, `tsconfig.json`, the deploy workflow and `.github/actions/` can change the built site. Tests, lint and format configs, docs, `infra/` and tooling folders cannot, and still build and test in CI                                                                                                                                                               |

- **Previews are public** and served from `*.azurestaticapps.net`. The Free plan allows 3 at a time, so merge or close pull requests promptly; a fourth fails at the upload step.
- **Ordering.** Runs for the same target queue in push order: one queue for production, one per pull request. A newer pending run replaces an older pending one (it contains the older commit), and nothing running is ever cancelled. If that newer run then fails, production stays on the last successful deploy until the next push, which carries the skipped commit with it. The deploy job also re-checks, as its first step and inside the group it shares with the cleanup workflow, that a pull request is still open and not a draft, so a run that was already building when its pull request was closed cannot upload a preview afterwards. Without that, deploys would go out in the order their builds finished, and a slow older build could overwrite a newer deploy while every run stayed green.
- **noindex.** Every page carries `<meta name="robots" content="noindex">` and every response carries `X-Robots-Tag: noindex` while `launch` in [`src/config/site.ts`](src/config/site.ts) is `false`. After launch, production is indexable and previews still send noindex.
- **`SITE_URL`** is plain configuration: set a `SITE_URL` repository variable when the domain is connected. Unset, the site uses the default in `src/config/site.ts`.
- **Headers** come from [`public/staticwebapp.config.json`](public/staticwebapp.config.json), plus the build-dependent robots header added at build time. Edit the committed file for a policy change.
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
