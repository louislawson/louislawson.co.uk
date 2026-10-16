# Bootstrap

Creates the pieces the rest of the infrastructure depends on. It is applied **once, locally, by Louis**; CI never runs it.

| Resource                                   | Purpose                                                               |
| ------------------------------------------ | --------------------------------------------------------------------- |
| `rg-louislawson-tfstate-weu`               | Holds the state storage account and the two CI identities             |
| `stlouislawsontfstate`                     | Terraform state: Entra-only auth, ZRS, versioned, 30-day soft delete  |
| `tfstate-bootstrap` container              | State of this stack; only you have access                             |
| `tfstate` container                        | State of the site stack (`infra/site`); the CI identities have access |
| `rg-louislawson-web-prod-weu`              | Empty resource group the site stack deploys into                      |
| `id-louislawson-web-plan`                  | CI identity for plan, PR previews and production deploys              |
| `id-louislawson-web-apply`                 | CI identity for apply, trusted only for `production`                  |
| Role assignments and federated credentials | See below; nothing is granted at subscription scope                   |

## Access model

| Identity | Trusted for                              | Roles                                                                                                                                      |
| -------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| plan     | `pull_request` and `ref:refs/heads/main` | Reader and the custom Static Web App Reader role on the site resource group; Storage Blob Data Contributor on the `tfstate` container only |
| apply    | `environment:production` only            | Contributor on the site resource group; Storage Blob Data Contributor on the `tfstate` container only                                      |
| you      | the signed-in user                       | Storage Blob Data Contributor on both the `tfstate-bootstrap` and `tfstate` containers (Owner covers the control plane only)               |

The custom role exists because Reader is not enough for `azurerm_static_web_app`. Its read also POSTs `listSecrets` (the `api_key` attribute) and `listAppSettings`, and the same `listSecrets` action is how the deploy workflows fetch the deployment token. The built-in Website Contributor role does not help: it covers `Microsoft.Web/sites/*`, not `Microsoft.Web/staticSites/*`. The role, scoped to the site resource group only, adds `staticSites/read`, `staticSites/listSecrets/action` and `staticSites/listAppSettings/action`; the provider's other reads (the site and `basicAuth/default`) are GETs that Reader already covers.

This means the plan identity can read the production Static Web App deployment token, which can publish to the live site. That is inherent rather than a choice: the provider's own refresh calls `listSecrets`, and PR previews deploy with this identity. The `production` approval gates Terraform **applies** only. Site content deploys from `main` also use the plan identity and are not approval-gated in the current design (BUILD-PLAN PR 1.3 and 1.5). Gating them would mean `environment: production` on those jobs, which changes their OIDC subject, so they would need their own federated credential; that is a design change, not a setting. The control is who can run `pull_request` and `main` workflows in this repository (see the notes below), not a narrower role.

The CI identities have **no access to `tfstate-bootstrap`**. The plan identity is trusted for every pull-request run, so if it could write this stack's state, a pull request could tamper with the stack that owns the identities and role assignments.

Notes on the plan identity:

