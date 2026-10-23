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
    # sku_tier is already limited to Free or Standard, so matching it limits sku_size too.
    condition     = var.sku_size == var.sku_tier
    error_message = "sku_size must match sku_tier."
  }
}

variable "custom_domains" {
  description = <<-EOT
    Custom domains for the Static Web App, keyed by domain name. Empty by default, so the stack
    attaches no domain until this default is changed. CI passes no variables and a *.tfvars file
    is gitignored, so the domains are set by editing the default below in a reviewed pull request.
    An apex must use dns-txt-token (Azure requires it); a subdomain such as www uses
    cname-delegation, which needs its CNAME record in place before the apply. Free allows 2
    domains and Standard 5.
  EOT
  type = map(object({
    validation_type = string
  }))
  default = {}

  validation {
    condition = alltrue([
      for domain in values(var.custom_domains) : contains(["cname-delegation", "dns-txt-token"], domain.validation_type)
    ])
    error_message = "Each custom domain's validation_type must be cname-delegation or dns-txt-token."
  }

  validation {
    # A typo here would otherwise fail only at apply, which in this repo is after merge and after
    # the production approval. Lower case, dot-separated labels, no scheme or path.
    condition = alltrue([
      for domain in keys(var.custom_domains) : can(regex("^([a-z0-9]([a-z0-9-]*[a-z0-9])?\\.)+[a-z]{2,}$", domain))
    ])
    error_message = "Each custom domain name must be a lower-case host name such as example.com, with no scheme, path or port."
  }

  validation {
    # Free allows 2 custom domains and Standard 5 (Azure Static Web Apps hosting plans).
    condition     = length(var.custom_domains) <= (var.sku_tier == "Free" ? 2 : 5)
    error_message = "The ${var.sku_tier} plan allows ${var.sku_tier == "Free" ? 2 : 5} custom domains."
  }
}
