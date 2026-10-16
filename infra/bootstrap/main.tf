data "azurerm_client_config" "current" {}

# State storage

resource "azurerm_resource_group" "state" {
  name     = "rg-louislawson-tfstate-weu"
  location = var.location
  tags     = var.tags
}

# Accepted Trivy findings for this account:
# - AZU-0012: public network access is deliberate. GitHub-hosted runners have no stable IPs, so
#   Entra-only auth (shared keys off) and RBAC on the container are the access control.
# - AZU-0057: no Storage Analytics logging; the state is low-volume and every change is versioned.
# - AZU-0058: LRS rather than GRS; blob versioning and 30-day soft delete cover accidental loss.
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
  account_replication_type = "LRS"

  # Entra ID only: no shared keys, and so no SAS tokens signed with them.
  shared_access_key_enabled       = false
  default_to_oauth_authentication = true

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

  tags = var.tags

  lifecycle {
    prevent_destroy = true
  }
}

resource "azurerm_storage_container" "state" {
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
  tags     = var.tags
}

# CI identities: user-assigned managed identities, so no app registration and no Entra directory roles.

resource "azurerm_user_assigned_identity" "plan" {
  name                = "id-louislawson-web-plan"
  resource_group_name = azurerm_resource_group.state.name
  location            = azurerm_resource_group.state.location
  tags                = var.tags
}

resource "azurerm_user_assigned_identity" "apply" {
  name                = "id-louislawson-web-apply"
  resource_group_name = azurerm_resource_group.state.name
  location            = azurerm_resource_group.state.location
  tags                = var.tags
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

# Plan identity: read the site resource group, and fetch the Static Web App deployment token.
resource "azurerm_role_assignment" "plan_site_reader" {
  scope                = azurerm_resource_group.site.id
  role_definition_name = "Reader"
  principal_id         = azurerm_user_assigned_identity.plan.principal_id
  principal_type       = "ServicePrincipal"
}

resource "azurerm_role_assignment" "plan_site_website_contributor" {
  scope                = azurerm_resource_group.site.id
  role_definition_name = "Website Contributor"
  principal_id         = azurerm_user_assigned_identity.plan.principal_id
  principal_type       = "ServicePrincipal"
}

# Apply identity: manage the site resource group.
resource "azurerm_role_assignment" "apply_site_contributor" {
  scope                = azurerm_resource_group.site.id
  role_definition_name = "Contributor"
  principal_id         = azurerm_user_assigned_identity.apply.principal_id
  principal_type       = "ServicePrincipal"
}

# State container data plane. Plan takes a blob lease lock, so both identities need write access.
# The signed-in user needs it too, because Owner covers the control plane only (state migration).
resource "azurerm_role_assignment" "state_plan" {
  scope                = azurerm_storage_container.state.id
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = azurerm_user_assigned_identity.plan.principal_id
  principal_type       = "ServicePrincipal"
}

resource "azurerm_role_assignment" "state_apply" {
  scope                = azurerm_storage_container.state.id
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = azurerm_user_assigned_identity.apply.principal_id
  principal_type       = "ServicePrincipal"
}

resource "azurerm_role_assignment" "state_operator" {
  scope                = azurerm_storage_container.state.id
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = data.azurerm_client_config.current.object_id
  principal_type       = "User"
}
