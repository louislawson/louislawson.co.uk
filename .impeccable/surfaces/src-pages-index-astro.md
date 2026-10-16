---
version: 1
slug: "src-pages-index-astro"
primary_target: "src/pages/index.astro"
related_targets: ["src/pages/projects/[slug].astro"]
---

# Surface brief: home page and project run sheets

Scope: `/` (long home page), `/projects/[slug]` (one run sheet per project), 404. Visitor mode: Experience; the work leads from the first viewport.

Audience and job: recruiters, prospective clients and peers (PRODUCT.md), often from LinkedIn/CV links or a shared link preview, often on phones. They need to see what Louis actually builds in cloud/DevOps/Azure, then contact him or read a project in depth.

Proof: projects as run sheets (setup, change, result). Work projects anonymised (descriptor, rounded or relative figures); personal/open-source projects named. Before/after measurements only when real. No employer named anywhere. The hero trace is proof by demonstration: real per-visit timings of the site's own delivery path.

Section order: first screen → Projects → Skills → Certifications and achievements → The garage → Contact → footer (updated date, built-with + repo link, one-line cookieless analytics note). No Experience section, no About section. Plain-language section names in lowercase terminal voice; first person throughout.

Projects: curated order, period shown on every entry; the featured run leads the list, tagged `featured` (it is not in the hero). ≤3 projects render as full run-sheet strips (`$ setup`, `$ change`, `> result`, read-the-run-sheet link); ≥4 switch to compact rows (code, title, short result, status, arrow). Whole entry links to its run sheet. Project page: setup/change/result panel, measurements as a before/after diff, tools, write-up, next project.

Skills: context-first rows (name, one-line anonymised context, tools, "seen in" run links); groups without public evidence still show, without links; ends with a quieter "what I'm exploring next" list (3–5 items, no links).

Garage: cars, trucks, tractors; the ASCII wheel figure introduces it; one event photo each, rendered as ASCII dither with full colour on hover/focus.

Anti-goals (user-confirmed "feels wrong"): too themed/gimmicky, too corporate, too busy, slow or heavy. No blog, contact form, cookie analytics, skill bars or per-skill durations, same-size card grids, galleries, or a live-metrics strip in the header (tried and rejected as too busy).

States: production needs intro (with career line), role line, ≥2 real projects, email, LinkedIn, CV; optional placeholders are hatched on previews and omitted on production; a section left empty disappears with its nav link and number key. 2–12 projects. Availability expires on its `until` date. Measurement diff hidden when empty. Trace steps without a measurement show an ellipsis, never a guess. Long titles wrap cleanly.

Delivery: dark only (supersedes the earlier light-only decision). Public repo; GitHub Actions to Azure Static Web Apps (Terraform, OIDC), PR previews; the deploy job writes the build number and commit shown in the trace. CI: secret scan, placeholder gate (warn on PRs, block production), PDF-metadata and photo-GPS checks, link check, HTML validation, axe scan. Site URL from config with `noindex` until the domain is connected (later). Per-page social preview images generated at build. Lighthouse mobile 95+.

## Direction contract

THESIS: A working console, not a portfolio template: the site shows its own workings. The hero traces the real path this page took to reach the visitor, with timings measured in their browser; inspect mode labels how every part is built and served. Refuses the costume terminal: no fake commands, no typing effects, nothing that slows reading.

OWN-WORLD: Dark, restrained. Ground #0D0E0C, panel #151713, lines #2B2E28 / #4A4E45, bone #E9E7E0 text, dim #A3A59B, one accent hi-vis #FF6B1A (actions, codes, focus, caret), ok #9BDC6E for live/in-service state only. Martian Mono variable throughout: body wdth 92, name 800 wdth 100, ASCII at wdth 75. Square status markers plus word; 1px lines, no radius, no shadows; prompts (`$`, `>`, `#`) as structure; authored 24px icons, 1.6 stroke. Placeholders: orange hatch with dashed outline.

STORY: Visitor sees an engineer's console, reads the role and career line, watches the trace prove the site is real infrastructure, scans projects, skills tied to evidence, certifications, the garage, then contacts.

FIRST VIEWPORT: Sticky nav: `louis.lawson`, five section links with number keys 1–5, `[i] inspect` toggle. Left: name huge on two lines with a hi-vis block caret, role, intro, career line, actions (see projects in hi-vis, get in touch). Right: trace panel "how this page reached you": you → dns → connect → edge → this page → painted, each with real timing and a proportional bar, total to paint, replay link, build/commit from CI. Phone: stacked, trace below the actions. No metrics strip above the nav.

FORM: Console, iteration C3 "Trace": user-pinned from references (Haruki, Hipuku, Vernier), chosen over Wind Tunnel (position 4 of my ordered list, seed key 3b5634fb). Signature interactions: the trace (hops arrive in order, 170ms stagger, bars fill to real proportions; replay on demand), inspect mode (outlines plus how-it's-built labels and a 12-column grid overlay), number-key navigation. Motion: trace replay, caret blink, garage wheel at 30fps pausing off-screen; reduced motion makes all of it still; no scroll entrances.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
