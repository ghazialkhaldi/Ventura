---
name: Ventura
description: Spend review for month-end close. A light, hairline-ruled interface where every finding is traced to its rows and a person decides.
colors:
  accent-50: "#eef2ff"
  accent-100: "#e0e7ff"
  accent-200: "#c3d0ff"
  accent-300: "#9cb0fd"
  accent-400: "#7189f6"
  accent-500: "#4a67ee"
  accent-600: "#3550dc"
  accent-700: "#2a40b8"
  accent-800: "#263793"
  surface: "#f7f8fa"
  surface-raised: "#ffffff"
  surface-overlay: "#f2f4f7"
  surface-hover: "#eef1f5"
  surface-sunken: "#eceff3"
  border: "#e2e6ec"
  border-subtle: "#edf0f4"
  border-strong: "#cbd2dc"
  text-primary: "#0f1524"
  text-secondary: "#465062"
  text-muted: "#636e82"
  sidebar-bg: "#f4f6f9"
  sidebar-hover: "#eaedf2"
  sidebar-active: "#e2e7f0"
  sidebar-text: "#2f3747"
  field: "#2440d6"
  field-deep: "#1b32b8"
  field-muted: "#c7d1ff"
  ink: "#0c111d"
  ink-raised: "#151b2a"
  ink-line: "#252d3f"
  ink-text: "#e9edf5"
  ink-muted: "#9aa4b8"
  critical: "#d92d20"
  critical-fg: "#b42318"
  critical-bg: "#fef3f2"
  critical-line: "#fecdca"
  high: "#ef6820"
  high-fg: "#b93815"
  high-bg: "#fef6ee"
  high-line: "#f9dbaf"
  medium: "#eaaa08"
  medium-fg: "#915e00"
  medium-bg: "#fffaeb"
  medium-line: "#fedf89"
  low: "#98a2b3"
  low-fg: "#475467"
  low-bg: "#f2f4f7"
  positive: "#17b26a"
  positive-fg: "#067647"
  positive-bg: "#ecfdf3"
  positive-line: "#abefc6"
  chart-series-1: "#2a78d6"
  chart-series-2: "#0e9468"
typography:
  display:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "4rem"
    fontWeight: 500
    lineHeight: 1.03
    letterSpacing: "-0.035em"
    fontVariation: '"wdth" 112'
  headline:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "3rem"
    fontWeight: 500
    lineHeight: 1.06
    letterSpacing: "-0.03em"
    fontVariation: '"wdth" 112'
  title:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "2.5rem"
    fontWeight: 500
    lineHeight: 1.08
    letterSpacing: "-0.03em"
    fontVariation: '"wdth" 112'
  title-compact:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 500
    lineHeight: 1.1
    letterSpacing: "-0.025em"
    fontVariation: '"wdth" 112'
  heading:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  app-title:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 500
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  body-lead:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 400
    lineHeight: 1.6
  body:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.7
  body-app:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: '"kern" 1, "liga" 1'
  ui:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13.5px"
    fontWeight: 500
    lineHeight: 1.25
  label:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.4
  caption:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1
  mono:
    fontFamily: "JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.4
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
  xl: "10px"
  "2xl": "14px"
  full: "9999px"
spacing:
  gutter: "20px"
  gutter-wide: "32px"
  section-compact: "64px"
  section: "96px"
  section-wide: "128px"
  card: "24px"
  card-sm: "16px"
