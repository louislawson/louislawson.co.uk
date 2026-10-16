mock_provider "azurerm" {
  # The resource group already exists (created by the bootstrap stack) and is read, not created.
  mock_data "azurerm_resource_group" {
    defaults = {
      name     = "rg-louislawson-web-prod-weu"
      location = "westeurope"
    }
  }
}

run "configuration" {
  command = plan

  assert {
    condition     = azurerm_static_web_app.site.sku_tier == "Free" && azurerm_static_web_app.site.sku_size == "Free"
    error_message = "The Static Web App must be on the Free plan."
  }

  assert {
    condition     = azurerm_static_web_app.site.location == "westeurope"
    error_message = "The Static Web App must be in West Europe."
  }

  assert {
    condition     = azurerm_static_web_app.site.preview_environments_enabled == true
    error_message = "Preview environments must be enabled for PR previews."
  }

  assert {
    condition     = azurerm_static_web_app.site.resource_group_name == data.azurerm_resource_group.site.name
    error_message = "The Static Web App must deploy into the resource group created by the bootstrap stack."
  }

  assert {
    condition = azurerm_static_web_app.site.tags == tomap({
      project      = "personal-website"
      env          = "prod"
      "managed-by" = "terraform"
      repo         = "${var.github_owner}/${var.github_repo}"
      stack        = "site"
    })
    error_message = "The Static Web App must carry the shared tag keys with stack = site."
  }
}

run "invalid_sku_rejected" {
  command = plan

  # Match the size so the only rule that can fail is the tier's allowed values.
  variables {
    sku_tier = "Premium"
    sku_size = "Premium"
  }

  expect_failures = [var.sku_tier]
}

run "mismatched_sku_rejected" {
  command = plan

  variables {
    sku_tier = "Standard"
    sku_size = "Free"
  }

  expect_failures = [var.sku_size]
}
