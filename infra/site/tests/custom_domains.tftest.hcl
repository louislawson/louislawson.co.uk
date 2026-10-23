mock_provider "azurerm" {
  mock_data "azurerm_resource_group" {
    defaults = {
      name     = "rg-louislawson-web-prod-weu"
      location = "westeurope"
    }
  }

  # The custom domain parses the app's ID, so the mock needs a well-formed one (made-up GUID).
  mock_resource "azurerm_static_web_app" {
    defaults = {
      id = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg-louislawson-web-prod-weu/providers/Microsoft.Web/staticSites/stapp-louislawson-web-prod-weu"
    }
  }

  # Azure issues the token for a dns-txt-token domain and leaves it empty for cname-delegation.
  mock_resource "azurerm_static_web_app_custom_domain" {
    defaults = {
      validation_token = "mock-validation-token"
    }
  }
}

run "no_domains_by_default" {
  command = apply

  assert {
    condition     = length(azurerm_static_web_app_custom_domain.site) == 0
    error_message = "With custom_domains empty, no custom domain resource may be created."
  }

  assert {
    condition     = length(output.custom_domain_validation_tokens) == 0
    error_message = "With custom_domains empty, there are no validation tokens to output."
  }
}

run "apex_only" {
  command = apply

  variables {
    custom_domains = {
      "example.test" = { validation_type = "dns-txt-token" }
    }
  }

  assert {
    condition     = toset(keys(azurerm_static_web_app_custom_domain.site)) == toset(["example.test"])
    error_message = "Exactly the apex domain must be created."
  }

  assert {
    condition     = azurerm_static_web_app_custom_domain.site["example.test"].validation_type == "dns-txt-token"
    error_message = "The apex must use dns-txt-token validation."
  }

  assert {
    condition     = azurerm_static_web_app_custom_domain.site["example.test"].domain_name == "example.test"
    error_message = "The domain name must be the map key."
  }

  assert {
    condition     = azurerm_static_web_app_custom_domain.site["example.test"].static_web_app_id == azurerm_static_web_app.site.id
    error_message = "The domain must attach to the site's Static Web App."
  }

  assert {
    condition     = output.custom_domain_validation_tokens == { "example.test" = "mock-validation-token" }
    error_message = "The apex's validation token must be output, keyed by domain."
  }
}

run "apex_and_www" {
  command = apply

  variables {
    custom_domains = {
      "example.test"     = { validation_type = "dns-txt-token" }
      "www.example.test" = { validation_type = "cname-delegation" }
    }
  }

  assert {
    condition     = toset(keys(azurerm_static_web_app_custom_domain.site)) == toset(["example.test", "www.example.test"])
    error_message = "Both the apex and www must be created."
  }

  assert {
    condition     = azurerm_static_web_app_custom_domain.site["www.example.test"].validation_type == "cname-delegation"
    error_message = "www must use cname-delegation validation."
  }

  assert {
    condition     = toset(keys(output.custom_domain_validation_tokens)) == toset(["example.test"])
    error_message = "Only dns-txt-token domains have a validation token to output; www has none."
  }
}

run "unknown_validation_type_rejected" {
  command = plan

  variables {
    custom_domains = {
      "example.test" = { validation_type = "email" }
    }
  }

  expect_failures = [var.custom_domains]
}

run "more_domains_than_the_free_plan_allows_rejected" {
  command = plan

  variables {
    custom_domains = {
      "example.test"      = { validation_type = "dns-txt-token" }
      "www.example.test"  = { validation_type = "cname-delegation" }
      "blog.example.test" = { validation_type = "cname-delegation" }
    }
  }

  expect_failures = [var.custom_domains]
}

run "malformed_domain_name_rejected" {
  command = plan

  variables {
    custom_domains = {
      "https://example.test" = { validation_type = "dns-txt-token" }
    }
  }

  expect_failures = [var.custom_domains]
}

run "upper_case_domain_name_rejected" {
  command = plan

  variables {
    custom_domains = {
      "Example.test" = { validation_type = "dns-txt-token" }
    }
  }

  expect_failures = [var.custom_domains]
}
