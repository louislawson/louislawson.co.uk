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
result: Every pull request that changes the site is checked and previewed, and every merge to main deploys through the same pipeline.
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

## how it's built

The site is static Astro, hosted on Azure Static Web Apps on the Free plan. The infrastructure is Terraform in two stacks: a bootstrap stack that I apply by hand for state storage and the CI identities, and a site stack that CI applies after I approve the `production` environment.

## how it ships

GitHub Actions builds the site and deploys it. Access to Azure is OIDC through two managed identities, so no long-lived cloud credential is stored. One identity plans and deploys with read access; the other applies and only runs from the `production` environment. Pull requests that change the site get a preview environment, and merges to `main` deploy production.

## what runs before it merges

Linting, formatting, type checks, unit tests, secret scanning and linters for the workflows themselves run on every pull request. The site is served with a strict content security policy and the other baseline security headers.
