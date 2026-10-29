---
code: R01
title: ParcelQuote delivery platform
summary: A Terraform-built Azure delivery pipeline that stores no Azure credential and can roll back a production release.
headline: Secretless, reversible releases
status: complete
period: "2026"
featured: true
order: 1
kind: open-source
setup: Showcase a secretless, end-to-end DevOps pipeline. The application is a small shipping-quote API, inspired by earlier work. Kept simple on purpose, because the pipeline and the Terraform are the point.
change: A pipeline in Azure Pipelines that builds, tests, scans and publishes a FastAPI Docker container. Terraform provisions Azure Container Apps for dev and production. Production releases shift traffic in measured steps, and every Azure login uses workload identity federation.
result: No Azure credential is stored anywhere. Every commit to main passes quality and security gates before it can deploy. If a production release fails, traffic goes back to the previous revision in the same run.
measurements:
  - label: Azure credentials stored
    before: "0"
  - label: Traffic steps in a production release
    before: 10, 50 and 100
    unit: "%"
  - label: A rejected release left serving production
    before: about 1
    unit: minute
  - label: Cold start, measured
    before: "48"
    unit: seconds
  - label: Decision records
    before: "17"
stack:
  - Azure Pipelines
  - Terraform
  - Azure Container Apps
  - Azure Container Registry
  - Entra ID workload identity federation
  - Azure Key Vault
  - Application Insights
  - Python
  - FastAPI
  - Docker
  - Snyk
  - Checkov
  - SonarQube Cloud
links:
  - label: Source
    url: https://github.com/louislawson/parcelquote-platform
  - label: Architecture
    url: https://github.com/louislawson/parcelquote-platform/blob/main/docs/architecture.md
  - label: Decision log
    url: https://github.com/louislawson/parcelquote-platform/tree/main/docs/adr
---

### what it is

A reference delivery platform built for and in Azure, delivering a shipping-quote API in Python and FastAPI; kept small on purpose. Pricing is a pure function, no framework imports and no I/O. One endpoint needs an API key, so there's a secret worth protecting. `GET /version` reports the commit that built the running image. Everything else in the repository is the platform around it.

### no stored Azure credentials

The pipeline signs in to Azure with workload identity federation. Each environment has its own Entra app registration, trusted on the Azure DevOps service connection. This removes the risk of exposing secrets and the need to rotate them.

Each identity has Contributor on its own resource group and data access to its own Terraform state. Contributor can't write role assignments, so the pipeline can't widen its own access. Every grant comes from a bootstrap configuration that someone applies by hand.

The repository is public, so anyone can fork it and open a pull request. The validate stage runs on every pull request and holds no Azure credential at all. Every stage that touches the subscription runs only on `main`.

Two tools do hold a credential: SonarQube Cloud and Snyk. Neither offers federation, so they use API tokens that expire. Those tokens only reach their own services, never anything in Azure.

### secrets

The API key lives in Key Vault. The container app fetches it with its own managed identity when it creates a revision. That keeps the value out of the repository and out of Terraform state, and Terraform only ever handles a reference to it.

In production nobody can read the key, not even the pipeline. Every deploy checks that this is still true.

### releases and rollback

Production runs in multi-revision mode, so the old revision keeps running during a release. A release creates the new revision with 0 % of traffic. It then checks the new revision on its own hostname: it has to report the commit being deployed, while production still reports the previous one.

Next, traffic moves to 10 %, 50 % and 100 %. After each step the pipeline samples which commit answers. If any step fails, all traffic goes back to the previous revision in the same run, and the build fails.

Rollback is tested rather than trusted. The 10 % check was broken on purpose: the pipeline measured the real split, failed, and moved all traffic back to the previous revision. The rejected revision served about ten requests in roughly a minute, and every one succeeded.

The checks don't require an exact split. With this few requests, normal random variation would fail a good release. At the 10 % step the pipeline measured 11 of 100, and at 50 % it measured 31 of 50.

### quality and security gates

Every commit is linted and tested. Checkov checks the Terraform, Snyk tests the dependencies and the built image, and a SonarQube Cloud quality gate blocks on its conditions. All of this happens before anything reaches the registry.

### monitoring

Logs reach Log Analytics through a diagnostic setting rather than a shared key. Traces reach Application Insights signed in as the app's managed identity. Three alerts and an availability test send an email when they fire, and a budget watches the spend.

Thresholds are from measured data. At two to eighteen requests an hour, a failure rate means nothing, so there's no failure-rate alert. A cold start took 48 seconds, so the availability test waits 120 seconds instead of the default 30, which would have failed every check. For the same reason, the latency alert reads the application's own timing, not the ingress's.

### what it doesn't have

The architecture document lists what each part of the design gives up, against the five pillars of the Azure Well-Architected Framework. There's no landing zone, no network isolation, no second region or replica and no load test. Nobody gets paged.

The canary can prove the traffic split works. It can't prove a revision holds up under load, because there isn't any load.

### decision records

Seventeen decision records explain the choices, from using Container Apps as the runtime to turning down automated dependency updates. Each one names the alternatives, a cost the choice actually had, and evidence outside the log: a pull request, a build or a file.

The log is append-only. When a decision changed, a new record supersedes the old one, and both stay.
