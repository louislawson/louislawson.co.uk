# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Astro (static output) in a public GitHub repository. Hosted on Azure Static Web Apps (free tier). Infrastructure defined in Terraform; deployed by GitHub Actions; pull requests get preview environments.

Domain: louislawson.co.uk, connected after the build. Until then the site URL comes from configuration and production is `noindex`.

## Users

A mix of three audiences, none dominant:

- **Recruiters and hiring managers** checking whether Louis's cloud, DevOps and Azure experience fits a role. They scan quickly, then want a CV, LinkedIn or contact route.
- **Prospective clients or collaborators** deciding whether to trust Louis with cloud/DevOps work. They want evidence of real delivered outcomes.
- **Peers and the engineering community** reading project write-ups and following Louis's GitHub/LinkedIn.

## Product Purpose

Louis Lawson's professional home base on the web: a personal site that presents their cloud, DevOps and Azure work through projects, skills, certifications and the interests behind them. Success means a visitor leaves with an accurate, specific picture of what Louis has actually done and an obvious way to get in touch or see more.

## Positioning

The site is grounded in real, verifiable work rather than buzzword lists. What it says should be specific to Louis's own projects, outcomes, certifications and tooling, and should not be copyable to any other cloud engineer's portfolio.

## Operating Context

- Visitors arrive from LinkedIn, a CV link, GitHub, or a shared link preview, often on mobile.
- The site itself (public repo, Terraform, CI/CD to Azure Static Web Apps) is a small, real example of the work it describes.

## Capabilities and Constraints

- Static site with no backend. Contact is the email alias <hello@louislawson.co.uk>, LinkedIn, GitHub, and a downloadable CV.
- All content lives in one editable data layer plus one Markdown file per project, so it can be maintained without touching layout code.
- No employer is named anywhere. Career context is given as years and sectors; work projects are anonymised with a descriptor (e.g. "a UK financial-services organisation") and rounded or relative figures. Personal and open-source projects may be named.
- Analytics: cookieless and anonymous: visit counts and page-load timings only; no cookies, no consent banner.

## Evidence on Hand

**None yet.** The site starts from clearly marked placeholders, and Louis fills in real content. Until then:

- Roles, dates, certifications, project outcomes, metrics, testimonials and links must **not** be fabricated or presented as fact.
- Every placeholder must be visibly marked in the content file and recognisable as a placeholder on preview builds. Production requires a minimum set (intro with career line, role line, at least two real projects, email, LinkedIn, CV) and omits optional content that is still a placeholder.
- Confirmed facts: the name Louis Lawson, the domain louislawson.co.uk, the email alias <hello@louislawson.co.uk>, the focus areas (cloud, DevOps, Azure), and a personal interest in cars, trucks and tractors.

## Privacy Commitments

The repository is public, so nothing personal or private may leak:

- Commits use a GitHub no-reply address; secrets are scanned in CI and blocked by push protection.
- Environment details (providers, accounts, tenant and subscription information) are never committed; they live in a local, gitignored notes file.
- The CV is a web-safe version (no phone, no address) with PDF metadata stripped; CI rejects PDFs carrying author or path metadata.
- Photos are Louis's own, taken at events and meets: metadata stripped before commit, CI fails on GPS data, road-vehicle plates and identifiable faces blurred or cropped, captions name the event and vehicle, never the owner.
- Location is shown at region level only.

## Product Principles

1. **Grounded over impressive.** A specific true sentence beats a broad claim. Nothing on the site should be unverifiable.
2. **Projects carry the story.** DevOps and cloud work is shown through what was built, why, and what changed as a result.
3. **Fast to scan, rewarding to read.** A recruiter gets the gist in seconds; a peer can go deep on a project.
4. **Easy to keep true.** Content is edited in one place, and time-sensitive statements expire, so the site stays honest even when it isn't updated.
5. **Private by default.** Public enough to be evidence, never enough to locate or identify people, employers, clients or the infrastructure behind accounts.

## Accessibility & Inclusion

WCAG 2.2 AA as the baseline: semantic structure, keyboard navigation, sufficient contrast, and respect for reduced-motion preferences. Automated accessibility checks run in CI.
