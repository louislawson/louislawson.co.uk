data "azurerm_client_config" "current" {}

# State storage

resource "azurerm_resource_group" "state" {
  name     = "rg-louislawson-tfstate-weu"
  location = var.location
  tags     = local.tags
}

# Accepted Trivy findings for this account:
# - AZU-0012: public network access is deliberate. GitHub-hosted runners have no stable IPs, so
#   Entra-only auth (shared keys off) and RBAC on the containers are the access control.
# - AZU-0057: no Storage Analytics logging; the state is low-volume and every change is versioned.
# - AZU-0058: ZRS rather than GRS. The state is a few KB, versioned and soft-deleted, and zone
#   redundancy covers a datacentre failure; a second-region copy adds cost with no stated need.
# - AZU-0060: no customer-managed key; that needs a Key Vault, and infrastructure (double)
#   encryption with platform-managed keys is enabled.
#trivy:ignore:AZU-0012
#trivy:ignore:AZU-0057
#trivy:ignore:AZU-0058
#trivy:ignore:AZU-0060
resource "azurerm_storage_account" "state" {
  name                = "stlouislawsontfstate"
  resource_group_name = azurerm_resource_group.state.name
  location            = azurerm_resource_group.state.location

  account_kind             = "StorageV2"
  account_tier             = "Standard"
  account_replication_type = "ZRS"

  # Entra ID only: no shared keys, and so no SAS tokens signed with them.
  shared_access_key_enabled       = false
  default_to_oauth_authentication = true

  # Local users only serve SFTP, which is off.
  local_user_enabled = false

  min_tls_version                   = "TLS1_2"
  https_traffic_only_enabled        = true
  allow_nested_items_to_be_public   = false
  infrastructure_encryption_enabled = true

  # Public network access stays enabled: GitHub-hosted runners have no stable IPs.
  # Entra-only auth and RBAC are the access control.
  public_network_access = "Enabled"

  blob_properties {
    versioning_enabled = true

    delete_retention_policy {
      days = 30
    }

    container_delete_retention_policy {
      days = 30
    }
  }

  tags = local.tags

  lifecycle {
    prevent_destroy = true
  }
}

# Two containers, so the CI identities can never touch the state of the stack that owns them.

# Bootstrap state (this stack). Only the operator has data-plane access.
resource "azurerm_storage_container" "bootstrap" {
  name                  = "tfstate-bootstrap"
  storage_account_id    = azurerm_storage_account.state.id
  container_access_type = "private"

  lifecycle {
    prevent_destroy = true
  }
}

# Site state (infra/site). The CI identities have data-plane access to this container only.
resource "azurerm_storage_container" "site" {
  name                  = "tfstate"
  storage_account_id    = azurerm_storage_account.state.id
  container_access_type = "private"

  lifecycle {
    prevent_destroy = true
  }
}

# Site resource group, created here so the CI identities can be scoped to it.

resource "azurerm_resource_group" "site" {
  name     = "rg-louislawson-web-prod-weu"
  location = var.location
  tags     = local.tags
}

# CI identities: user-assigned managed identities, so no app registration and no Entra directory roles.

resource "azurerm_user_assigned_identity" "plan" {
  name                = "id-louislawson-web-plan"
  resource_group_name = azurerm_resource_group.state.name
  location            = azurerm_resource_group.state.location
  tags                = local.tags
}

resource "azurerm_user_assigned_identity" "apply" {
  name                = "id-louislawson-web-apply"
  resource_group_name = azurerm_resource_group.state.name
  location            = azurerm_resource_group.state.location
  tags                = local.tags
}

resource "azurerm_federated_identity_credential" "plan" {
  for_each = local.plan_subjects

  name                      = "github-${each.key}"
  user_assigned_identity_id = azurerm_user_assigned_identity.plan.id
  issuer                    = local.github_oidc_issuer
  audience                  = [local.github_oidc_audience]
  subject                   = each.value
}

resource "azurerm_federated_identity_credential" "apply" {
  for_each = local.apply_subjects

  name                      = "github-${each.key}"
  user_assigned_identity_id = azurerm_user_assigned_identity.apply.id
  issuer                    = local.github_oidc_issuer
  audience                  = [local.github_oidc_audience]
  subject                   = each.value
}

# Role assignments. Nothing is granted at subscription scope.

# Plan identity: read the site resource group, and read the Static Web App including its secrets.
#
# Reader covers the GETs (`*/read`), but azurerm_static_web_app's Read also POSTs to listSecrets
# (the `api_key` attribute) and listAppSettings, which are separate actions Reader does not hold.
# The built-in Website Contributor role does not help: it grants Microsoft.Web/sites/*, not
# Microsoft.Web/staticSites/*. This custom role adds just those two actions; the provider's other
# reads (the site itself and basicAuth/default) are GETs that Reader already covers. The same
# listSecrets action lets the deploy workflows fetch the deployment token.
resource "azurerm_role_definition" "plan_static_web_app" {
  name        = "Static Web App Reader (louislawson web)"
  scope       = azurerm_resource_group.site.id
  description = "Read a Static Web App including its deployment token and app settings. Add to Reader for terraform plan and deploys."

  permissions {
    actions = [
      "Microsoft.Web/staticSites/read",
      "Microsoft.Web/staticSites/listSecrets/action",
      "Microsoft.Web/staticSites/listAppSettings/action",
    ]
  }

  assignable_scopes = [azurerm_resource_group.site.id]
}

resource "azurerm_role_assignment" "plan_site_reader" {
  scope                = azurerm_resource_group.site.id
  role_definition_name = "Reader"
  principal_id         = azurerm_user_assigned_identity.plan.principal_id
  principal_type       = "ServicePrincipal"
}

resource "azurerm_role_assignment" "plan_site_static_web_app" {
  scope              = azurerm_resource_group.site.id
  role_definition_id = azurerm_role_definition.plan_static_web_app.role_definition_resource_id
  principal_id       = azurerm_user_assigned_identity.plan.principal_id
  principal_type     = "ServicePrincipal"
}

# Apply identity: manage the site resource group.
resource "azurerm_role_assignment" "apply_site_contributor" {
  scope                = azurerm_resource_group.site.id
  role_definition_name = "Contributor"
  principal_id         = azurerm_user_assigned_identity.apply.principal_id
  principal_type       = "ServicePrincipal"
}

# Site state container data plane. Plan takes a blob lease lock, so both identities need write access.
resource "azurerm_role_assignment" "site_state_plan" {
  scope                = azurerm_storage_container.site.id
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = azurerm_user_assigned_identity.plan.principal_id
  principal_type       = "ServicePrincipal"
}

resource "azurerm_role_assignment" "site_state_apply" {
  scope                = azurerm_storage_container.site.id
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = azurerm_user_assigned_identity.apply.principal_id
  principal_type       = "ServicePrincipal"
}

# The signed-in user needs data-plane access to both containers, because Owner covers the control
# plane only: bootstrap state migration, and local plans of the site stack.
resource "azurerm_role_assignment" "bootstrap_state_operator" {
  scope                = azurerm_storage_container.bootstrap.id
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = data.azurerm_client_config.current.object_id
}

resource "azurerm_role_assignment" "site_state_operator" {
  scope                = azurerm_storage_container.site.id
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = data.azurerm_client_config.current.object_id
}