components:
  button-primary:
    backgroundColor: "{colors.accent-600}"
    textColor: "{colors.surface-raised}"
    typography: "{typography.ui}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "36px"
  button-primary-hover:
    backgroundColor: "{colors.accent-700}"
  button-cta:
    backgroundColor: "{colors.accent-600}"
    textColor: "{colors.surface-raised}"
    rounded: "{rounded.md}"
    padding: "0 20px"
    height: "44px"
  button-cta-hover:
    backgroundColor: "{colors.accent-700}"
  button-secondary:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.text-primary}"
    typography: "{typography.ui}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "36px"
  button-secondary-hover:
    backgroundColor: "{colors.surface-overlay}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text-secondary}"
    typography: "{typography.ui}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "36px"
  button-ghost-hover:
    backgroundColor: "{colors.surface-overlay}"
    textColor: "{colors.text-primary}"
  input:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "40px"
  chip-severity-critical:
    backgroundColor: "{colors.critical-bg}"
    textColor: "{colors.critical-fg}"
    typography: "{typography.caption}"
    rounded: "{rounded.sm}"
    padding: "0 8px"
    height: "22px"
  chip-severity-high:
    backgroundColor: "{colors.high-bg}"
    textColor: "{colors.high-fg}"
    typography: "{typography.caption}"
    rounded: "{rounded.sm}"
    padding: "0 8px"
    height: "22px"
  chip-severity-medium:
    backgroundColor: "{colors.medium-bg}"
    textColor: "{colors.medium-fg}"
    typography: "{typography.caption}"
    rounded: "{rounded.sm}"
    padding: "0 8px"
    height: "22px"
  chip-severity-low:
    backgroundColor: "{colors.surface-overlay}"
    textColor: "{colors.text-muted}"
    typography: "{typography.caption}"
    rounded: "{rounded.sm}"
    padding: "0 8px"
    height: "22px"
  chip-status-open:
    backgroundColor: "{colors.accent-50}"
    textColor: "{colors.accent-700}"
    typography: "{typography.caption}"
    rounded: "{rounded.sm}"
    padding: "0 6px"
    height: "20px"
  chip-status-resolved:
    backgroundColor: "{colors.positive-bg}"
    textColor: "{colors.positive-fg}"
    typography: "{typography.caption}"
    rounded: "{rounded.sm}"
    padding: "0 6px"
    height: "20px"
  chip-status-dismissed:
    backgroundColor: "{colors.surface-overlay}"
    textColor: "{colors.text-muted}"
    typography: "{typography.caption}"
    rounded: "{rounded.sm}"
    padding: "0 6px"
    height: "20px"
  card:
    backgroundColor: "{colors.surface-raised}"
    rounded: "{rounded.xl}"
    padding: "{spacing.card}"
  product-frame:
    backgroundColor: "{colors.surface-raised}"
    rounded: "{rounded.xl}"
  nav-item:
    textColor: "{colors.sidebar-text}"
    typography: "{typography.ui}"
    rounded: "{rounded.md}"
    padding: "0 8px"
    height: "32px"
  nav-item-hover:
    backgroundColor: "{colors.sidebar-hover}"
    textColor: "{colors.text-primary}"
  nav-item-active:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.text-primary}"
  ink-band:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.ink-text}"
    padding: "128px 32px"
---

# Design System: Ventura

## Overview

**Creative North Star: "The Clean Ledger"**

Ventura looks like a well-kept ledger laid on a field of ultramarine: every marketing page opens on that one saturated blue, with white type and the product lifted over its edge, and the working pages beneath stay cool paper, hairline rules and figures that line up in columns. It is the category standard with real colour conviction, held to the craft bar of Linear and Mercury. The interface itself is the proof, so marketing pages lead with the real product at work on labelled example data rather than abstract charts or illustration. Nothing glows, nothing is tilted, and no surface competes with the evidence.

Density follows the reader. Marketing pages are generous and quiet: a left-aligned semi-expanded headline, a short subline, then wide product frames and hairline lists with long vertical rhythm. The signed-in app is compact and calm: a 14px base, 32px navigation rows, 36px buttons, white cards on a faintly blue-grey canvas. Colour carries meaning, never mood. Ultramarine means "you can act here". The severity hues mean "this finding needs attention". Everything else is cool neutral.

The system refuses the generic AI-startup register (gradients, glow, "AI-powered" sparkle) and anything playful. Depth comes from hairlines and tonal steps first, with soft ink-tinted shadows reserved for raised product frames and floating layers. Motion is one authored entrance and quick, quiet state changes.

