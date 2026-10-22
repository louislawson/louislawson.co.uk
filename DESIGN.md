---
name: louislawson.co.uk
description: A working console. A dark, square, monospaced site that shows its own workings, with one hi-vis orange for action.
colors:
  ground: "#0d0e0c"
  panel: "#151713"
  line: "#2b2e28"
  line-strong: "#4a4e45"
  bone: "#e9e7e0"
  dim: "#a3a59b"
  hivis: "#ff6b1a"
  in-service: "#9bdc6e"
typography:
  display:
    fontFamily: "Martian Mono Variable, ui-monospace, monospace"
    fontSize: "min(clamp(2.9rem, 1rem + 7vw, 7.4rem), 18vw)"
    fontWeight: 800
    lineHeight: 0.92
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "Martian Mono Variable, ui-monospace, monospace"
    fontSize: "clamp(2rem, 1.2rem + 3.2vw, 4.4rem)"
    fontWeight: 750
    lineHeight: 1.1
    letterSpacing: "-0.04em"
  title:
    fontFamily: "Martian Mono Variable, ui-monospace, monospace"
    fontSize: "clamp(1.25rem, 1rem + 1vw, 1.9rem)"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Martian Mono Variable, ui-monospace, monospace"
    fontSize: "clamp(0.9rem, 0.86rem + 0.15vw, 0.98rem)"
    fontWeight: 400
    lineHeight: 1.65
  label:
    fontFamily: "Martian Mono Variable, ui-monospace, monospace"
    fontSize: "0.8rem"
    fontWeight: 400
    lineHeight: 1.65
rounded:
  none: "0px"
spacing:
  gutter: "clamp(16px, 3.2vw, 44px)"
  col-gap: "clamp(16px, 2vw, 32px)"
  section: "clamp(4.5rem, 3rem + 6vw, 9rem)"
  action-height: "48px"
components:
  button-primary:
    backgroundColor: "{colors.hivis}"
    textColor: "{colors.ground}"
    rounded: "{rounded.none}"
    padding: "0 18px"
    height: "48px"
  button-primary-hover:
    backgroundColor: "color-mix(in srgb, #ff6b1a 80%, white)"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.bone}"
    rounded: "{rounded.none}"
    padding: "0 18px"
    height: "48px"
  button-unavailable:
    textColor: "{colors.dim}"
    rounded: "{rounded.none}"
    padding: "0 18px"
    height: "48px"
  tag:
    textColor: "{colors.hivis}"
    rounded: "{rounded.none}"
    padding: "0 7px"
  panel:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.bone}"
    rounded: "{rounded.none}"
    padding: "12px 16px"
  nav-link:
    textColor: "{colors.dim}"
    rounded: "{rounded.none}"
    padding: "6px 10px"
  nav-link-active:
    textColor: "{colors.bone}"
---

<!-- markdownlint-disable MD024 MD025 MD036 -->
<!-- The section names repeat and the north-star line is bold by the DESIGN.md format; MD025 reads the front matter's typography "title" key as a second H1. -->

# Design System: louislawson.co.uk

## Overview

**Creative North Star: "The Working Console"**

The site is an engineer's console that shows its own workings. The hero traces the real path the page took to reach the visitor, inspect mode labels how each part is built, and number keys move between sections. Everything is dark, square and set in one monospaced face, so structure comes from lines and prompts (`$`, `>`, `#`) rather than boxes, color or ornament. The one loud color, hi-vis orange, is reserved for things that can be acted on or that mark where you are.

Density is calm: wide section spacing, long runs of dim secondary text, and a 12-column grid that inspect mode can draw over the page. The console is real, not costume. There are no fake commands, no typing effects, and nothing that slows reading. Motion is short and functional (trace replay, a blinking caret, the garage wheel) and all of it stands still under reduced motion.

**Key Characteristics:**

- Dark only. Ground, panel and two line weights carry all depth.
- One typeface, Martian Mono Variable, with width as a second axis (92% body, 100% headings, 75% ASCII art).
- One accent. Hi-vis orange for actions, codes, focus, the caret and the placeholder device.
- Square everything: 1px lines, no radius, no shadows.
- Prompts and square status markers as structure; authored 24px icons at 1.6 stroke.

