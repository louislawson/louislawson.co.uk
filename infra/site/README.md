# Site

The Azure Static Web App that serves the site. Unlike the [bootstrap](../bootstrap/README.md), this stack is applied **by CI**, not locally.

| Resource                         | Purpose                                                      |
| -------------------------------- | ------------------------------------------------------------ |
| `rg-louislawson-web-prod-weu`    | Read only (data source). Created by the bootstrap stack      |
| `stapp-louislawson-web-prod-weu` | Static Web App: Free plan, West Europe, preview environments |

State lives in the `tfstate` container (key `site.tfstate`) of the bootstrap-created storage account.

## How it runs

The workflow is [`.github/workflows/infra.yml`](../../.github/workflows/infra.yml).

| Event                         | Jobs                                                                                                        | Identity                                                           |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Pull request touching `infra` | Terraform checks, then Terraform plan (posted as a sticky pull-request comment)                             | Plan identity, `pull_request` subject                              |
| Push to `main`                | Terraform checks, then Terraform apply, which waits for Louis to approve the `production` environment first | Apply identity, `environment:production` subject, no other trigger |

The plan and apply jobs must keep to those subjects. A job that declares `environment:` presents the environment subject, so only the apply job may. See the [bootstrap access model](../bootstrap/README.md#access-model).

The plan comment never contains GUIDs: the repository is public, so subscription, tenant and principal IDs are replaced with `<guid>` before posting, and the IDs are masked in the job logs.

## Notes

- **No deployment token output.** The resource exports `api_key`, so the token exists in the (Entra-only, private) state. It is never output; the deploy workflow fetches it at run time with `az staticwebapp secrets list`.
- **Ignored fields.** Deploying with the API key makes Azure record `repository_branch` and `repository_url`; `ignore_changes` stops the provider planning to blank them on every run. `terraform test` cannot observe lifecycle rules, so a CI step greps for this and for `prevent_destroy`.
- **Deletion protection** is `prevent_destroy`, because a management lock would need Owner-level rights the apply identity does not have.
- **Provider registration.** azurerm 5.x registers nothing by default and the bootstrap stack already registered `Microsoft.Web`, so this stack leaves registration alone.
- **First apply hangs.** There is a reported provider issue where the first `apply` hangs after the Static Web App is created. Re-run with `TF_LOG=DEBUG` and `-parallelism=1` before changing anything else.

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
