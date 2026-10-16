locals {
  # The tag keys are shared with infra/bootstrap; keep the two stacks in step.
  tags = {
    project      = "personal-website"
    env          = "prod"
    "managed-by" = "terraform"
    repo         = "${var.github_owner}/${var.github_repo}"
    stack        = "site"
  }
}
