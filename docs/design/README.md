# Design: how this site's look was reached

This folder holds the visual reference for louislawson.co.uk and the story of how it was chosen. The reference mock lives in [`mock/`](mock/). Open `mock/index.html` through any static server, for example `python -m http.server --directory docs/design/mock`.

**The mock is a reference, not production code.** Where it and the direction contract (`.impeccable/surfaces/src-pages-index-astro.md`) differ, the contract wins. All content in the mock is example content, not real claims, except the trace timings, which are measured in your browser.

## The brief

A personal site for a cloud, DevOps and Azure engineer, read by recruiters, potential clients and peers. Three rules shaped everything:

- **Grounded over impressive.** Nothing unverifiable; placeholders are visibly placeholders until real content replaces them.
- **Projects carry the story.** Work is written up as setup, change and result.
- **Private by default.** No employers named, work projects anonymised, location at region level.

Things that would make it feel wrong: too themed or gimmicky, too corporate, too busy, slow or heavy.

The design work used the [Impeccable](https://impeccable.style) skill for Claude: a product interview, then a dealt round of visual directions (so the first idea isn't automatically the one that ships), then mock-ups and iterations, with a written direction contract at the end.

## The route

1. **Wind Tunnel (light).** The first direction chosen from the dealt rounds: a light aerodynamics lab where live streamlines flow around the page's real elements and each project is a test run. It was fully specified and mocked, and kept as an option.
2. **Re-rolls through the vehicle world.** Several rounds explored directions steered toward a personal interest in cars, trucks and tractors (fleet livery, workshop manuals, county shows, oil and enamel signs, machine decals). They were fun but leaned too far into theme for a professional site.
3. **References.** A set of reference sites from Dribbble and Awwwards sharpened what "professional but interesting" meant: giant wordmarks, sites that show their own workings (an inspector lens, live performance metrics), hard numbers as display type, and a split between dark-technical and light-editorial.
4. **Two new directions alongside Wind Tunnel.** _Wordmark_ (light Swiss: a justified giant name, acid accent, results as display type) and _Console_ (dark terminal: monospace, a rotating ASCII wheel, an inspect mode that labels how each part is built). Console was preferred.
5. **Three Console iterations.** _Bolder_ (the same system at full strength), _Quieter_ (less volume, held motion), and _Trace_.
6. **Trace chosen (C3).** The hero shows how the page reached the visitor (DNS, connection, edge, the page itself, first paint) with timings measured in their browser. It turns "this person builds and runs real systems" from a claim into a demonstration.
7. **One thing tried and dropped.** A strip of live Core Web Vitals above the navigation. With the trace already on screen it made the page too busy, so it was removed and recorded as an anti-goal.

## What the final direction keeps

- **Dark, restrained palette:** graphite ground, bone text, one hi-vis orange accent, green only for live or in-service state.
- **Martian Mono throughout**, using its width and weight axes.
- **Structure from the terminal, not a costume of it:** prompts (`$ setup`, `> result`) organise content; there are no fake commands or typing effects.
- **Inspect mode** (press `i`): outlines each part of the page with how it's built and served.
- **Number keys 1–5** jump between sections.
- **The garage:** an ASCII-rendered wheel, and event photos shown as text characters with full colour on hover.
- **Status is shape plus word**, never colour alone. Motion stops for anyone who prefers reduced motion.

## Mock versus build

The mock renders most sections with JavaScript for speed of iteration. The real site renders them as static HTML at build time; only the trace, the wheel, the number keys and inspect mode need JavaScript. The mock loads Martian Mono from Google Fonts; the real site self-hosts it. Build number and commit in the trace are example values here; in production the deploy pipeline writes them.
