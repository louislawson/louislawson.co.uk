# azurerm 5.x registers no resource providers by default. Microsoft.Web is registered by the
# bootstrap stack, so this stack leaves registration alone.
provider "azurerm" {
  features {}
}
