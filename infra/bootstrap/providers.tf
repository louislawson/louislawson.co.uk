provider "azurerm" {
  # Shared keys are disabled on the state account, so data-plane calls use Entra ID.
  storage_use_azuread = true

  # azurerm 5.x no longer registers resource providers automatically.
  resource_providers_to_register = [
    "Microsoft.ManagedIdentity",
    "Microsoft.Storage",
    "Microsoft.Web",
  ]

  features {}
}
