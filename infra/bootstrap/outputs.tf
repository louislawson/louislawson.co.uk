output "apply_client_id" {
  description = "Client ID of the apply identity (set as AZURE_APPLY_CLIENT_ID)"
  value       = azurerm_user_assigned_identity.apply.client_id
}

output "plan_client_id" {
  description = "Client ID of the plan identity (set as AZURE_PLAN_CLIENT_ID)"
  value       = azurerm_user_assigned_identity.plan.client_id
}

output "subscription_id" {
  description = "Azure subscription ID (set as AZURE_SUBSCRIPTION_ID)"
  value       = data.azurerm_client_config.current.subscription_id
}

output "tenant_id" {
  description = "Microsoft Entra tenant ID (set as AZURE_TENANT_ID)"
  value       = data.azurerm_client_config.current.tenant_id
}