**Key Characteristics:**
- An ultramarine field owns whole regions on marketing pages: the hero and page intros, the logo strip, and the closing band. Everything else is a light, cool canvas.
- The home hero is a pinned scroll story, "scroll to scan". The example file's 1,431 transactions are a 53 × 27 grid shaded by amount. Over about three screens of scroll, the scan line travels the register and five flagged rows ignite with labels; the view zooms into the duplicate payment, which opens into its finding card; the card is resolved and an audit-trail line appears. Progress eases toward the scroll position (scrub with inertia). Phones pin only the stage, and reduced motion shows the finished scan and the resolved finding, unpinned.
- Brand logos are official marks only (simple-icons), in white on the field; wordmarks stand alone, symbol marks carry their name. No invented lettered badges.
- UI icons are Radix Icons, the 15px set. They appear only where they do a job (navigation, controls, status), never as bullets or decoration.
- One ultramarine accent, reserved for actions, links, focus and selection.
- Archivo throughout; display sizes run semi-expanded on the font's width axis to echo the extended wordmark.
- Hairline lists and ruled tables in place of grids of identical cards.
- Product visuals are the real components on labelled example data.
- Two weights (400 and 500), sentence case everywhere, tabular figures for every amount.
- One deep-ink band per marketing page, carrying the "a person decides" story.

## Colors

A cool, low-chroma neutral system with a single saturated ultramarine for action and a strictly scoped set of severity hues for findings.

