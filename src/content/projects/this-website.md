---
code: R04
title: This website
summary: A static site that is itself a small, checked example of the cloud and DevOps work it describes.
headline: Pipeline-built, pipeline-deployed
status: commissioning
period: "2026"
featured: false
order: 4
kind: open-source
setup: A personal site needed to show how I build and ship things, rather than only say so.
change: A static Astro site on Azure Static Web Apps, defined in Terraform and delivered by GitHub Actions with OIDC instead of stored cloud credentials.
result: Every pull request is checked, one that changes the site gets a preview, and a merge to main that changes the site deploys through the same pipeline.
stack:
  - Astro
  - Azure Static Web Apps
  - Terraform
  - GitHub Actions
  - TypeScript
  - Vitest
links:
  - label: Source
    url: https://github.com/louislawson/louislawson.co.uk
---

### how it's built

The site is static Astro, hosted on Azure Static Web Apps on the Free plan. The infrastructure is Terraform in two stacks: a bootstrap stack that I apply by hand for state storage and the CI identities, and a site stack that CI applies after I approve the `production` environment.

### how it ships

GitHub Actions builds the site and deploys it. Access to Azure is OIDC through two managed identities, so no long-lived cloud credential is stored. One identity plans and deploys but cannot change the Azure resources; the other applies changes and only runs from the `production` environment. Pull requests that change the site get a preview environment, and merges to `main` that change the site deploy production.

Production is also rebuilt and redeployed every morning by a scheduled run of the same workflow. Something that expires on a date, such as the availability statement, then disappears without a push.

### what runs before it merges

Linting, formatting, type checks, a build, unit tests, secret scanning and linters for the workflows themselves run on every pull request. The site is served with a strict content security policy and the other baseline security headers.

### what keeps unfinished content off the site

Anything I have not supplied yet is written as a marked placeholder, never as a guess. A preview shows each placeholder hatched, so it can be found and filled in. The production build leaves it out, and leaves out any project whose required fields or write-up still hold one.

A `LAUNCH` switch in the site configuration stays off until launch, and while it is off every build tells search engines not to index the site. Once it is on, the build fails while the required content is missing, such as fewer than two real projects.

### what keeps personal data out

A check fails if any image, PDF or SVG tracked by git carries personal metadata: EXIF, XMP or IPTC data in a photo, or an author or file path in a PDF. CI runs it as its own job.

### inspect mode

The inspect button in the navigation, or the `i` key while keyboard shortcuts are on, outlines each labelled part of the page and says how it is built and served. Each label states a fact about the build, and tests hold the labels that name a setting to that setting.
