# Runbook

How to do the things that come up on louislawson.co.uk, one numbered procedure each. The [README](../README.md) is the quick start and explains how the site works; where it already explains something, this page links to it instead of repeating it.

- **Commands are PowerShell,** run from the repository root unless a step says otherwise.
- **Every procedure ends with a check.** A procedure is not done until its check gives the result it describes.
- **Changes go through a pull request** from a branch (`git switch main`, `git pull --ff-only`, `git switch -c <type>/<slug>`). Louis merges. Confirm `git config user.email` is the repository's GitHub no-reply address before the first commit.
- **`<default-host>`** stands for the Static Web App's own `azurestaticapps.net` host name. Section 6, step 1 shows how to read it.

| #   | Section                                                         |
| --- | --------------------------------------------------------------- |
| 1   | [Editing content](#1-editing-content)                           |
| 2   | [Placeholders](#2-placeholders)                                 |
| 3   | [Adding a garage photo safely](#3-adding-a-garage-photo-safely) |
| 4   | [The CV PDF](#4-the-cv-pdf)                                     |
| 5   | [Previews and deploys](#5-previews-and-deploys)                 |
| 6   | [Connecting the custom domain](#6-connecting-the-custom-domain) |
| 7   | [The launch checklist](#7-the-launch-checklist)                 |
| 8   | [When something goes wrong](#8-when-something-goes-wrong)       |

## 1. Editing content

Content lives in two places: [`src/data/profile.ts`](../src/data/profile.ts) (the person, skills, certifications and garage) and one Markdown file per project in [`src/content/projects`](../src/content/projects). Both are checked by the build, so a mistake fails `npm run build` with the file and the field, never a half-finished page. [Content and placeholders](../README.md#content-and-placeholders) in the README explains what a preview and production do with a value that is not supplied yet.

The profile's fields:

| Field                                     | Rule                                                                                               |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `roleLine`, `intro`, `careerLine`         | Text. The career line names years and sectors, never an employer                                   |
| `region`                                  | A region only, never a town or an address                                                          |
| `availability`                            | `text`, and `until`: the last day it is true, as `YYYY-MM-DD` (UK time). It disappears after that  |
| `email`, `links.github`, `links.linkedin` | An email address, and `http(s)` URLs                                                               |
| `cv`                                      | Exactly `/cv.pdf` (see [section 4](#4-the-cv-pdf))                                                 |
| `skills`                                  | `group`, `context`, `tools` (at least one) and `runs`: project codes such as `R04` that must exist |
| `exploring`                               | Up to 5 short items                                                                                |
| `certifications`                          | `title`, `issuer`, `date` as `2025` or `2025-06`, and an optional `verify` URL                     |
| `garageIntro`, `garage`                   | See [section 3](#3-adding-a-garage-photo-safely)                                                   |

A project's frontmatter:

| Field                                                     | Rule                                                                                                                             |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `code`, `order`                                           | `code` is `R` and two digits. Both are unique across projects. At most 12 projects                                               |
| `featured`                                                | `true` on exactly one project                                                                                                    |
| `kind`                                                    | `work` takes a `descriptor` (an anonymised description, never the employer). `personal` and `open-source` take an optional `org` |
| `title`, `summary`, `period`, `setup`, `change`, `result` | Text                                                                                                                             |
| `headline`                                                | Two to five words                                                                                                                |
| `status`                                                  | `in-service`, `commissioning`, `complete` or `archived`                                                                          |
| `stack`                                                   | A list with at least one tool                                                                                                    |
| `links`                                                   | A list of `label` and `url`                                                                                                      |
| `measurements`                                            | Optional. Real figures or nothing: a measurement takes no placeholder                                                            |

A figure is quoted in the YAML, because a bare number is rejected. With `after` it shows as a before-and-after row; without it, as a single figure. A `unit` starting with `%` sits against the figure.

```yaml
measurements:
  - label: Deploy time
    before: "42"
    after: "9"
    unit: minutes
  - label: Incidents caught early
    before: "70"
    unit: "% of incidents"
```

Work projects are anonymised: no employer is named anywhere, and figures are rounded or relative. [`PRODUCT.md`](../PRODUCT.md) has the rules.

**The write-up** is the Markdown body under the frontmatter. Its headings start at `###`; a diagram is a Markdown image with alt text, from `src/content/projects/diagrams/`; code blocks are plain. [Write-ups](../README.md#write-ups) has the full rules, and the build reports a broken one with its line.

### Edit existing content

1. Create a branch: `git switch -c content/<slug>`.
2. Edit the field or the Markdown. Write only what is true; leave anything you do not have as a `TODO:` placeholder (see [section 2](#2-placeholders)).
3. Look at it while you work: `npm run dev`, then open <http://localhost:4321/>. A placeholder shows hatched.
4. Validate it: `npm run build`. A broken value fails with its file and field. Typical messages:

   ```text
   src/content/projects/this-website.md, write-up line 29: "## A heading" is a level-2 heading, but a write-up's headings start at ###
   result: A placeholder must be the whole value and start with "TODO:"
   measurements.0.before: Expected type "string", received "number"
   ```

5. Commit the files by path (`git status`, then `git add <paths>`), push, and open a pull request. A pull request that changes `src/` gets a preview, and its address is in the pull request's sticky comment.
6. **Check it worked.** `npm run build` ends with `Complete!`, `npm run placeholders` shows one fewer line for each value you filled in, and the preview shows the change.

### Add a project

1. Copy a placeholder file, for example `src/content/projects/r02-placeholder.md`, to `src/content/projects/<slug>.md`. The file name is the page's address, `/projects/<slug>`.
2. Give it the next free `code` and `order`. Keep `featured: false` unless it replaces the featured project, and then clear `featured` on the old one.
3. Fill in the frontmatter and the write-up as above.
4. Add the code to the `runs` of each skill group that used it.
5. **Check it worked.** `npm run build` passes (a duplicate `code` or `order`, a second featured project or an unknown code in `runs` is reported by name), and the preview lists the project.

## 2. Placeholders

A value Louis has not supplied is a string starting with `TODO:`. A local build and a preview show it hatched; production leaves out the smallest unit that would otherwise look unfinished. [Content and placeholders](../README.md#content-and-placeholders) has the exact rules and the launch gate.

**The launch gate's required set,** which production needs real once `LAUNCH` is `true`: the intro, the career line, the role line, the email, the LinkedIn link, the `cv` field with `public/cv.pdf` present, and at least two real projects with the featured one real. Everything else may stay a placeholder, because production omits it.

### List what is left

1. Run `npm run placeholders`. Each line is `file:line` and the placeholder text, and the last line is the count:

   ```text
   src/data/profile.ts:62  caption: "TODO: event and vehicle",
   65 placeholders in 4 files.
   ```

2. Fill the required set first, then the rest ([section 1](#1-editing-content)). A `TODO` or `TODOs` inside otherwise real text fails the build, so finish a sentence or leave the whole value as a placeholder.
3. See what production will show: `$env:DEPLOY_CONTEXT = "production"; npm run build; Remove-Item Env:DEPLOY_CONTEXT`. The build prints how many pages it made. Each project that still has a placeholder is missing from that count, so the production site has fewer pages than a preview.
4. **Check it worked.** Rehearse the launch gate without launching: set `const LAUNCH = false;` to `true` in [`src/config/site.ts`](../src/config/site.ts), run `npm run build`, then put the file back with `git checkout -- src/config/site.ts`. The build lists exactly what is still missing, and the gate is open when it lists nothing:

   ```text
   The launch gate (LAUNCH = true in src/config/site.ts) is not open: 7 problems:
   - The intro is still a placeholder
   - The career line is still a placeholder
   - The role line is still a placeholder
   - The LinkedIn link is still a placeholder
   - At least two real projects are needed, found 1
   - The featured project (r01-placeholder) is not real: it has a placeholder
   - The cv field is still a placeholder
   ```

## 3. Adding a garage photo safely

The repository is public, so a photo must carry nothing about the person who took it, and the picture itself must not identify anyone. [Photos and PDFs](../README.md#photos-and-pdfs) explains what the check rejects, and [`src/assets/garage/README.md`](../src/assets/garage/README.md) explains what the build does with a photo. This section is the procedure.

1. **Prepare the picture.** Blur or crop road-vehicle number plates and identifiable faces. Keep the original somewhere outside the repository: the next steps change the copy in place.
2. **Install exiftool, once.** In PowerShell:

   ```powershell
   winget install --id OliverBetz.ExifTool
   ```

   Accept the administrator prompt, then open a new terminal so `PATH` is refreshed. `choco install exiftool` is the alternative. Confirm it with `exiftool -ver`, which prints a version number such as `13.59`.

3. **Copy the photo** into `src/assets/garage/` as `.jpg`, `.jpeg`, `.png` or `.webp`, with a short lower-case name such as `car-meet.jpg`.
4. **Strip its metadata,** keeping only the orientation and the colour profile:

   ```powershell
   exiftool -all= -tagsFromFile '@' -Orientation -ICC_Profile -YCbCrPositioning= -overwrite_original src\assets\garage\car-meet.jpg
   ```

   Three details matter. The `@` is quoted because PowerShell reads a bare `@` as an error. `-YCbCrPositioning=` is last because exiftool adds that harmless tag back whenever it writes the orientation, and the metadata check rejects it. A photo with a colour profile prints `Warning: ICC_Profile deleted`, and the same command puts the profile back.

5. **Stage it, then run the gate.** The check reads only the files git tracks, so an unstaged photo is not checked at all (it reports `Checked 0 images`):

   ```powershell
   git add src/assets/garage/car-meet.jpg
   npm run metadata:check
   ```

   A photo that still carries metadata fails, and names what is left:

   ```text
   src/assets/garage/sample-photo.jpg:
     - EXIF tags other than Orientation: Make, Model, Software, Artist, YCbCrPositioning, ExifIFD, GpsIFD
     - EXIF camera, lens and date data
     - GPS location data

   Checked 1 image, PDF or SVG: 1 carry metadata that must be removed. See "Photos and PDFs" in README.md.
   ```

   Repeat step 4 until it passes: `Checked 1 image, PDF or SVG: none carry personal metadata.`

6. **Import it** in [`src/data/profile.ts`](../src/data/profile.ts). Add the import at the top, then give one `garage` entry the photo, a description and a caption:

   ```ts
   import carMeet from "../assets/garage/car-meet.jpg";
   ```

   ```ts
   {
     name: "cars",
     note: "A line on what the cars mean to you.",
     photo: carMeet,
     alt: "What is in the picture, for someone who cannot see it.",
     caption: "Event name, vehicle",
   },
   ```

   The `alt` describes the picture: what is in it and where. The `caption` names the event and the vehicle, never the owner. Every photo in the folder must be used by an entry; a photo no entry uses stops the build and is named in the error.

7. **Check it worked.** Run `npm run build`, then look at what was published:

   ```powershell
   (Select-String -Path dist\index.html -Pattern 'the alt text you wrote' -SimpleMatch).Count
   Get-ChildItem dist -Recurse -File | Where-Object Name -like '*car-meet*'
   ```

   The first prints `1`. The second prints one `.webp` under `dist\_astro`, the optimised copy; the original is never published. Commit the photo and `profile.ts` by path, and `npm run metadata:check` also runs in CI as the **Metadata check** job.

## 4. The CV PDF

The CV is `public/cv.pdf`, linked from the page when the profile's `cv` field is `/cv.pdf`. It must be web-safe: no phone number or address ([`PRODUCT.md`](../PRODUCT.md)), and none of the metadata the check rejects. [Photos and PDFs](../README.md#photos-and-pdfs) lists the PDF rules.

1. **Export it from the word processor** with its Export or Save as PDF command, not a print driver, to a place outside the repository. Leave off "fast web view" (a linearized PDF fails the check), attach nothing, and use JPEG for any picture. If it holds a photo, run [section 3](#3-adding-a-garage-photo-safely)'s strip step on that photo before it goes into the document: a rewrite of the PDF does not remove a photo's own metadata.
2. **Install qpdf, once:**

   ```powershell
   winget install --id QPDF.QPDF
   ```

   The installer does not put qpdf on `PATH`. For this terminal, add its folder (the folder name carries the version):

   ```powershell
   $env:Path += ';C:\Program Files\qpdf 12.4.2\bin'
   qpdf --version
   ```

3. **Rewrite the PDF cleanly** into the repository. This copies the pages and leaves the document-level metadata behind; editing the metadata in place with exiftool would leave the old values readable in the file:

   ```powershell
   qpdf --empty --pages C:\path\to\cv-export.pdf -- public\cv.pdf
   ```

4. **Stage it and run the gate:**

   ```powershell
   git add public/cv.pdf
   npm run metadata:check
   ```

   A PDF straight from an export typically fails like this, naming the keys:

   ```text
   public/cv.pdf:
     - document-info keys other than Title and Producer: ModDate, Creator, CreationDate, Author
   ```

   After step 3 it reports `none carry personal metadata`.

5. **Set the profile field.** In [`src/data/profile.ts`](../src/data/profile.ts) change `cv` to `"/cv.pdf"`.
6. **Check it worked.** Build production and confirm the file is published and linked:

   ```powershell
   $env:DEPLOY_CONTEXT = "production"; npm run build; Remove-Item Env:DEPLOY_CONTEXT
   Get-Item dist\cv.pdf
   (Select-String -Path dist\index.html -Pattern 'href="/cv.pdf"' -SimpleMatch).Count
   ```

   The file is listed and the count is `1`. Open `dist\cv.pdf` and read it once: the check proves the metadata, not that the content is what you meant to publish.

## 5. Previews and deploys

[Deploying](../README.md#deploying) in the README has the full trigger table, the queueing rules and the Live check. In short:

| Event                                                                         | What happens                                                                                 |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| A pull request that changes the site                                          | A preview environment, with its address in the pull request's sticky comment. Not for drafts |
| A pull request that changes only docs, `infra/`, `scripts/`, tests or tooling | No preview; CI still builds and tests                                                        |
| A pull request closed, or made a draft                                        | Its preview is removed                                                                       |
| A push to `main` that changes the site                                        | A production deploy                                                                          |
| Every day at 04:17 UTC                                                        | A production rebuild, so a statement that has expired disappears without a push              |

### Get and check a preview

1. Open a pull request (not a draft) that changes something under `src/` or `public/`, or mark a draft ready for review.
2. Wait for the **Deploy** workflow's **Preview comment** job, then take the address from the sticky comment on the pull request.
3. **Check it worked.** The page loads, and the response says not to index it:

   ```powershell
   curl.exe -sI https://<preview-host>/ | Select-String '^(HTTP/|x-robots-tag)'
   ```

   ```text
   HTTP/1.1 200 OK
   x-robots-tag: noindex
   ```

   The pull request's **Live check** job checks the same headers for you.

### Stay inside the 3-preview limit

The Free plan allows 3 previews at once, and a fourth fails at the upload step.

1. List what exists, and which pull requests are open:

   ```powershell
   az staticwebapp environment list --name stapp-louislawson-web-prod-weu --resource-group rg-louislawson-web-prod-weu --query "[].{environment:name,status:status}" -o table
   gh pr list --state open
   ```

   The environment `default` is production. Every other row is a preview, named by its pull request number.

2. Merge or close the pull requests you are finished with. Closing one runs **Preview cleanup**, which removes its preview.
3. **Check it worked.** Run the first command again: there are at most 3 rows besides `default`. A preview left behind by a pull request that is no longer open is removed in [section 8](#a-fourth-preview-fails-to-upload).

### Check that the daily rebuild is still running

GitHub switches a schedule off in a public repository after 60 days without activity, and the daily rebuild is what makes an expired availability statement disappear.

1. Look at the workflow's state and its last scheduled runs:

   ```powershell
   gh workflow list --all
   gh run list --workflow deploy.yml --event schedule --limit 3
   ```

   `Deploy` should read `active`, with a scheduled run for each of the last few days. A switched-off workflow reads `disabled_inactivity`.

2. If it is off, turn it on again with `gh workflow enable deploy.yml`.
3. **Check it worked.** `gh workflow list --all` reads `active`, and the next morning `gh run list --workflow deploy.yml --event schedule --limit 1` shows a new run. Any push to `main` also resets GitHub's inactivity clock.

### The Live check

After every deploy, the **Live check** job asks the deployed site for the headers the build generated and for a 404 on a path that does not exist. [Deploying](../README.md#deploying) says what it compares. To run it yourself against production:

1. Build the production site: `$env:DEPLOY_CONTEXT = "production"; npm run build; Remove-Item Env:DEPLOY_CONTEXT`.
2. Run the check against the production address:

   ```powershell
   node scripts/check-live.ts --url https://<default-host> --config dist/staticwebapp.config.json --index dist/index.html --context production
   ```

3. **Check it worked.** It prints `live check passed: policy, HSTS, robots header and 404 are as built` and exits 0. A failure prints `not yet:` with the header that differs, then `expected:` and `received:` lines ([section 8](#a-live-check-fails)).

## 6. Connecting the custom domain

Phase 8 uses this section. The domain is attached by Terraform, with two steps that only the Azure portal can do. [Custom domains](../infra/site/README.md#custom-domains) in the site stack's README explains why the domains are set by editing a variable's default, and what each validation type needs.

The order matters: the records first, then the apply, then the validation token, then the default domain.

1. **Read the host name the records point at.** From `infra\site`:

   ```powershell
   Set-Location infra\site
   az login
   $env:ARM_USE_CLI = "true"
   terraform init
   terraform output default_host_name
   ```

   It prints the `<default-host>` value, in quotes.

2. **Add the DNS-only records** at the DNS provider, before the apply. "DNS-only" means plain DNS answers straight from the DNS provider, with no proxy, CDN or redirect service in front, or Azure cannot validate the domain or issue its certificate. Remove any existing record for these names first.
   - `www`: a `CNAME` pointing to `<default-host>`. It must exist before the apply, because the apply waits for it.
   - The apex: an `ALIAS`, `ANAME` or flattened `CNAME` pointing to `<default-host>`, whichever your provider offers. A plain `CNAME` is not allowed at an apex.

   **Check it worked.** The names resolve:

   ```powershell
   Resolve-DnsName www.louislawson.co.uk -Type CNAME
   Resolve-DnsName louislawson.co.uk -Type A
   ```

   The first shows `<default-host>` as the `NameHost`; the second returns addresses. DNS can take a while to spread, and Azure notes an apex change can take up to 72 hours. Which provider and which screens to use are in `PRIVATE-NOTES.md`.

3. **Set the domains in a one-line pull request.** CI passes no variables, so the domains are the default of `custom_domains` in [`infra/site/variables.tf`](../infra/site/variables.tf). Change `default = {}` to:

   ```hcl
   default = {
     "louislawson.co.uk"     = { validation_type = "dns-txt-token" }
     "www.louislawson.co.uk" = { validation_type = "cname-delegation" }
   }
   ```

   From `infra\site`, run the checks CI runs:

   ```powershell
   terraform fmt -check
   terraform init -backend=false
   terraform validate
   terraform test
   ```

   `terraform test` reports `10 passed, 0 failed`. Open the pull request. Its **Terraform plan** comment must show the two domains and nothing else:

   ```text
   Plan: 2 to add, 0 to change, 0 to destroy.
   ```

4. **Merge it and approve the apply.** Louis merges. The **Infrastructure** workflow plans again, then waits for approval: open its run in GitHub Actions, choose **Review deployments**, select `production` and choose **Approve and deploy**. Read the plan first: the apply must still add only the two domains.

   **Check it worked.** The run's **Terraform apply** job is green:

   ```powershell
   gh run list --workflow infra.yml --limit 3
   ```

5. **Add the apex's TXT record.** Read the token Azure issued, from `infra\site`:

   ```powershell
   terraform init
   terraform output -json custom_domain_validation_tokens
   ```

   It prints a map from the apex to its token (`www` has none). Add the token as a `TXT` record with the host `@`, at the DNS provider. The token is not a secret once it is in a TXT record, but keep it out of chat and commits anyway: Azure clears it after validation.

   **Check it worked.** The record resolves, and Azure reports the apex as validated:

   ```powershell
   Resolve-DnsName louislawson.co.uk -Type TXT
   az staticwebapp hostname show --name stapp-louislawson-web-prod-weu --resource-group rg-louislawson-web-prod-weu --hostname louislawson.co.uk -o json
   ```

   Read the `status` field: it moves from validating to ready. The portal shows the same under **Custom domains**. Wait for both domains to be ready before the next step.

6. **Set the default domain** (the one step Terraform cannot do). In the Azure portal open the Static Web App, choose **Custom domains**, select the apex, then **Set default**. Refresh the table: the apex is marked as the default. From now on Azure redirects the other addresses, `www` and the `azurestaticapps.net` address, to the apex.

7. **Check it worked.** All five must hold.
   - **The apex serves over HTTPS** with a valid certificate (`curl.exe` fails on a bad one):

     ```powershell
     curl.exe -sI https://louislawson.co.uk/ | Select-String '^(HTTP/|strict-transport)'
     ```

     It prints `HTTP/... 200` and the `strict-transport-security` header.

   - **`www` redirects to the apex:**

     ```powershell
     curl.exe -sI https://www.louislawson.co.uk/ | Select-String '^(HTTP/|location)'
     ```

     It prints a `301` (or another redirect status) and `location: https://louislawson.co.uk/`.

   - **The `azurestaticapps.net` address redirects to the apex:**

     ```powershell
     curl.exe -sI https://<default-host>/ | Select-String '^(HTTP/|location)'
     ```

     It prints the same redirect, to `https://louislawson.co.uk/`.

   - **The production Live check passes.** It follows that one redirect, and only to the site's own origin. Run the steps in [The Live check](#the-live-check) with `--url https://<default-host>`, and then look at the next production deploy's **Live check** job, which is the same check.
   - **A preview still serves itself.** Take any open preview address ([section 5](#get-and-check-a-preview)):

     ```powershell
     curl.exe -sI https://<preview-host>/ | Select-String '^(HTTP/|location|x-robots-tag)'
     ```

     It must print `200` and `x-robots-tag: noindex`, with no `location` line. **If a preview redirects, stop:** its Live check would fail, and a preview must never send visitors to the real site. In the portal, under **Custom domains**, select the apex and choose **Unset default**; refresh and confirm no domain is marked as the default. Then ask before trying again.

## 7. The launch checklist

The domain is connected before the launch switch is flipped. Otherwise production would become indexable on a host whose canonical points at a domain that does not answer yet. Do these in order, and merge each pull request, with its production deploy finished, before starting the next.

1. **Real content.** Photos ([section 3](#3-adding-a-garage-photo-safely)), the web-safe CV ([section 4](#4-the-cv-pdf)), and the rest ([section 1](#1-editing-content)).

   **Check it worked.** `npm run placeholders` lists nothing from the required set in [section 2](#2-placeholders), and `npm run metadata:check` ends with `none carry personal metadata`.

2. **Connect the domain** ([section 6](#6-connecting-the-custom-domain)), all of it, including its final check.
3. **Flip the launch switch.** In [`src/config/site.ts`](../src/config/site.ts) change `const LAUNCH = false;` to `true`. A build now fails until the launch gate is open ([section 2](#2-placeholders)), so the pull request cannot merge with content missing. This pull request changes the site, so it gets a preview: check the preview first, then merge.

   **Check it worked.** Before merging, the preview still sends `noindex`, as every preview must (`curl.exe -sI https://<preview-host>/ | Select-String 'x-robots-tag'`). After the production deploy:

   ```powershell
   curl.exe -sI https://louislawson.co.uk/ | Select-String '^(HTTP/|x-robots-tag)'
   ```

   prints only the status line, with no `x-robots-tag`. Then:

   ```powershell
   curl.exe -s https://louislawson.co.uk/robots.txt
   curl.exe -sI https://louislawson.co.uk/sitemap-index.xml | Select-String '^HTTP/'
   $page = curl.exe -s https://louislawson.co.uk/
   [regex]::Matches($page, '<link[^>]*canonical[^>]*>|<meta[^>]*(?:og:url|og:image")[^>]*>|<meta[^>]*name="robots"[^>]*>') | ForEach-Object Value
   ```

   `robots.txt` reads `Allow: /` and ends with a `Sitemap:` line, the sitemap answers `200`, the canonical and `og:` addresses start with `https://louislawson.co.uk`, and no `robots` meta tag is printed. Before launch the same commands show `Disallow: /`, a `404` sitemap and a `noindex` meta tag. Last, load the site once in a browser and confirm that the visit appears in Cloudflare Web Analytics (it counts only once the domain is connected, because it matches host names by suffix).

4. **Set R04 to `in-service`.** In [`src/content/projects/this-website.md`](../src/content/projects/this-website.md) change `status: commissioning` to `status: in-service`.

   **Check it worked.** `npm run build` passes, and the project's page on the production site shows the new status after the deploy.

5. **HSTS: add `includeSubDomains`,** and leave `preload` out, because it is hard to undo. In [`public/staticwebapp.config.json`](../public/staticwebapp.config.json) change the `Strict-Transport-Security` value to `max-age=31536000; includeSubDomains`. Every subdomain of the domain, mail-related ones included, must answer over HTTPS before browsers see this, because they will then refuse plain HTTP for all of them.

   **Check it worked.** After the deploy, `curl.exe -sI https://louislawson.co.uk/ | Select-String 'strict-transport'` prints both parts, and the deploy's Live check is green.

6. **Optional: Google Search Console.** It needs Louis's own Google account. Add the domain as a property, verify it with the `TXT` record the console gives you (at the DNS provider, as in [section 6](#6-connecting-the-custom-domain), step 5), then submit `https://louislawson.co.uk/sitemap-index.xml`.

   **Check it worked.** The console reports the sitemap as read.

`SITE_URL` already defaults to the domain, so set the `SITE_URL` repository variable only if the site's address ever differs. `gh variable list` shows whether one is set.

## 8. When something goes wrong

### A Live check fails

1. Find the failed run and read its log:

   ```powershell
   gh run list --workflow deploy.yml --limit 5
   gh run view <run-id> --log-failed
   ```

   The Live check retries for about a minute after a deploy, so a failure in the log is one that lasted.

2. Read the lines that start `not yet:` and the `expected:` and `received:` lines under them. They name what differs: the content security policy, HSTS, the robots header, the 404 for a made-up path, or a redirect.
   - **A header differs.** The deployed site is not the build that was uploaded, or [`public/staticwebapp.config.json`](../public/staticwebapp.config.json) and the build disagree. Compare with step 3.
   - **A redirect to somewhere other than the site's own origin.** The site's origin is read from the build's canonical link. Check that the `SITE_URL` repository variable (`gh variable list`, empty by default) matches the domain that is the default in Azure.
   - **A preview redirects.** Stop: unset the default domain, as in [section 6](#6-connecting-the-custom-domain), step 7.

3. Reproduce it from your machine with the production steps in [The Live check](#the-live-check). A failing run looks like this (here a build that expects a different policy):

   ```text
   checking https://<default-host> as a production deploy
     not yet: Content-Security-Policy is not the one the build generated
     expected: default-src 'none'; base-uri 'self'; ...
     received: default-src 'self'; base-uri 'self'; ...
   ```

4. Fix the cause in a pull request. If the cause was a blip, re-run the failed jobs with `gh run rerun <run-id> --failed`.
5. **Check it worked.** `gh run view <run-id>` lists **Live check** as successful, or the next production deploy's does.

### A fourth preview fails to upload

1. Confirm the cause: the **Deploy** job's upload step failed on a pull request while three previews exist. List them as in [section 5](#stay-inside-the-3-preview-limit).
2. Merge or close a pull request you are done with. If a preview is left for a pull request that is no longer open, remove it by hand (this deletes the preview, so check the number against `gh pr list --state all` first):

   ```powershell
   az staticwebapp environment delete --name stapp-louislawson-web-prod-weu --resource-group rg-louislawson-web-prod-weu --environment-name <pull-request-number>
   ```

3. Re-run the failed deploy: `gh run rerun <run-id> --failed`.
4. **Check it worked.** The re-run is green, the pull request's sticky comment shows its preview address, and the environment list shows at most 3 previews.

### A test flakes on Windows

1. Recognise the flake: a full `npm test` run fails with `EPERM` or `ENOENT` on a rename in `node_modules\.vite`, in the build tests. They build the site in parallel, and Windows can lock a folder one of them is renaming.
2. Run the file that failed on its own, for example:

   ```powershell
   npx vitest run src/build.test.ts
   ```

3. A file that passes on its own, and a second full `npm test` that passes, was a flake. A failure that repeats is a real failure: read its message, and do not retry it until it passes.
4. **Check it worked.** `npm test` ends with every test file passed.

### CodeQL reports alerts on test code

CodeQL's config leaves out `**/*.test.ts`, `e2e/` and `src/__tests__/` ([Security](../README.md#security) in the README), so an alert on those paths is not expected.

1. List the open CodeQL alerts with their files:

   ```powershell
   gh api "repos/louislawson/louislawson.co.uk/code-scanning/alerts?state=open&tool_name=CodeQL&per_page=100" --jq '.[] | "\(.number)  \(.rule.id)  \(.most_recent_instance.location.path)"'
   ```

   Nothing printed means none are open.

2. For each alert, look at its path. One outside the ignored paths is a real finding: fix it in a pull request.
3. One on an ignored path is left over from before the config, or from a run of GitHub's default setup (which must stay off: see the README). It normally closes by itself on the next CodeQL run of `main`, which happens on every push and every Wednesday. If it is still open after that, dismissing it is a change to the repository's security records, so it is Louis's decision, made in the **Security** tab under **Code scanning**.
4. **Check it worked.** The command in step 1 prints nothing, or only alerts you have decided to keep.

### The Scorecard score drops

1. Read the current score and the checks below 10:

   ```powershell
   $r = Invoke-RestMethod https://api.scorecard.dev/projects/github.com/louislawson/louislawson.co.uk
   "Score: $($r.score)"
   $r.checks | Where-Object { $_.score -lt 10 } | Sort-Object score | Select-Object name, score | Format-Table -AutoSize
   ```

2. Compare with the checks the README says stay low on purpose ([Security](../README.md#security)). A check on that list is not a problem.
3. For any other check that fell, read its alert. The message says what Scorecard found; change `.most_recent_instance.message.text` to `.rule.help` for its remediation advice:

   ```powershell
   gh api "repos/louislawson/louislawson.co.uk/code-scanning/alerts?state=open&tool_name=Scorecard&per_page=100" --jq '.[] | "\(.number)  \(.rule.id)"'
   gh api repos/louislawson/louislawson.co.uk/code-scanning/alerts/<number> --jq '.most_recent_instance.message.text'
   ```

4. Fix it in a pull request. The **Scorecard** workflow runs on every push to `main` and every Monday, and publishes the result.
5. **Check it worked.** After the next run, step 1 shows the score back up. The public API can take a day to catch up.
