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

The CI identities have **no access to `tfstate-bootstrap`**. The plan identity is trusted for every pull-request run, so if it could write this stack's state, a pull request could tamper with the stack that owns the identities and role assignments.

Notes on the plan identity:

- It is trusted for every `pull_request` run in this repository and holds write access to the site state container and the Static Web App deployment token, so treat who can open pull requests and run workflows as part of the trust boundary. In the repository's Actions settings, require approval for workflows from outside collaborators.
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

### 3. Set the GitHub variables and Dependabot secrets

Dependabot-triggered runs cannot read Actions variables or secrets reliably, so each ID is stored in both places under the same name. These IDs never go into committed files.

```powershell
$values = @{
  AZURE_PLAN_CLIENT_ID    = (terraform output -raw plan_client_id)
  AZURE_APPLY_CLIENT_ID   = (terraform output -raw apply_client_id)
  AZURE_TENANT_ID         = (terraform output -raw tenant_id)
  AZURE_SUBSCRIPTION_ID   = (terraform output -raw subscription_id)
}
foreach ($name in $values.Keys) {
  gh variable set $name --body $values[$name]
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
