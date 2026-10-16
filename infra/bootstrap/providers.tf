provider "azurerm" {
  # Shared keys are disabled on the state account, so data-plane calls use Entra ID.
  storage_use_azuread = true

  # azurerm 5.x no longer registers resource providers automatically.
  resource_providers_to_register = [
    "Microsoft.ManagedIdentity",
    "Microsoft.Storage",
    "Microsoft.Web",
  ]

  features {
    # The state account has shared keys disabled and the signed-in Owner has no data-plane role
    # until this apply creates it, so stop the provider reading the storage data plane while
    # creating or refreshing the account. The account uses no queue_properties or static_website.
    storage {
      data_plane_available = false
    }
  }
}