## Colors

A near-black, slightly green-warm ground with bone-white text, and a single hi-vis orange. Green appears only for something live.

### Primary

- **Hi-Vis Orange** (`hivis`): the only accent. Primary action fill, project codes, section counts, `$`/`>`/`#` prompts, number-key hints, the focus ring, the caret, text selection, the tag outline, and the placeholder hatch.

### Secondary

- **In-Service Green** (`in-service`): live or in-service state only: the "in service" status, the measured-in-your-browser marker and the small square beside a measured timing.

### Neutral

- **Console Ground** (`ground`): the page background, and the text color on hi-vis fills.
- **Panel** (`panel`): raised surfaces such as the trace panel, garage cards and the wheel figure, and the hover wash on a project row.
- **Hairline** (`line`): quiet dividers, panel borders and the track of trace bars.
- **Strong Line** (`line-strong`): section-head rules, button and control borders, link underlines, trace connectors.
- **Bone** (`bone`): primary text and the default control color.
- **Dim** (`dim`): secondary text, meta lines, inactive nav links, labels.

### Named Rules

**The One Hi-Vis Rule.** Hi-vis orange marks an action, a code, a prompt, focus or the placeholder device. One hi-vis action fill per screen. It is never a background wash or decoration.

**The Live Green Rule.** Green means live or in service. It is never a brand color, a success flourish or a decorative accent.

## Typography

**Display, body and label font:** Martian Mono Variable (with `ui-monospace, monospace`). It is the only face, loaded from the `@fontsource-variable` package.

**Character:** A wide, technical monospace used at three widths. Size and weight carry hierarchy, so there is no second family. Headings are tight (negative tracking) and body is open (1.65 leading).

### Hierarchy

- **Display** (800, `min(clamp(2.9rem, 1rem + 7vw, 7.4rem), 18vw)`, 0.92, -0.04em, width 100%): the name in the hero only.
- **Headline** (750, `clamp(2rem, 1.2rem + 3.2vw, 4.4rem)`, 1.1, -0.04em, width 100%): section names, in lowercase, with a small hi-vis count.
- **Title** (700, `clamp(1.25rem, 1rem + 1vw, 1.9rem)`, -0.02em): a project's title in a run-sheet strip; compact rows use `clamp(1rem, 0.95rem + 0.4vw, 1.2rem)`.
- **Body** (400, `clamp(0.9rem, 0.86rem + 0.15vw, 0.98rem)`, 1.65, width 92%, tabular numerals): all running text. Intro text is capped at 56ch.
- **Label** (400, 0.75 to 0.82rem): trace captions, tags, footers and meta lines, usually in `dim`.

### Named Rules

**The Prompt Is Structure Rule.** Prompts (`$ setup`, `> result`, `# heading`) are drawn in hi-vis by CSS and are decoration for the eye; they get an empty alt text so screen readers read the word alone.

**The Lowercase Voice Rule.** Section names, nav labels, action labels and garage names are lowercase. The case is applied by the style or the copy, never by capitalizing in code.

## Layout

A 12-column grid inside a centred wrapper (max 1520px) with fluid side gutters (`gutter`) and column gaps (`col-gap`). The hero puts the name and copy on columns 1 to 7 and the trace panel on 8 to 12; section heads put the title on 1 to 7 and a one-line intro on 8 to 12; project-page sections put the heading on 1 to 3 and content on 4 to 12. Sections are separated by one large fluid step (`section`, 4.5rem to 9rem) with no boxes between them. Inside components the rhythm is small: 10 to 18px for control gaps, 1 to 2rem for content blocks.

Responsive behavior collapses to a single column at 960px (hero), 900px (nav links fold into a menu, garage stacks) and 860px or 760px (section heads, run sheets, rows). The sticky nav bar scrolls away on windows 500px tall or less. Every action and control is at least 40px tall (44px on coarse pointers), and primary actions 48px.

## Elevation & Depth

Flat. Depth is conveyed by tonal layering (ground, then panel) and by 1px borders. There are no box shadows or radii anywhere in the build. State changes are border brightening, color change or a small marker, not lift.

### Named Rules

**The No-Shadow Rule.** Surfaces never lift. Use `panel` against `ground` and a 1px `line` or `line-strong` border.

