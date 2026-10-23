output "default_host_name" {
  description = "Default hostname of the Static Web App (the production URL until the custom domain is attached)"
  value       = azurerm_static_web_app.site.default_host_name
}

# Deliberately no output for api_key: the deployment token is fetched at run time by the deploy
# workflow and must never be printed or exposed as an output.

# The provider marks validation_token sensitive, so the output must be too, which keeps it out of the
# public CI log. Read it locally with `terraform output -json custom_domain_validation_tokens`. It
# ends up in a public TXT record anyway, and Azure clears it once the domain is validated.
output "custom_domain_validation_tokens" {
  description = "TXT record value for each dns-txt-token custom domain, keyed by domain name. Empty once validated"
  sensitive   = true
  value = {
    for domain, resource in azurerm_static_web_app_custom_domain.site : domain => resource.validation_token
    if resource.validation_type == "dns-txt-token"
  }
}
