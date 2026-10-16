# Created by the bootstrap stack; read here, never managed.
data "azurerm_resource_group" "site" {
  name = var.resource_group_name
}

# The Free plan is deliberate: it allows 3 preview environments and the 2 custom domains the site
# needs (apex and www). The resource is written directly rather than through the Azure Verified
# Module, which requires azurerm 4.x. It follows the module's conventions instead: typed, described
# variables, SKU set explicitly, and deletion protection.
resource "azurerm_static_web_app" "site" {
  name                = var.static_web_app_name
  resource_group_name = data.azurerm_resource_group.site.name
  location            = var.location

  sku_tier = var.sku_tier
  sku_size = var.sku_size

  # Pull requests deploy to preview environments.
  preview_environments_enabled = true

  tags = local.tags

  lifecycle {
    # Deploying with the API key from CI makes Azure record these fields, and the provider would
    # otherwise plan to blank them on every run.
    ignore_changes = [repository_branch, repository_url]

    # An AVM-style CanNotDelete lock would need Owner-level rights the apply identity does not have.
    prevent_destroy = true
  }
}
