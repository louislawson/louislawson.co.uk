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

| Event                                      | What happens                                                                                       |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| Push to `main` that changes the site       | Builds with `DEPLOY_CONTEXT=production` and deploys to production                                  |
| Pull request that changes the site         | Builds with `DEPLOY_CONTEXT=preview`, deploys to a preview environment and comments the URL        |
| Pull request closed                        | Removes its preview environment                                                                    |
| Dependabot or fork pull request            | No deploy: neither can reach the Azure identity. CI still builds and tests                         |
| Pull request that changes only docs, infra | No preview (`docs/`, `infra/`, `.github/` apart from the deploy workflow, Markdown outside `src/`) |

- **Previews are public** and served from `*.azurestaticapps.net`. The Free plan allows 3 at a time, so merge or close pull requests promptly; a fourth fails at the upload step.
- **noindex.** Every page carries `<meta name="robots" content="noindex">` and every response carries `X-Robots-Tag: noindex` while `launch` in [`src/config/site.ts`](src/config/site.ts) is `false`. After launch, production is indexable and previews still send noindex.
- **`SITE_URL`** is plain configuration: set a `SITE_URL` repository variable when the domain is connected. Unset, the site uses the default in `src/config/site.ts`.
- **Headers** come from [`public/staticwebapp.config.json`](public/staticwebapp.config.json), plus the build-dependent robots header added at build time. Edit the committed file for a policy change.
- **Azure access** is OIDC through the plan identity, with the IDs read from Actions secrets only. The deploy token is fetched at run time with `az staticwebapp secrets list`, masked, and never stored or printed. The deploy job installs nothing from npm: it downloads the build artifact.
- **Third-party action.** `Azure/static-web-apps-deploy` is pinned to the head of its maintained `v1` branch (its `v1` tag points at a 2021 commit) and builds a container from a floating Microsoft image at run time. It is the one component that handles the deployment token, so Dependabot is told to leave it alone and it is bumped by hand. As a Docker action it is also handed the job's environment, which includes the job's OIDC request token, so a compromised action or image could act as the plan identity for the length of the job. That is inherent to using this action in a job that holds `id-token: write`; separating the upload into a job without it would leave no way to pass the token between jobs, because a masked value is dropped from job outputs. The mitigations are the pin and the narrow scope of the plan identity: one resource group (read, plus the deployment token) and the site state container (which it can write), as set out in [`infra/bootstrap`](infra/bootstrap/README.md).
- **Local actions.** [`.github/actions/mask-azure-ids`](.github/actions/mask-azure-ids/action.yml) masks and validates the Azure IDs for both workflows, and [`.github/actions/swa-deployment-token`](.github/actions/swa-deployment-token/action.yml) signs in and fetches the masked token for the upload and close jobs. They are referenced with `./` because actionlint does not yet accept GitHub's `$/` syntax. In the deploy jobs the Azure IDs are set as environment variables on the masking step only, so the third-party upload action never receives them.
- **No inline styles.** The content security policy allows no inline styles, so Astro is configured never to inline stylesheets; a test pins this. Add a `style-src` to the policy deliberately if that ever needs to change.
- **A stuck preview.** The `closed` event only matches the site paths if the pull request's final diff does. A pull request that previewed a site change and was then reduced to a docs-only diff keeps its preview, and holds one of the 3 free slots. Remove it by hand with `az staticwebapp environment delete --name stapp-louislawson-web-prod-weu --resource-group rg-louislawson-web-prod-weu --environment-name <pull request number>`.

## Licence

Code is MIT. Site content and photos are © Louis Lawson, all rights reserved.
