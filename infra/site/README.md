# Site

The Azure Static Web App that serves the site. Unlike the [bootstrap](../bootstrap/README.md), this stack is applied **by CI**, not locally.

| Resource                               | Purpose                                                            |
| -------------------------------------- | ------------------------------------------------------------------ |
| `rg-louislawson-web-prod-weu`          | Read only (data source). Created by the bootstrap stack            |
| `stapp-louislawson-web-prod-weu`       | Static Web App: Free plan, West Europe, preview environments       |
| `azurerm_static_web_app_custom_domain` | One per entry in `custom_domains`. None until that variable is set |

State lives in the `tfstate` container (key `site.tfstate`) of the bootstrap-created storage account.

## How it runs

The workflow is [`.github/workflows/infra.yml`](../../.github/workflows/infra.yml).

| Event                                                        | Jobs                                                                                                                                             | Identity                                                     |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| Pull request touching `infra` or the workflow                | Terraform checks, then Terraform plan (posted as a sticky pull-request comment)                                                                  | Plan identity, `pull_request` subject                        |
| Push to `main` touching `infra/site` (not Markdown or tests) | Terraform checks and plan, then Terraform apply, which waits for Louis to approve the `production` environment first                             | Plan: `ref:refs/heads/main`. Apply: `environment:production` |
| Dependabot pull request touching `infra`                     | Terraform checks only (unprivileged). The plan runs only when Louis re-runs the workflow after reading the bump                                  | Plan, on re-run: `pull_request`                              |
| Manual dispatch from `main`                                  | Terraform checks and plan only; it never applies. Use it to prove a plan against the live app, and only after any apply has finished (see below) | Plan: `ref:refs/heads/main`                                  |

The apply job re-plans before applying. A saved plan cannot be handed between jobs as an artifact: it embeds the Static Web App's `api_key`, and artifacts on a public repository are downloadable. The plan job on `main` runs first so the plan is visible in its job summary while the approval is pending.

Nothing in this workflow is cancelled mid-run, because a killed plan or apply can leave the state blob lease held. GitHub keeps one running and one pending run per concurrency group, so a newer pending run replaces an older pending one; that older run had not started, so nothing is interrupted. The same group is what serialises applies on `main`. The apply job also refuses to apply a commit if a later commit on `main` changed `infra/site` (outside Markdown and tests), because that commit starts its own run and carries the newer state; the error names both commits. A later docs-only or non-infra merge, which starts no run, does not stop a waiting apply, so merging such a change between merging an infrastructure change and approving it is safe. A manual dispatch is in its own group (the event name is part of the key), so it can start while an apply holds the state lease; it then waits `-lock-timeout=10m` for the lock and fails if the apply is still running. Dispatch only after the apply has finished. The path filters mean these checks do not report on pull requests that touch neither `infra` nor the workflow, so do not mark them as required status checks without handling that. Pushes to `main` trigger only on `infra/site` changes other than Markdown and tests, so a bootstrap-only or README-only merge does not ask for a production approval.