- It is trusted for every `pull_request` run in this repository and holds write access to the site state container and the Static Web App deployment token, so treat who can open pull requests and run workflows as part of the trust boundary. In the repository's Actions settings, require approval for workflows from outside collaborators.
- **The Dependabot path (once the site stack's pipeline, PR 1.4, is merged).** A Dependabot pull request that bumps the `azurerm` provider in `infra/site` would, if its plan ran, run provider code under this identity, so a compromised provider release could read the deployment token and publish to the live site. The control is a gate: Dependabot's own run skips the `infra.yml` plan job (checks still run, unprivileged), and the plan runs under this identity only when Louis re-runs the workflow after reading the bump (changelog, publisher, release date), which makes him the triggering actor. The condition must use `github.triggering_actor`: `github.actor` stays `dependabot[bot]` on a re-run, so it would keep the gate shut. The job holds everything privileged; `init`, `validate`, `tflint` and `terraform test` run in a separate unprivileged job, so no provider code runs with the plan identity before the gate opens. Bumps in `infra/bootstrap` never reach that job: it initialises and plans only the site stack. Bootstrap is applied locally by Louis, so the control for those bumps is reading them before he applies. Dependabot bumps to GitHub Actions never run with this identity before Louis merges them either: Dependabot pull requests get no preview deploy (as PR 1.5 is specified), and the deploy jobs run on `main`, so the 7-day cooldown and reading the bump apply to them too. Alongside the gate, mitigations that each cover part of the risk:
  - the 7-day `cooldown` in `.github/dependabot.yml` gives the community time to spot and pull a bad release before Dependabot proposes it;
  - Terraform verifies the registry's signature on every provider it downloads, which guards against tampering in transit or at the registry, not against a bad release from the legitimate publisher;
  - the committed lock-file hashes pin the exact provider build, but a provider-bump PR rewrites the lock file itself, so they protect everything except the version the PR proposes.

  What GitHub documents for the re-run: a Dependabot-triggered run gets a read-only `GITHUB_TOKEN` that the workflow's `permissions` key can raise, reads only Dependabot secrets, and a re-run keeps the original run's privileges even when someone else starts it ([troubleshooting Dependabot on GitHub Actions](https://docs.github.com/en/code-security/dependabot/troubleshooting-dependabot/troubleshooting-dependabot-on-github-actions)). The [OpenID Connect reference](https://docs.github.com/en/actions/reference/security/oidc) does not exclude Dependabot `pull_request` runs from `id-token`. The OIDC subject for any `pull_request` event is `repo:<owner>@<ownerId>/<repo>@<repoId>:pull_request`, which is what the plan identity trusts, so the re-run plan uses the Dependabot secrets and that subject. If it cannot obtain a token anyway, plan that bump locally with `ARM_USE_CLI=true` instead of changing the gate.

- Its credentials match `pull_request` and `ref:refs/heads/main` only. A job that declares `environment:` gets a different subject, so plan, preview and production-deploy jobs must not use an `environment`. Only the apply job uses `environment: production`.

Federated credentials use GitHub's **immutable subject** format, `repo:<owner>@<ownerId>/<repo>@<repoId>:<context>`. The older `repo:<owner>/<repo>:<context>` form silently fails to match and surfaces as `AADSTS700213`.

Replication is ZRS: the state is a few KB, versioned and soft-deleted, and zone redundancy covers a datacentre failure. A second-region copy (GRS) would add cost with no stated need. Trivy and Snyk both flag the lack of geo-replication; switch `account_replication_type` to `GRS` if you ever want it.

## Requirements

- Terraform 1.15 or later (1.16 is fine) and the Azure CLI.
- An Azure account with **Owner** on the subscription, because the bootstrap creates role assignments.
- The GitHub CLI, to read the numeric account and repository IDs.

## Steps

### 1. Apply

`backend.tf` is committed, but its storage account and container do not exist until this stack creates them. For a first-ever apply, move it aside so Terraform uses local state: `Rename-Item backend.tf backend.tf.off`. (`backend.tf.off` is not committed; step 2 puts it back.) For routine changes to an already-applied stack, leave it in place.

```powershell
az login
$env:TF_VAR_github_owner_id = gh api users/louislawson --jq .id
$env:TF_VAR_github_repo_id  = gh api repos/louislawson/louislawson.co.uk --jq .id

terraform init
terraform plan
terraform apply
```

Both IDs are required inputs with no default, so they never appear in a committed file. You can also put them in a `terraform.tfvars` file, which is gitignored. Do not commit values.

The provider is configured with `storage { data_plane_available = false }`. The state account has shared keys disabled, and you have no storage data-plane role until this apply creates your assignments, so the provider must not read the storage data plane while creating the account. Nothing else is needed from you for this, but if the first apply still fails with `403` on a storage call, wait a few minutes and re-run `terraform apply`; it resumes where it stopped.

### 2. Move the state into the new storage account

The first apply uses local state, because the storage account does not exist yet. Move it as soon as the apply succeeds.

1. Back up the local state: copy `terraform.tfstate` somewhere outside the repository.
2. Restore `backend.tf` next to `main.tf` (`Rename-Item backend.tf.off backend.tf`). It contains:

   ```hcl
   terraform {
     backend "azurerm" {
       storage_account_name = "stlouislawsontfstate"
       container_name       = "tfstate-bootstrap"
       key                  = "bootstrap.tfstate"
       use_azuread_auth     = true
       use_cli              = true
     }
   }
   ```

   Bootstrap only ever runs locally, so Azure CLI authentication is fixed in the block. The tenant comes from the signed-in CLI session.

3. Wait a few minutes after the apply, then run `terraform init -migrate-state` and answer `yes`. Your new Storage Blob Data Contributor assignment can take a while to propagate; a `403 AuthorizationPermissionMismatch` means wait and retry.
4. Run `terraform plan`; it should report no changes. Then delete the local `terraform.tfstate*` files.
5. `backend.tf` holds placement only, nothing sensitive, and is committed.

### 3. Set the Actions secrets and Dependabot secrets

Each ID is stored as an **Actions secret** and as a **Dependabot secret** of the same name, because Dependabot-triggered runs read only the Dependabot secrets. Do not use repository variables: the repository is public, and a variable is printed unmasked in the `env:` header of the step that masks it, whereas the runner masks a secret from the first log line. These IDs never go into committed files. CI checks that each one is a GUID, so stray whitespace from copying fails with a message naming the secret.

```powershell
$values = @{
  AZURE_PLAN_CLIENT_ID    = (terraform output -raw plan_client_id)
  AZURE_APPLY_CLIENT_ID   = (terraform output -raw apply_client_id)
  AZURE_TENANT_ID         = (terraform output -raw tenant_id)
  AZURE_SUBSCRIPTION_ID   = (terraform output -raw subscription_id)
}
foreach ($name in $values.Keys) {
  gh secret set $name --body $values[$name]
  gh secret set $name --app dependabot --body $values[$name]
}
```

### 4. Create the `production` environment

In the repository settings, go to Environments, create `production` and add yourself as a required reviewer. The apply identity is only trusted for this environment, so a workflow that does not use it cannot apply.

### 5. Wait for propagation

Federated credentials can take a few minutes to propagate. An `AADSTS70021` error on the first workflow run usually means waiting and retrying.

## Confirming the OIDC subject

If a run fails with `AADSTS700213`, the subject Azure received differs from the credential. The first `azure/login` run prints the subject on its "Federated token details" line. Compare it with the credential's subject in the Azure portal, under the identity's Federated credentials.

## Checks

Run from this directory before pushing:

```sh
terraform fmt -check
terraform init -backend=false
terraform validate
tflint --config=../.tflint.hcl --init
tflint --config=../.tflint.hcl
```

`.terraform.lock.hcl` is committed and locked for `windows_amd64` and `linux_amd64`. After a provider upgrade, including a Dependabot one that drops a platform's hashes, refresh it with:

```sh
terraform providers lock -platform=windows_amd64 -platform=linux_amd64
```
