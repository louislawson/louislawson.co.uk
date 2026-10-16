variable "github_owner" {
  description = "GitHub account that owns the repository"
  type        = string
  default     = "louislawson"
}

variable "github_owner_id" {
  description = "Numeric ID of the GitHub account (gh api users/<owner> --jq .id), needed for GitHub's immutable OIDC subjects"
  type        = string

  validation {
    condition     = can(regex("^[0-9]+$", var.github_owner_id))
    error_message = "github_owner_id must be a numeric GitHub account ID."
  }
}

variable "github_repo" {
  description = "Name of the GitHub repository that runs the pipelines"
  type        = string
  default     = "louislawson.co.uk"
}

variable "github_repo_id" {
  description = "Numeric ID of the repository (gh api repos/<owner>/<repo> --jq .id), needed for GitHub's immutable OIDC subjects"
  type        = string

  validation {
    condition     = can(regex("^[0-9]+$", var.github_repo_id))
    error_message = "github_repo_id must be a numeric GitHub repository ID."
  }
}

variable "location" {
  description = "Azure region for all resources"
  type        = string
  default     = "westeurope"
}
