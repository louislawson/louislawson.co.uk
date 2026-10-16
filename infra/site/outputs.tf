output "default_host_name" {
  description = "Default hostname of the Static Web App (the production URL until the custom domain is attached)"
  value       = azurerm_static_web_app.site.default_host_name
}

# Deliberately no output for api_key: the deployment token is fetched at run time by the deploy
# workflow and must never be printed or exposed as an output.
