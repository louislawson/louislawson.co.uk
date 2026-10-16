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
| `npm run lint`         | ESLint and markdownlint         |
| `npm run format:check` | Check formatting with Prettier  |
| `npm run format`       | Format everything with Prettier |

`.npmrc` sets `min-release-age=7`, so installs only resolve package versions published more than a week ago.

## Deploying

[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) builds the site and deploys it to Azure Static Web Apps. [`infra.yml`](.github/workflows/infra.yml) manages the Static Web App itself (see [`infra/site`](infra/site/README.md)).

| Event                                             | What happens                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Push to `main`                                    | Builds with `DEPLOY_CONTEXT=production` and deploys to production, unless the push changes only docs, `infra/`, tooling folders, Markdown outside `src/`, or workflows other than the deploy workflow and the local actions. That deny-list fails safe: anything not excluded deploys, so a new build input can never leave production on an old build (pull requests use an allow-list, where a wrong guess only costs a preview) |
| Pull request that changes the site                | Builds with `DEPLOY_CONTEXT=preview`, deploys to a preview environment and comments the URL (not for drafts: a draft builds in CI and gets its preview when marked ready)                                                                                                                                                                                                                                                          |
| Pull request closed, or converted to draft        | Removes its preview environment (a draft gets no preview, so it should not hold one of the 3 slots)                                                                                                                                                                                                                                                                                                                                |
| Dependabot or fork pull request                   | No deploy or cleanup: neither can reach the Azure identity. CI still builds and tests                                                                                                                                                                                                                                                                                                                                              |
| Pull request that changes nothing the build reads | No preview: only `src/` (except tests, specs and fixtures), `public/`, `astro.config.mjs`, `package.json`, `package-lock.json`, `.npmrc`, `.nvmrc`, `tsconfig.json`, the deploy workflow and `.github/actions/` can change the built site. Tests, lint and format configs, docs, `infra/` and tooling folders cannot, and still build and test in CI                                                                               |

- **Previews are public** and served from `*.azurestaticapps.net`. The Free plan allows 3 at a time, so merge or close pull requests promptly; a fourth fails at the upload step.
- **noindex.** Every page carries `<meta name="robots" content="noindex">` and every response carries `X-Robots-Tag: noindex` while `launch` in [`src/config/site.ts`](src/config/site.ts) is `false`. After launch, production is indexable and previews still send noindex.
- **`SITE_URL`** is plain configuration: set a `SITE_URL` repository variable when the domain is connected. Unset, the site uses the default in `src/config/site.ts`.
- **Headers** come from [`public/staticwebapp.config.json`](public/staticwebapp.config.json), plus the build-dependent robots header added at build time. Edit the committed file for a policy change.
- **Azure access** is OIDC through the plan identity, with the IDs read from Actions secrets only. The deploy token is fetched at run time with `az staticwebapp secrets list`, masked, and never stored or printed. The deploy job installs nothing from npm: it downloads the build artifact.
- **Third-party action.** `Azure/static-web-apps-deploy` is pinned to the head of its maintained `v1` branch (its `v1` tag points at a 2021 commit) and builds a container from a floating Microsoft image at run time. It is the one component that handles the deployment token, so Dependabot is told to leave it alone and it is bumped by hand. As a Docker action it is also handed the job's environment, which includes the job's OIDC request token, so a compromised action or image could act as the plan identity for the length of the job. That is inherent to using this action in a job that holds `id-token: write`; separating the upload into a job without it would leave no way to pass the token between jobs, because a masked value is dropped from job outputs. The mitigations are the pin and the narrow scope of the plan identity: one resource group (read, plus the deployment token) and the site state container (which it can write), as set out in [`infra/bootstrap`](infra/bootstrap/README.md).
- **Manually tracked.** `Azure/static-web-apps-deploy` is the one dependency that Dependabot is told to ignore, which also stops it proposing security updates for it. It is pinned to commit `4d27395796ac319302594769cfe812bd207490b1`, the head of its `v1` branch as of 2024-09-11. Watch two places: [the action's `v1` branch](https://github.com/Azure/static-web-apps-deploy/commits/v1) for new commits, and [its security advisories](https://github.com/Azure/static-web-apps-deploy/security/advisories). Check both every quarter, and at once if a Microsoft advisory names the action or the `staticappsclient` image. Bump the pin by hand, in `deploy.yml` and `preview-cleanup.yml`, after reading the change. A test (`src/workflows.test.ts`) fails if the pin differs between the workflows or from the commit named here. To hear about advisories without relying on the quarterly check, watch [the action's repository](https://github.com/Azure/static-web-apps-deploy) on GitHub (Watch → Custom → Security alerts).
- **Local actions.** [`.github/actions/swa-deployment-token`](.github/actions/swa-deployment-token/action.yml) is the one step the upload and cleanup jobs use: it masks and validates the Azure IDs (through [`mask-azure-ids`](.github/actions/mask-azure-ids/action.yml), which `infra.yml` also uses), signs in, and fetches the masked deployment token. The IDs are set as environment variables on the masking step only, so the third-party upload action never receives them. They are referenced with `./` because actionlint does not yet accept GitHub's `$/` syntax.
- **No inline styles.** The content security policy allows no inline styles, so Astro is configured never to inline stylesheets; a test pins this. Add a `style-src` to the policy deliberately if that ever needs to change.
- **Preview cleanup** is its own workflow, [`preview-cleanup.yml`](.github/workflows/preview-cleanup.yml), with no paths filter, so it runs for every closed pull request, even one that was reduced to a docs-only diff after it had deployed a preview. It checks that a preview exists first. If one is ever stuck anyway, remove it by hand with `az staticwebapp environment delete --name stapp-louislawson-web-prod-weu --resource-group rg-louislawson-web-prod-weu --environment-name <pull request number>`.

## Licence

Code is MIT. Site content and photos are © Louis Lawson, all rights reserved.