The plan and apply jobs must keep to those subjects. A job that declares `environment:` presents the environment subject, so only the apply job may. See the [bootstrap access model](../bootstrap/README.md#access-model).

The plan comment never contains GUIDs: the repository is public, so subscription, tenant and principal IDs are replaced with `<guid>` before posting, and the IDs are masked in the job logs.

## Notes

- **Azure IDs in public logs.** The repository is public, so CI reads the IDs from Actions **secrets only**: `AZURE_PLAN_CLIENT_ID`, `AZURE_APPLY_CLIENT_ID`, `AZURE_TENANT_ID` and `AZURE_SUBSCRIPTION_ID`. The runner masks a secret from the first log line, whereas a repository variable would be printed in the `env:` header of the step that masks it. Dependabot-triggered runs read the same-named Dependabot secrets. The repository variables of the same names are now unused by CI and can be deleted. Because secrets are masked by the runner from the first log line, the local `mask-azure-ids` action can run after the checkout that it needs: it masks the values again (including their lower and upper case forms), then fails with a message naming the secret if one is empty or is not a GUID (stray whitespace from copying is the usual cause); it never prints a value. Never put an Azure ID in a variable or in a step's `env:` before that point in any other way than from `secrets.*`.
- **No deployment token output.** The resource exports `api_key`, so the token exists in the (Entra-only, private) state. It is never output; the deploy workflow fetches it at run time with `az staticwebapp secrets list`.
- **Ignored fields.** Deploying with the API key makes Azure record `repository_branch` and `repository_url`; `ignore_changes` stops the provider planning to blank them on every run. `terraform test` cannot observe lifecycle rules, so a CI step greps for this and for `prevent_destroy`.
- **Deletion protection** is `prevent_destroy`, because a management lock would need Owner-level rights the apply identity does not have. It also blocks a deliberate replacement, such as changing `name`, `location` or the resource group: that plan fails by design. To replace the app on purpose, remove `prevent_destroy` in one reviewed pull request, update the lifecycle guard step in the workflow in the same pull request, and restore both afterwards.
- **Two infrastructure changes merged back to back.** A run waiting for the `production` approval holds the workflow's concurrency group, so a newer run queues behind it. Reject or cancel the older waiting run, whose guard would refuse it anyway, and the newer one proceeds with the newer state.
- **Provider registration.** azurerm 5.x registers nothing by default and the bootstrap stack already registered `Microsoft.Web`, so this stack leaves registration alone.
- **First apply hangs.** There is a reported provider issue where the first `apply` hangs after the Static Web App is created. Re-run with `-parallelism=1` before changing anything else. Do not set `TF_LOG` in CI: the log is public, and debug output includes full response bodies, among them the `listSecrets` response that carries the deployment token, which `add-mask` does not cover. To see more, reproduce locally, or write to a file with `TF_LOG_PATH` that is never uploaded.

## Custom domains

`custom_domains` is empty by default, so applying this stack attaches no domain. To connect one, set it to a map keyed by domain name:

```hcl
custom_domains = {
  "example.com"     = { validation_type = "dns-txt-token" }
  "www.example.com" = { validation_type = "cname-delegation" }
}
```

- **An apex uses `dns-txt-token`** (Azure requires it). Terraform does not wait for that validation: after the apply, read the token with `terraform output -json custom_domain_validation_tokens` and add it as the domain's TXT record. The output is sensitive because the provider marks the token so, which also keeps it out of the public CI log. Azure clears the token once the domain is validated.
- **`www` uses `cname-delegation`**, so its CNAME record must exist before the apply; the apply waits for it.
- **The Free plan allows 2 domains** and Standard 5; the variable rejects more.
- **"Set default domain" is not in Terraform.** It makes Azure redirect the other addresses (`www`, and the `azurestaticapps.net` address) to the domain chosen as the default, and the provider has no argument for it. Set it in the portal under Custom domains once the apex has validated. The deploy workflow's Live check follows that redirect to the site's origin, and only to it.

## Running it locally

Louis can plan locally with the Azure CLI. Authentication comes from the environment; the backend block holds only placement.

```powershell
az login
$env:ARM_USE_CLI = "true"

terraform init
terraform plan
```

## Checks

Run from this directory before pushing (CI runs the same, plus Trivy on `infra`):

```sh
terraform fmt -check
terraform init -backend=false
terraform validate
terraform test
tflint --config=../.tflint.hcl --init
tflint --config=../.tflint.hcl
```

The tests use `mock_provider "azurerm"`, so they need no Azure access.

`.terraform.lock.hcl` is committed and locked for `windows_amd64` and `linux_amd64`. After a provider upgrade, refresh it with:

```sh
terraform providers lock -platform=windows_amd64 -platform=linux_amd64
```