## Shapes

Square. Every control, panel, tag, node and marker has 0 radius and a 1px border (status markers 2px, trace bars 3px tall). Form language is the rule, the box and the leader: dotted leaders (`1px dotted`) join a title to its status. Square 6 to 11px nodes and markers stand in for dots and icons. Dashed outlines mean "not there yet" or "inspected".

## Components

### Buttons

- **Shape:** square, 1px border, 48px minimum height, 18px side padding, a 10px gap to a 16px arrow icon that nudges 3px right on hover.
- **Primary:** hi-vis fill, ground-colored bold text; hover lightens the fill (80% hi-vis mixed with white). One per screen.
- **Secondary:** transparent, bone text, `line-strong` border that brightens to bone on hover.
- **Unavailable:** an action that does not exist yet is dim, with a dashed hi-vis border, not-allowed cursor and no link.
- **Focus:** the global 2px hi-vis outline with a 3px offset.

### Tags and status

- **Tag:** hi-vis text with a 1px hi-vis border, 7px padding, small text. Used for "featured".
- **Status:** an 8px square marker plus the word. In service is green and filled; commissioning is hi-vis and hollow; complete is bone and filled; archived is dim and hollow. Every marker carries a border so it survives forced-colors modes.

### Navigation

A sticky bar with a `line` bottom border on a ground background at 94% opacity: the brand `louis.lawson` (the dot in hi-vis), section links in `dim` that take a `line-strong` border when hovered or current, optional hi-vis number-key hints, and an `inspect` toggle that fills hi-vis when on. Under 900px the links fold into a menu button and a full-width dropdown.

### Trace panel

The signature component. A `panel` figure with a 1px border: a header (title in bone, total in hi-vis), a list of hops with a node (hollow square, filled bone for "you", filled hi-vis for "this page"), a name, a timing, a description and a 3px proportional bar, and a foot with a measured-in-browser marker, the build label and an underlined replay link. Hops arrive in order with a short stagger.

### Run sheets and rows

Projects are strips (three or fewer: code, title, dotted leader, tag, status, then `$ setup`, `$ change` and `> result` columns) or compact rows (four or more: code, title, headline, status, arrow). The whole entry is one link; hover or keyboard focus turns the strip's title hi-vis, or washes a row in `panel` and slides a hi-vis square into the gutter.

### Garage cards

A `panel` card with a 1px border: a 4:3 ASCII dither photo (width 75%) that is replaced by the full-colour photo on hover or focus, then a bold lowercase name, a note and a dim caption. An ASCII wheel figure introduces the section.

### Placeholder device

A value not yet supplied is drawn with a hi-vis hatch (16% orange diagonal stripes at 10px period) and a 1px dashed hi-vis outline. It is the world's own marker for "not there yet" and is hidden or omitted on production.

### Raster provenance

The only rasters the site ships are the social cards, which the code generates at build, and Louis's photos, whose metadata is stripped and checked in CI. Everything else is text, CSS or authored SVG.

### Inspect mode

Toggled with `i`. Outlines each labelled part with a 1px dashed hi-vis line, adds a hi-vis label chip (bold 11px) and draws the 12-column grid at 6% hi-vis.

## Do's and Don'ts

### Do

- **Do** use only the eight palette tokens; hi-vis for actions and structure, green for live state.
- **Do** build with 0 radius, 1px lines and `panel` against `ground`.
- **Do** set everything in Martian Mono at the widths already used: 92% body, 100% headings, 75% ASCII.
- **Do** make every action at least 48px tall (controls in the bar at least 40px, and 44px on coarse pointers) and keep the global hi-vis focus ring.
- **Do** mark an unsupplied value with the hatch and dashed outline, and give status a square marker plus the word.
- **Do** keep motion short and tied to function, and let it stand still under `prefers-reduced-motion`.

### Don't

- **Don't** add shadows, rounded corners or a second accent color.
- **Don't** use green for anything that is not live or in service.
- **Don't** use a second typeface or a decorative display face.
- **Don't** add typing effects, fake commands, skill bars or scroll entrances.
- **Don't** fill a surface with hi-vis beyond the single primary action and the pressed inspect toggle.
