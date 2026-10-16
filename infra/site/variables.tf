variable "github_owner" {
  description = "GitHub account that owns the repository (used for the repo tag)"
  type        = string
  default     = "louislawson"
}

variable "github_repo" {
  description = "Name of the GitHub repository (used for the repo tag)"
  type        = string
  default     = "louislawson.co.uk"
}

variable "location" {
  description = "Azure region for the Static Web App"
  type        = string
  default     = "westeurope"
}

variable "resource_group_name" {
  description = "Name of the existing resource group, created by the bootstrap stack, that the site deploys into"
  type        = string
  default     = "rg-louislawson-web-prod-weu"
}

variable "static_web_app_name" {
  description = "Name of the Static Web App"
  type        = string
  default     = "stapp-louislawson-web-prod-weu"
}

variable "sku_tier" {
  description = "Static Web App plan tier. Free allows 3 preview environments and 2 custom domains"
  type        = string
  default     = "Free"

  validation {
    condition     = contains(["Free", "Standard"], var.sku_tier)
    error_message = "sku_tier must be Free or Standard."
  }
}

variable "sku_size" {
  description = "Static Web App plan size; must match sku_tier"
  type        = string
  default     = "Free"

  validation {
    condition     = contains(["Free", "Standard"], var.sku_size)
    error_message = "sku_size must be Free or Standard."
  }
}
