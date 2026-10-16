locals {
  github_oidc_issuer   = "https://token.actions.githubusercontent.com"
  github_oidc_audience = "api://AzureADTokenExchange"

  # GitHub's immutable subject format: repo:<owner>@<ownerId>/<repo>@<repoId>:<context>.
  # The older repo:<owner>/<repo>:<context> form silently fails to match.
  github_subject_prefix = "repo:${var.github_owner}@${var.github_owner_id}/${var.github_repo}@${var.github_repo_id}"

  # The plan identity is trusted for pull requests and for main.
  plan_subjects = {
    pull-request = "${local.github_subject_prefix}:pull_request"
    main         = "${local.github_subject_prefix}:ref:refs/heads/main"
  }

  # The apply identity is trusted only for the production environment.
  apply_subjects = {
    production = "${local.github_subject_prefix}:environment:production"
  }
}
