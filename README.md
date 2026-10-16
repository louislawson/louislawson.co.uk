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
| `npm run lint`         | ESLint and markdownlint         |
| `npm run format:check` | Check formatting with Prettier  |
| `npm run format`       | Format everything with Prettier |

`.npmrc` sets `min-release-age=7`, so installs only resolve package versions published more than a week ago.

## Licence

Code is MIT. Site content and photos are © Louis Lawson, all rights reserved.
