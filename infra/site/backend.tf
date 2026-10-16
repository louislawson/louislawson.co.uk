# Placement only. Credentials and the auth method come from the environment:
# ARM_USE_OIDC plus ARM_CLIENT_ID, ARM_TENANT_ID and ARM_SUBSCRIPTION_ID in CI, ARM_USE_CLI locally.
terraform {
  backend "azurerm" {
    storage_account_name = "stlouislawsontfstate"
    container_name       = "tfstate"
    key                  = "site.tfstate"
    use_azuread_auth     = true
  }
}