### Primary
- **Ledger Ultramarine** (#3550dc, `accent-600`): primary buttons, the header CTA, the selected nav icon and the "Mark resolved" decision. White on it measures 6.3:1. Hover deepens to **Pressed Ultramarine** (#2a40b8, `accent-700`), which is also the text colour for inline links (8.3:1 on white).
- **Focus Ultramarine** (#4a67ee, `accent-500`): the 2px focus ring on every interactive element, offset 2px from the white surface, and the Open status dot.
- **Selection Wash** (#eef2ff, `accent-50`) with **Selection Edge** (#c3d0ff, `accent-200`): the selected row in the findings inbox, the Open status chip, and text selection (at 70%). Link underlines rest at `accent-200` and darken to `accent-400` on hover.
- **Monogram Tint** (#e0e7ff, `accent-100`) with `accent-800` text: user initials in the top bar and sidebar.

### Neutral
- **Cool Paper** (#f7f8fa, `surface`): the app canvas, muted marketing sections, the lower band of the home hero, table header rows and the closing CTA panel.
- **White Sheet** (#ffffff, `surface-raised`): cards, product frames, the public site background, inputs and secondary buttons.
- **Overlay Grey** (#f2f4f7, `surface-overlay`): hover fill for ghost controls and nav links, neutral chips (Low, Dismissed, counts), the search field at rest.
- **Hover Grey** (#eef1f5, `surface-hover`) and **Sunken Grey** (#eceff3, `surface-sunken`): table row hover and recessed wells.
- **Hairline** (#e2e6ec, `border`): the default 1px rule for cards, frames, list rows and dividers. **Faint Hairline** (#edf0f4, `border-subtle`) separates rows inside a container and section bands. **Firm Hairline** (#cbd2dc, `border-strong`) outlines inputs and secondary buttons and draws the context bars in charts.
- **Ledger Ink** (#0f1524, `text-primary`): headings, body emphasis, figures (18.2:1 on white). **Graphite** (#465062, `text-secondary`): body copy and sublines (8.1:1). **Slate Note** (#636e82, `text-muted`): metadata, captions, placeholders, axis labels (5.1:1 on white, 4.8:1 on Cool Paper).
- **Sidebar Mist** (#f4f6f9, `sidebar-bg`) with **Sidebar Graphite** (#2f3747, `sidebar-text`): the app sidebar is a half-step cooler than the canvas.

### Field
- **Ultramarine Field** (#2440d6, `field`): whole regions on marketing pages: the hero and every page intro (the header (64px on phones, 80px on desktop) takes on whichever surface is beneath it; field regions mark themselves with `data-field`), the systems logo strip, and the full-width closing band. White type on it measures 7.6:1. **Field Mist** (#c7d1ff, `field-muted`) is secondary text on the field (4.9:1). On the field, the primary action inverts: a white button with `accent-800` text.
- **Field Deep** (#1b32b8, `field-deep`): reserved for pressed or recessed states on the field.
- **Hero depth**: the home hero's field is never flat. Soft white light comes in from both edges (radial, 20–24% at the core), and the grid's cell, blown up to 18–176px and set as 6–10% fills or 18–36% hairline outlines, sits in the side margins. Each layer drifts and turns at its own rate with the scroll story. The shapes are placed by their gap from the content column, so they slide off the edge as margins narrow, and they are hidden below 1024px, where only the light remains.

### Ink
- **Deep Ink** (#0c111d, `ink`): the single dark band on marketing pages, the login brand panel, the workspace monogram tile, and the modal and drawer scrim at 30%.
- **Raised Ink** (#151b2a, `ink-raised`) with **Ink Rule** (#252d3f, `ink-line`): panels and hairlines inside the dark band (the audit trail).
- **Ink Paper** (#e9edf5, `ink-text`) and **Ink Note** (#9aa4b8, `ink-muted`): text on ink (16.1:1 and 7.5:1). Headings on ink are pure white.

### Severity and outcome
Each family has four roles: a solid mark (dots, chart marks), a dark `-fg` for text (all at least 5.3:1 on their own `-bg`), a pale `-bg` fill, and a `-line` border or ring.
- **Critical Red** (#d92d20 / #b42318 / #fef3f2 / #fecdca): critical findings.
- **High Orange** (#ef6820 / #b93815 / #fef6ee / #f9dbaf): high findings. Its `-bg` also tints flagged evidence rows, whatever the finding's severity, and its fill marks the flagged points in the approval-limit chart.
- **Medium Amber** (#eaaa08 / #915e00 / #fffaeb / #fedf89): medium findings, and the outlier bar in the vendor-baseline chart.
- **Low Slate** (#98a2b3 / #475467 / #f2f4f7): low findings and decided findings in the inbox (the dot turns slate once resolved or dismissed).
- **Outcome Green** (#17b26a / #067647 / #ecfdf3 / #abefc6): the Resolved status and the "logged" confirmation after a decision.

### Chart series
- **Azure** (#2a78d6, `chart-series-1`) and **Teal Green** (#0e9468, `chart-series-2`): a pair validated together against white for colour-vision separation and 3:1 contrast. Beyond two series, fold into "Other" or a table. Grid lines use the faint hairline, axes and ticks use Slate Note at 11px, context bars use the firm hairline, and tooltips are white with a hairline border, 8px radius and the pop shadow.

### Named Rules
**The One Ultramarine Rule.** Ultramarine marks what you can act on: buttons, links, focus, selection, and the Open status (an open finding is waiting for your action). It is never a chart series or a small decoration. Charts use Azure precisely so the accent stays unambiguous.

**The Field Rule.** The brand colour appears at scale or not at all: as the ultramarine field owning a whole region (hero, intro, closing band), or as an action. Never as a tint sprinkled across components. A marketing page opens on the field and closes on it; the app stays on paper.

**The Findings-Only Rule.** Red, orange, amber and slate belong to findings: severity chips and dots, flagged evidence rows, and the marks that show why a finding fired. Outcome green belongs to decisions. No other surface borrows these hues for emphasis.

**The Status Is Not Severity Rule.** Review status never reuses severity colour. Open wears the ultramarine tint, Resolved wears outcome green, Dismissed is neutral grey. An open Low finding must never read as red.

## Typography

**Display Font:** Archivo, semi-expanded on the `wdth` axis (with ui-sans-serif, system-ui)
**Body Font:** Archivo at normal width (with ui-sans-serif, system-ui)
**Label/Mono Font:** JetBrains Mono, weights 400 and 500 loaded (with ui-monospace, SFMono-Regular, Menlo)

**Character:** One grotesque family doing two jobs. Pushed to 112 on the width axis, Archivo becomes broad and assured, echoing the extended Ventura wordmark. At normal width it is a plain, legible workhorse for dense review screens. JetBrains Mono appears only where a string is machine-made.

### Hierarchy
- **Display** (500, 64px from 1024px, 52px from 640px, 38px below; line-height 1.03; tracking -0.035em; width 112): the home hero headline only, capped at 21ch.
- **Headline** (500, 48px from 640px, 36px below; line-height 1.06; tracking -0.03em; width 112): the H1 on every other marketing page and the error pages, capped at about 22ch. Auth pages use the same face a size down: 28 to 32px, line-height 1.08 to 1.1, tracking -0.025em.
- **Title** (500, 40px from 640px, 30px below; line-height 1.08; tracking -0.03em; width 112): section headings on the home page.
- **Title compact** (500, 36px from 640px, 28px below; line-height 1.1; tracking -0.025em; width 112): section headings on inner marketing pages, the demo and the closing call to action.
- **Heading** (500, 24px, line-height 1.2, tracking -0.02em, normal width): sub-sections inside a marketing section, beside a figure.
- **App title** (500, 22px, tracking -0.02em, normal width): page titles in the signed-in app. A finding's own title in the product frame runs at 20px, tracking -0.015em.
- **Body lead** (400, 17 to 18px, line-height 1.6): the subline under a marketing headline, capped at 36 to 40rem.
- **Body** (400, 15.5 to 16px, line-height 1.65 to 1.7): marketing paragraphs and list bodies, capped at 62ch. Long legal and reference prose runs 16px at 1.75 in a 44rem column.
- **Body app** (400, 14px, line-height 1.5): the document default and the app's working size.
- **UI** (500, 13.5px): buttons, sidebar items, search, top-bar controls.
- **Label** (500 or 400, 12 to 13px, normal tracking): field labels, table headers, card subtitles, metadata. Muted colour does the work that capitals and letter-spacing do elsewhere.
- **Caption** (500, 12px, line-height 1): chips and count pills.
- **Mono** (400, 12px): finding IDs, invite and one-time codes, event and resource names, canonical field keys.

### Named Rules
**The Width Is the Voice Rule.** Only marketing, auth and error headlines take the semi-expanded width. Everything inside the product, including app page titles, stays at normal width.

**The Two Weights Rule.** Regular (400) reads and medium (500) leads. Headlines are medium, never bold. Semibold (600) is allowed only at glyph scale: avatar initials at 11px and chart callouts at 12px.

**The Sentence Case Rule.** Headings, buttons, nav items, labels and chips are written in sentence case. There are no uppercase, letter-spaced micro-labels anywhere.

**The Mono Means Machine Rule.** JetBrains Mono is for strings a system generated (ANO-0142, an invite code, an event name). Amounts, dates and prose stay in Archivo with tabular figures.

**The Columns Line Up Rule.** Every amount, count and table cell uses tabular figures; amounts right-align in tables.

## Layout

Content sits in a single 1200px column with 20px side gutters, widening to 32px from 640px. Breakpoints are Tailwind's defaults (640, 768, 1024, 1280, 1536px), and the main structural shifts happen at 768px (public nav appears) and 1024px (two-column story rows, the app sidebar docks).

**Marketing rhythm.** The home page spaces sections 96px apart, 128px from 640px. Inner pages use a compact rhythm of 64px, 96px from 640px. A page intro sits 56 to 80px below the header and closes with a faint hairline. Headlines and their sublines are left-aligned; centring is kept for empty states inside the app.

**The hero.** Headline, subline and an action row (primary button plus a text link, 24px apart) sit left; the product frame follows 56 to 64px below at full content width, entering the first viewport at about 60% of its height. The lower 46% of the hero is a Cool Paper band with a faint hairline top, so the frame straddles white and paper.

**Story rows.** Explanations pair with a figure in a two-column grid from 1024px: a text column capped at 26 to 28rem and a flexible figure column, 48px apart (80px at desktop), with sides alternating down the page. Below 1024px they stack, text first.

**Alternating bands.** Sections alternate between White Sheet and Cool Paper, and each paper band is bounded by faint hairlines top and bottom. A page carries at most one Deep Ink band.

**App shell.** A fixed 240px sidebar docks from 1024px and slides in as a drawer below it, over a 30% ink scrim. The top bar is 56px, sticky, 95% white with a light backdrop blur. Page padding steps 16, 24, 32, 40px at base, 640, 1280 and 1536px. The public header is 64px, sticky, and gains its hairline only after the page scrolls more than 4px; below 768px its links move into a 300px right-hand drawer.

**Phone behaviour of the product frame.** The findings inbox turns into a horizontal, snap-scrolling row of 16.5rem tabs above the detail pane, and the evidence table drops its Row and Description columns so the amount and its role stay visible. Charts lay out in the container's real pixel width so their labels keep their size.

### Named Rules
**The Hairline List Rule.** On marketing pages, a set of parallel items (checks, practices, values, principles) is a ruled list of title-and-body rows on hairlines, never a grid of identical cards. Two-column variants keep the same rule lines.

**The One Ink Band Rule.** A marketing page carries at most one Deep Ink band, and it tells the human-decision story (home: "Ventura recommends. Your team decides."; demo: the record of decisions). The login page's brand panel is its one ink surface. Inside the app, ink appears only as small marks (the workspace monogram) and the drawer scrim.

**The Example Data Rule.** Every product visual on a public page carries the words "Example data" in its header, right-aligned in muted text (a dashed-outline tag on the hero frame). Nothing on the site implies real customers or results.

## Elevation & Depth

Depth is hairline-first. Surfaces separate by a 1px rule and a small tonal step (White Sheet on Cool Paper), and shadows are soft, ambient and tinted with the ink colour rather than black. Shadows grow with the object's role: a resting card barely lifts, a product frame floats, a popover hovers. Inside the ink band depth comes from tone alone: raised ink panels with ink hairlines and no shadow.

### Shadow Vocabulary
- **Card** (`box-shadow: 0 1px 2px 0 rgb(15 21 36 / 0.05)`): resting cards and stat cards, primary and secondary buttons, the active sidebar item, inputs.
- **Card raised** (`box-shadow: 0 4px 12px -2px rgb(15 21 36 / 0.08), 0 2px 4px -2px rgb(15 21 36 / 0.05)`): figures and panels on marketing pages (charts, the column-mapping panel).
- **Frame** (`box-shadow: 0 24px 48px -16px rgb(15 21 36 / 0.18), 0 8px 16px -8px rgb(15 21 36 / 0.08)`): the hero product frame only.
- **Pop** (`box-shadow: 0 12px 32px -8px rgb(15 21 36 / 0.22), 0 2px 6px -2px rgb(15 21 36 / 0.08)`): floating layers such as the mobile drawer and chart tooltips.

### Named Rules
**The Hairline First Rule.** Separate with a rule or a tonal step before reaching for a shadow. A shadow without a hairline beside it is the exception.

**The One Frame Rule.** The large frame shadow belongs to the single product frame that leads a page. Supporting figures use the raised card shadow.

**The Frosted Bar Rule.** Sticky bars (the app top bar, the demo step rail) are 95% white with a light backdrop blur, so content passing beneath stays faintly legible without a heavy edge.

## Shapes

Gently rounded, never pill-shaped except where the object is a point or a person. Controls take 6px, inner panels 8px, cards and frames 10px, and the one large closing panel 14px.

- **Controls** (6px): buttons, inputs, nav items, search, menu buttons.
- **Chips** (4px): severity, status and count chips, with a 1px border or inset ring in the family's `-line` colour.
- **Inner panels** (8px): the fact strip and evidence table inside a finding, chart tooltips.
- **Cards and frames** (10px): app cards, stat cards, figures, the product frame, the audit trail panel.
- **Feature panel** (14px): the closing call-to-action panel on marketing pages.
- **Round** (full): status dots (6px), step numerals (28px circles with a firm hairline), avatars, audit timeline nodes. Chart bars take a small 2 to 4px radius.

Borders are always 1px. The only dashed border in the system is the "Example data" tag on the hero frame. Emphasis on a row is a full-width tint (a flagged evidence row fills with High Orange's pale `-bg`), never a coloured edge.

## Components

### Buttons
Quiet, solid and exact: a small set of heights, one colour for action.
- **Shape:** gently rounded (6px).
- **Primary:** Ledger Ultramarine fill, white 13.5px medium text, 36px tall, 14px side padding, card shadow. Small is 32px with 13px text; large is 40px with 14px text.
- **Marketing CTA:** the same fill at 44px tall, 20px side padding, 15px text, with a trailing 16px arrow that nudges 2px right on hover over 200ms.
- **Hover / Focus:** fill deepens to Pressed Ultramarine; focus shows a 2px Focus Ultramarine ring offset 2px. Colour, border and shadow transitions run 140ms on the expo ease-out. Disabled drops to 45% opacity.
- **Secondary:** White Sheet with a firm hairline border and Ledger Ink text; hover fills Overlay Grey. Used for "Dismiss" beside "Mark resolved".
- **Ghost:** transparent, Graphite text; hover fills Overlay Grey and darkens the text. Used for Back, Undo and toolbar actions.
- **Text link action:** a secondary action beside a CTA is an underlined text link in Ledger Ink (underline in the firm hairline colour, 3px offset), turning ultramarine on hover. Inline links in body copy are Pressed Ultramarine with an `accent-200` underline.

### Chips
- **Severity:** 22px tall in the product frame (20px in app tables), 4px radius, pale family fill, dark family text, 1px family-line ring, led by a 6px solid dot.
- **Status:** Open in the ultramarine tint, Resolved in outcome green, Dismissed in neutral grey, each with an optional matching dot.
- **Counts and confidence:** neutral Overlay Grey with Graphite text and tabular figures ("5 open", "Confidence 96").

### Cards / Containers
- **Corner Style:** 10px.
- **Background:** White Sheet on the Cool Paper canvas.
- **Shadow Strategy:** the card shadow at rest (see Elevation & Depth).
- **Border:** 1px hairline; internal dividers in the faint hairline.
- **Internal Padding:** 24px by default, 16px compact, 32px spacious. Card headers pair a 14.5px medium title with a 13px muted subtitle and an optional 32px icon tile in Overlay Grey.
- **Stat card:** 13px medium muted label, a 28px medium tabular figure at -0.02em, and a 12.5px muted subtitle.

### Inputs / Fields
- **Style:** White Sheet, 1px firm hairline, 6px radius, 40px tall, 12px side padding, 14.5px text, card shadow, Slate Note placeholder.
- **Focus:** the border turns Focus Ultramarine with a 2px ultramarine ring at 30% opacity.
- **Search:** the app search sits in Overlay Grey with no border at rest, 32px tall, and turns white with an `accent-400` border on focus.
- **One-time codes:** set in mono at 20px, centred, with wide letter-spacing so each digit stands apart.

### Navigation
- **Public header:** logo, then Product, Security and Contact as 14px Graphite links with an Overlay Grey hover fill, then Sign in and a 36px primary "Walk through the demo" at the right.
- **App sidebar:** Sidebar Mist panel with a hairline right edge. A workspace row with an ink monogram tile, then groups headed by 12px medium muted labels in sentence case. Items are 32px rows of 13.5px medium text with 16px outline icons. Hover fills Sidebar Hover; the active item becomes a White Sheet chip with a hairline ring and the card shadow, and its icon turns ultramarine. Counts sit in a round grey pill.
- **Footer:** a brand column with the one-line description, then three columns of 14px muted links under 13px medium headings, and one hairline above the copyright line.

### Product frame (signature)
The real interface, shown working. A 10px White Sheet frame with the frame shadow: a header row (title, a count pill, the source file in muted text, the dashed "Example data" tag), then a 22rem findings inbox beside the open finding. Each inbox row carries a severity dot, the title, a tabular amount, and a muted vendor-and-severity line; the selected row fills with Selection Wash. Arrow keys move between findings. The detail pane shows the severity chip, a confidence pill, the mono ID and the decision buttons, then a three-cell fact strip, the evidence table with flagged rows tinted, and the reasoning in body copy. Choosing a finding swaps the pane with a 220ms rise-and-fade. After a decision the buttons give way to a green check, "Resolved by you, logged", and an Undo.

On the home page the frame makes the page's one authored entrance: it settles from 55% opacity, 14px lower and 98.5% scale over 900ms on the expo ease-out (`cubic-bezier(0.16, 1, 0.3, 1)`), after a 120ms delay. Nothing else on the page animates in. Under reduced motion every animation and transition collapses to 1ms.

### Figure
A 10px White Sheet panel with the raised card shadow, a caption row ("Atlas Facilities Co., last 15 payments") with "Example data" at the right, and 20 to 24px padding around a chart drawn in the system's own tokens: context marks in the firm hairline, the point of the story in its severity hue, a dashed reference line labelled in plain words.

### Hairline fact list (signature)
A description list ruled top and bottom with 1px hairlines: each row has a 15.5 to 16px medium title and a 15 to 15.5px Graphite body, side by side from 768px (title column about 13 to 18rem) and stacked below. It replaces card grids on every marketing page.

### Ink band and audit trail
The one dark section per marketing page: Deep Ink background, white headline, Ink Note body, and a hairline-ruled list in Ink Rule. Beside it, the audit trail panel in Raised Ink lists events on a thin vertical line with round nodes (muted for the system, light for people), each event as "what" in white, "by whom" in Ink Note, and a tabular timestamp.

### Step numerals
Sequences (how it works, the demo steps) are numbered with 28px circles: a firm hairline border, White Sheet fill and a 13px medium tabular numeral. On ink the border and numeral switch to Ink Rule and Ink Note.

## Do's and Don'ts

### Do:
- **Do** reserve ultramarine (`accent-500` to `accent-700`) for buttons, links, focus rings, selection and the Open status.
- **Do** keep severity colour on findings only, and keep review status visibly separate from severity.
- **Do** set marketing, auth and error headlines in Archivo at width 112 and weight 500, left-aligned, with tight negative tracking (-0.025em to -0.035em).
- **Do** write every heading, button, nav item and label in sentence case.
- **Do** use tabular figures for every amount and right-align amounts in tables.
- **Do** separate surfaces with 1px hairlines and tonal steps first; use the card, card raised, frame and pop shadows by role.
- **Do** label every product visual on a public page "Example data".
- **Do** present parallel marketing content as a hairline list of title-and-body rows.
- **Do** give each marketing page at most one Deep Ink band, used for the human-decision story.
- **Do** keep state transitions short (140ms colour changes, 220ms pane swaps) on the expo ease-out, and respect reduced motion.

### Don't:
- **Don't** use ultramarine for chart series, headings, decorative fills or emphasis; charts use Azure and Teal Green.
- **Don't** colour an Open finding red, or borrow severity hues for status, banners or general warnings.
- **Don't** add coloured side borders to cards, rows or alerts; tint the whole row or use a dot.
- **Don't** set uppercase, letter-spaced micro-labels or eyebrows above headlines.
- **Don't** use bold (700); headlines are 500.
- **Don't** set amounts, dates or prose in mono.
- **Don't** build marketing sections from grids of identical icon cards.
- **Don't** put gradients, glow or neon on surfaces, buttons, text or backgrounds.
- **Don't** show customer logos, testimonials, results or unlabelled product data.
- **Don't** use Tailwind's default palette colours or default shadows; every colour and shadow comes from the tokens above.
