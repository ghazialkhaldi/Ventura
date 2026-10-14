---
name: Ventura
description: Spend review for month-end close, set on one painted dawn sky that turns to morning as you scroll, with every finding on white paper.
colors:
  accent-50: "#f1f0fb"
  accent-100: "#e4e1f8"
  accent-200: "#c9c3f1"
  accent-400: "#8070d8"
  accent-500: "#5f4dc8"
  accent-600: "#4a3ab0"
  accent-700: "#3d2f93"
  accent-800: "#332877"
  sky-night: "#12133a"
  sky-indigo: "#2b2a6b"
  sky-violet: "#4b3f8f"
  sky-rose: "#c4718f"
  sky-coral: "#f39a7c"
  sky-gold: "#ffd3a1"
  sky-morning: "#a9c8ee"
  sky-day: "#e2ecf9"
  sky-muted: "#dedaf6"
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
  positive: "#17b26a"
  positive-fg: "#067647"
  positive-bg: "#ecfdf3"
  positive-line: "#abefc6"
  chart-series-1: "#4f46c4"
  chart-series-2: "#d97757"
typography:
  display:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "4.75rem"
    fontWeight: 500
    lineHeight: 1.02
    letterSpacing: "-0.04em"
    fontVariation: "'wdth' 112"
  display-page:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "3.5rem"
    fontWeight: 500
    lineHeight: 1.05
    letterSpacing: "-0.03em"
    fontVariation: "'wdth' 112"
  headline:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "2.5rem"
    fontWeight: 500
    lineHeight: 1.08
    letterSpacing: "-0.03em"
    fontVariation: "'wdth' 112"
  title:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  page-title:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 500
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  body-lead:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.6
  body:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.7
  body-app:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "'kern' 1, 'liga' 1"
  label:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.4
  mono-id:
    fontFamily: "JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.4
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
  xl: "10px"
  2xl: "14px"
  sheet-sm: "22px"
  sheet: "28px"
  full: "9999px"
spacing:
  page-gutter-sm: "20px"
  page-gutter: "32px"
  sheet-margin-sm: "12px"
  sheet-margin: "20px"
  sheet-pad-x: "56px"
  sheet-pad-y: "80px"
  sheet-gap: "56px"
  block-gap: "56px"
  app-main: "24px"
components:
  button-primary:
    backgroundColor: "{colors.accent-600}"
    textColor: "{colors.surface-raised}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "36px"
  button-primary-hover:
    backgroundColor: "{colors.accent-700}"
  button-secondary:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.text-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "36px"
  button-secondary-hover:
    backgroundColor: "{colors.surface-overlay}"
  button-sky:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.accent-800}"
    rounded: "{rounded.full}"
    padding: "0 24px"
    height: "48px"
  button-sky-hover:
    backgroundColor: "{colors.accent-50}"
  button-paper-pill:
    backgroundColor: "{colors.accent-600}"
    textColor: "{colors.surface-raised}"
    rounded: "{rounded.full}"
    padding: "0 24px"
    height: "48px"
  button-paper-pill-hover:
    backgroundColor: "{colors.accent-700}"
  input:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "40px"
  chip-critical:
    backgroundColor: "{colors.critical-bg}"
    textColor: "{colors.critical-fg}"
    rounded: "{rounded.sm}"
    padding: "0 8px"
    height: "22px"
  chip-high:
    backgroundColor: "{colors.high-bg}"
    textColor: "{colors.high-fg}"
    rounded: "{rounded.sm}"
    padding: "0 8px"
    height: "22px"
  chip-medium:
    backgroundColor: "{colors.medium-bg}"
    textColor: "{colors.medium-fg}"
    rounded: "{rounded.sm}"
    padding: "0 8px"
    height: "22px"
  chip-status-open:
    backgroundColor: "{colors.accent-50}"
    textColor: "{colors.accent-700}"
    rounded: "{rounded.sm}"
    padding: "0 6px"
    height: "20px"
  chip-status-resolved:
    backgroundColor: "{colors.positive-bg}"
    textColor: "{colors.positive-fg}"
    rounded: "{rounded.sm}"
    padding: "0 6px"
    height: "20px"
  chip-status-dismissed:
    backgroundColor: "{colors.surface-overlay}"
    textColor: "{colors.text-muted}"
    rounded: "{rounded.sm}"
    padding: "0 6px"
    height: "20px"
  example-label:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.text-muted}"
    rounded: "{rounded.md}"
    padding: "0 8px"
    height: "24px"
  sheet:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.sheet}"
    padding: "80px 56px"
    width: "1280px"
  sheet-ink:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.ink-text}"
    rounded: "{rounded.sheet}"
    padding: "80px 56px"
    width: "1280px"
  card:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.xl}"
    padding: "24px"
  rail:
    backgroundColor: "{colors.sky-night}"
    textColor: "{colors.surface-raised}"
    width: "240px"
  rail-item-active:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.sky-night}"
    rounded: "{rounded.md}"
    padding: "0 8px"
    height: "32px"
---

# Design System: Ventura

## Overview

**Creative North Star: "Close at Dawn"**

The public site is one painted sky. It opens on pre-dawn indigo over still water, with soft cloud masses lit from below by a low sun, and as the visitor scrolls it passes through sunrise into full morning, so every page ends in daylight: the close, done, with nothing left unexplained. The light carries the story. Night is the open period, morning is the period closed. Content never sits on the sky as loose text blocks. It rides on white paper sheets that float above the sky with deep, soft, indigo-tinted shadows, and the sky shows as a band of colour between one sheet and the next.

The two layers have different densities. The sky is spacious and cinematic, with large semi-expanded Archivo display type set left. The paper is exact: product visuals are real-looking, dense, tabular and labelled as example data, and every claim traces back to rows. One deep dawn indigo marks actions on paper. On the sky the action is a white pill. Severity hues appear only where a finding is.

The signed-in app is a calm, neutral workspace on cool paper grey. The dawn enters it in three places only: the sky-gradient rail, the dawn indigo accent, and the CloseHorizon, a small sunrise in the rail that climbs as the period's findings are decided. The world must not read as a generic AI startup, as playful, or as bland, and it uses no flat solid fills and no decorative squares or ruled patterns.

**Key Characteristics:**
- One scroll-linked dawn sky behind every marketing page, with clouds that turn from warm to white. Its hour follows the scroll and it is never a flat fill.
- White paper sheets (28px corners, deep indigo-tinted shadow) carry all content between the opening and the close.
- White type on the dark upper sky; ink type on the daylight close and on paper.
- Dawn indigo for actions on paper; white pills for actions on the sky.
- Archivo display at width 112, weight 500, tight negative tracking. Body at normal width.
- Severity colours on findings only. Status is a separate vocabulary.
- Every product visual is labelled "Example data".
- Sentence case everywhere, no uppercase micro-labels, no coloured side borders.

## Colors

The palette is a painted dawn sky, white paper, cool neutral ink, one dawn indigo accent, and a severity set that only findings wear.

### Primary
- **Dawn Indigo** (accent-600): the one action colour on paper and on the daylight close. It fills primary buttons, paper pills and the "Mark resolved" decision, and it colours the active rail icon, step numbers and at most one emphasised phrase per sheet. White on it is 8.3:1.
- **Deep Dawn Indigo** (accent-700, accent-800): accent-700 is the hover fill for indigo actions, the colour of inline links and the text of open-status chips. accent-800 is the text on the white sky pill (12.3:1 on white).
- **Indigo Mist** (accent-50, accent-100, accent-200): accent-50 tints the selected inbox row, step numerals, open-status chips and the sky pill's hover. accent-100 backs app avatars. accent-200 is the text-selection colour and the resting underline on inline links.
- **Focus Indigo** (accent-400, accent-500): accent-500 is the 2px focus ring and the focused input border. accent-400 marks focused search fields and the hover underline on links.

### Sky
These are the sky's reference colours. The live sky is painted by `SkyBackdrop` as a five-stop vertical gradient, with stops at 0, 38, 66, 86 and 100% of the viewport, interpolated between four hours by scroll position:

| Hour | Scroll | Stops, top to bottom |
|---|---|---|
| Dawn | 0.00 | #1a1b4d, sky-violet, sky-rose, sky-coral, sky-gold |
| Sunrise | 0.35 | #2e3478, #7a63a8, #e38f8f, #f8b98e, #ffe1b5 |
| Morning | 0.70 | #4e6ab8, #8fa9df, #d9c3cf, #f6d6bf, #fff0dc |
| Day | 1.00 | #7aa2e0, #b4cdf0, #dce8f8, #eef3fb, #fbf6ee |

A soft sun glow (a radial gradient of warm white at 55% opacity) climbs 55vh over the length of the page. Three cloud masses, which are blurred radial gradients, drift a little with the scroll and crossfade from warm dawn light (peach, rose and violet) to white daylight as the hour advances. On the home hero, the horizon adds a sea that runs from coral to deep indigo, a glint of broken light dashes under the sun, and two far ridges. The sea runs on under the next section and dissolves into the sky. Three boats cross the water: two sloops and a small launch, drawn as backlit silhouettes (dark hulls, sailcloth warming toward the foot), each with a faint broken reflection. Farther boats sit nearer the horizon, smaller, hazier (55% and 50% opacity) and slower (230 to 300 seconds a crossing). The nearest sloop is 46px tall at 92% opacity, crosses in 170 seconds through the sun's glint, and trails a soft wake. Each bobs on a 7-second swell. Their loops start part-way across so the water is never empty on load, and under reduced motion they rest where they are drawn. They stay small, slow and few: atmosphere, never an illustration that competes with the finding card.

- **Night Indigo** (sky-night): the top of the dawn sky and of the app rail. It is also the ink colour of closing headlines on the daylight sky and the text on the active rail item. White on it is 17.8:1.
- **Pre-dawn Indigo** (sky-indigo): body text on the daylight close.
- **Twilight Violet, Dawn Rose, Sunrise Coral, Horizon Gold** (sky-violet, sky-rose, sky-coral, sky-gold): the dawn hour's lower bands, the sign-in panel's still dawn, and the CloseHorizon.
- **Morning Blue, Daylight** (sky-morning, sky-day): the reference colours for the late hours.
- **Lavender Haze** (sky-muted): secondary type on the dark sky (leads, meta lines, the systems strip caption). It is 13:1 on night and 6.4:1 on violet.

### Neutral
- **Paper** (surface-raised): every sheet, card, product frame and form.
- **Cool Paper Ground** (surface): the app canvas, table header rows and form footers.
- **Overlay and hover greys** (surface-overlay, surface-hover, surface-sunken): neutral chips such as confidence and dismissed status, ghost-button hover, table-row hover and wells.
- **Hairlines** (border, border-subtle, border-strong): border separates sections and lists. border-subtle separates rows. border-strong outlines secondary buttons and inputs, draws the dashed example-data label, and fills context bars in charts.
- **Ink type** (text-primary, text-secondary, text-muted): primary text is near-black with a blue cast. Secondary text (8.1:1) is used for reading copy. Muted text (5.1:1 on paper) is for metadata, captions and column heads.

### Ink
- **Night Ink** (ink, ink-raised, ink-line, ink-text, ink-muted): the one dark sheet a page may carry. It holds the human-decision story and the audit trail. Text on it is white or ink-text (16:1), secondary text is ink-muted (7.5:1), and rules are ink-line. The same ink at 30% is the scrim behind the mobile drawer and the app rail.

### Severity and outcome
- **Critical, High, Medium** (critical, high, medium, each with -fg, -bg and -line): a finding's severity. The solid value colours dots, chart marks and the focus brackets. -bg and -line make the chip and the flagged-row tint. -fg is chip text and the "Flagged" note (5.3 to 6:1 on its tint).
- **Low** (low): the grey dot for low severity and for decided findings in the inbox.
- **Positive** (positive, -fg, -bg, -line): review outcomes such as Resolved, the "Resolved by you, logged" confirmation and success messages. Positive is an outcome, not a severity.

### Chart series
- **Dawn Indigo and Dawn Coral** (chart-series-1 #4f46c4, chart-series-2 #d97757): the app's two data-series colours, taken from the sky's indigo and coral and validated as a pair on white (lightness band, chroma, colour-vision separation and 3:1 contrast all pass). A chart with more than two series folds the rest into "Other" or a table. Series always carry a legend and direct labels, so identity never rests on colour alone. On marketing charts, context bars are border-strong and only the finding's own point takes its severity hue.

### Named Rules
**The Moving Sky Rule.** The sky is never a flat fill. On every scrolling marketing page it is the five-stop gradient above, and its hour is set by scroll position (scrollY ÷ scrollable height), so the page moves from dawn to day. A solid colour block behind content, or a static single-hour gradient on a scrolling page, breaks the world. Under reduced motion, and on fixed panels that do not scroll such as sign-in, the sky holds a still dawn.

**The Hour of Type Rule.** White type sits only on the dark upper sky: the night, indigo and violet bands at the top of a page (8.7:1 or better). It never sits on the rose, coral or gold bands, where white falls to 3.4:1. By the page's close the sky is daylight, and type there is ink: sky-night for headlines and sky-indigo for body (10:1 or better on the day sky).

**The Two Actions Rule.** Dawn indigo is the action on paper and on the daylight close. On the dark sky the action is a white pill with deep dawn indigo text. An indigo button never sits on the dark sky, and a white pill never sits on paper. Indigo otherwise marks only links, focus, selection, the active or selected item, step numbers and at most one emphasised phrase per sheet. It never fills an area.

**The Findings-Only Severity Rule.** Critical, high and medium belong to findings: their chips, dots, flagged rows, chart points and focus brackets. Status is a separate vocabulary (Open in indigo mist, Resolved in positive, Dismissed in neutral grey) and never borrows a severity hue, so an open low-severity finding never reads as red.

## Typography

**Display Font:** Archivo, variable, with the `wdth` axis loaded (fallback ui-sans-serif, system-ui)
**Body Font:** Archivo at normal width
**Label/Mono Font:** JetBrains Mono 400 and 500, for identifiers only

**Character:** One grotesque in two widths. Display type runs semi-expanded at weight 500 with tight negative tracking, echoing the wordmark and giving the headline a calm, wide confidence over the sky. Body and interface type stay at normal width, set for long reading and dense tables.

### Hierarchy
- **Display** (500, 2.75rem → 4rem at sm → 4.75rem at lg, line-height 1.02, -0.04em, wdth 112): the home hero headline only, left aligned, max 11ch.
- **Display, page** (500, 2.25rem → 3.5rem, line-height 1.04 to 1.06, -0.03 to -0.035em, wdth 112): page intros on the sky (white) and the closing headline on the daylight sky (sky-night). Max about 20ch.
- **Headline** (500, 1.875rem → 2.5rem, line-height 1.08, -0.03em, wdth 112): section headings on sheets. Marketing pages other than home use a step smaller (1.75rem → 2.25rem, line-height 1.1). A sheet that opens the product story may use a larger statement headline (2.25rem → 3.75rem, line-height 1.04, max 15ch) with one phrase in dawn indigo, as in "1,431 rows in. Five worth a person's time."
- **Step number** (500, tabular): plain digits, never circled or boxed. Beside a list step they are 17px display digits in dawn indigo. Before a step heading they run inline in the heading's own size, in muted text with a 12px gap.
- **Title** (500, 1.5rem, line-height 1.2, -0.02em, normal width): sub-sections inside a sheet.
- **Page title** (500, 22px, line-height 1.25, -0.02em): app page headings. The sign-in heading uses the wide display face at 1.75rem.
- **Finding title** (500, 19 to 20px, -0.015em): a finding's name, followed by " · Vendor" in muted 400.
- **Body lead** (400, 17 to 18px, line-height 1.6 to 1.65): section leads, max about 38 to 40rem.
- **Body** (400, 15.5 to 16px, line-height 1.65 to 1.7): marketing reading text, max 62ch. Long-form prose is 16px at line-height 1.75 within 44rem.
- **Body, app** (400, 14px, line-height 1.5): the app's base size. Controls are 13.5px.
- **Label** (500, 12 to 13px, sentence case, normal tracking): form labels, column heads, chip text, rail section labels and figure captions.
- **Mono ID** (JetBrains Mono 400, 12px, muted): finding and record identifiers such as ANO-0142.

### Named Rules
**The Wide Display Rule.** The `wdth 112` setting belongs only to display and headline type and step numbers. Body, labels and interface text stay at normal width. Weight 500 is the heading weight throughout; nothing is set at 700. 600 appears only in avatar initials and short chart callouts.

**The Mono-for-IDs Rule.** JetBrains Mono is for identifiers and nothing else. Figures, amounts and dates are Archivo with tabular numerals, and every financial figure and table cell aligns with `tabular-nums`.

**The Sentence Case Rule.** Every heading, label, button, chip and navigation item is in sentence case. There are no uppercase micro-labels, no letter-spaced caps, and no eyebrow or kicker lines above headings.

## Layout

**Marketing.** A sticky header (64px, 80px at lg) sits over everything, and the footer sits on the daylight sky below the close. Content aligns to a 1200px page container with 20px gutters (32px from sm). Pages open directly on the sky: the hero, or a page intro, plus the systems strip. Pages also close directly on the sky with the closing call to action. Everything between the opening and the close sits on sheets. A sheet is up to 1280px wide with a 12px outer margin (20px from sm). Inside it, the same 1200px container is padded 20/40/56px horizontally and 56/80px vertically. Sheets are spaced 40px apart (56px from sm), so the sky shows between them as a band that changes hour as you scroll.

**The hero.** It fills the first viewport (100svh minus the header). It has two columns at lg: the headline, subline and actions on the left, and a 32rem finding card on the right, dropped about 7rem into the dawn light. The horizon sits at 77% of the hero's height, with the sea, the sun glint and the far ridges at and below it. The sea extends past the hero's bottom edge under the systems strip and fades out, so the hero never ends on a hard edge. At sm and below, the columns stack and the card follows the actions.

**Inside sheets.** Asymmetric two-column grids pair a 26 to 28rem text column with a flexible visual column. The gap is 48 to 80px, and the sides alternate from row to row. Blocks inside a sheet are separated by 56 to 80px. Lists are rows on hairlines in one or two columns, never grids of cards.

**The app.** A fixed 240px rail sits on the left. On phones it slides in over an ink scrim. A 56px sticky top bar is frosted white at 95% opacity with a hairline. The main area is padded 16, 24, 32 or 40px depending on the breakpoint, on the cool paper ground.

**Breakpoints.** Tailwind defaults: sm 640, md 768, lg 1024, xl 1280, 2xl 1536.

### Named Rules
**The Paper Sheet Rule.** Content sits on paper. Every section between a page's opening and its close is a sheet with 28px corners and the sheet shadow. Only the opening (headline, lead, actions, systems strip) and the close are set directly on the sky. A page may carry one ink sheet, and only for the human-decision and audit-record story.

**The Hairline List Rule.** Feature and fact lists are title-and-body rows separated by 1px hairlines, not icon cards in a grid.

## Elevation & Depth

Depth comes from light and paper. The sky provides the light: a sun glow climbing the page, and on the hero a sun on the horizon with a glint on the water. Paper floats above the sky on long, soft shadows tinted with the sky's own indigo. Inside the paper, depth is quiet: hairlines, tonal greys and small neutral shadows. When the header is over paper it becomes 85% white with a medium backdrop blur. Nothing uses a hard offset shadow.

### Shadow Vocabulary
- **Sheet** (`box-shadow: 0 50px 100px -40px rgb(28 18 72 / 0.45), 0 18px 36px -18px rgb(28 18 72 / 0.25)`): paper sheets and the hero finding card floating on the sky.
- **Pop** (`box-shadow: 0 12px 32px -8px rgb(15 21 36 / 0.22), 0 2px 6px -2px rgb(15 21 36 / 0.08)`): floating controls and panels, such as the white sky pill, the demo step rail, the contact form on the sky, the open mobile drawer and chart tooltips.
- **Frame** (`box-shadow: 0 24px 48px -16px rgb(15 21 36 / 0.18), 0 8px 16px -8px rgb(15 21 36 / 0.08)`): the large product frame (the findings inbox) set inside a sheet.
- **Card md** (`box-shadow: 0 4px 12px -2px rgb(15 21 36 / 0.08), 0 2px 4px -2px rgb(15 21 36 / 0.05)`): a raised panel inside the app, such as a finding's evidence panel. Figures and side panels inside a sheet carry no shadow, because the sheet is already the raised surface.
- **Card** (`box-shadow: 0 1px 2px 0 rgb(15 21 36 / 0.05)`): app cards, inputs, buttons and the active rail item.

### Named Rules
**The Tinted Shadow Rule.** A shadow cast onto the sky carries the sky's indigo (28 18 72), never neutral grey. Shadows inside paper or the app are neutral ink (15 21 36) and small.

## Shapes

The geometry is soft, stepped by scale: the larger the surface, the rounder its corners. Sheets have 28px corners (22px on phones). The hero finding card has 14px corners. Product frames, side panels, app cards and the CloseHorizon have 8 to 10px corners. Controls and inputs have 6px corners, and chips 4px. Marketing actions, the header's demo action and the demo step rail are full pills. Buttons inside the app and inside product visuals stay 6px rectangles. Audit-trail nodes, avatars and status dots are circles. Step numbers are never enclosed.

Two shapes belong to the world itself. One is the horizon: a straight line at 77% of the hero, with two far ridges at the left that haze into the light at the waterline. The farther ridge is paler. The other is the focus bracket: four 12px corner arcs drawn with a 2px round-capped stroke in the high severity colour, which tighten onto a flagged evidence row like a lens finding focus. Borders are 1px hairlines. Dashed borders are reserved for the example-data label.

## Components

### Buttons
Calm and exact on paper, luminous on the sky.
- **Shape:** 6px corners in product and app contexts (36px tall by default, 32px small, 40px large). Full pills, 48px tall, for marketing actions.
- **Primary:** a dawn indigo fill with white 13.5px weight-500 text, 14px horizontal padding and the card shadow. Hover deepens it to accent-700.
- **Secondary / Outline:** a paper fill, a border-strong hairline and ink text. Hover moves to surface-overlay.
- **Ghost:** transparent with secondary text. Hover gives an overlay grey.
- **Sky pill:** a white fill with accent-800 text, a trailing Radix arrow that nudges 2px right on hover, a pop shadow, and an accent-50 fill on hover. This is the action on the dark sky.
- **Paper pill:** the same pill in dawn indigo, for actions on the daylight close and on paper.
- **Text links:** on the sky, white with a 40% white underline that becomes solid on hover. On paper, ink or accent-700 with an accent-200 underline that turns accent-400 on hover. Underlines sit 3 to 4px below the text with a 1px thickness.
- **Focus / Motion:** a global 2px accent-500 ring with a 2px offset. Colours transition over 140ms on the expo-out curve.

### Chips
- **Severity chip:** 22px tall (20px in the app), 4px corners. It has the severity -bg fill, -fg text and a 1px inset -line ring, and a leading 6px dot in the solid severity colour. Labels: Critical, High, Medium, Low, always in that sentence-case spelling; the Badge component writes the label from the severity value, so call sites never spell it themselves.
- **Status chip:** the same form in its own vocabulary, which never borrows a severity hue: Open (accent-50 with accent-700), Under review (overlay grey with primary text and a border-strong line), Resolved (positive tint) and Dismissed (overlay grey with muted text). A finding is "to decide" while it is Open or Under review; every open count in the app uses that one definition.
- **Confidence chip:** an overlay grey fill with secondary text and tabular numerals, such as "Confidence 96".
- **Example-data label:** 24px tall with 6px corners and a dashed border-strong outline, in 11.5 to 12px muted text reading "Example data". In figure and panel captions it appears as plain muted text, right aligned.

### Cards / Containers
- **Sheet:** paper or ink, 28px corners, the sheet shadow, up to 1280px wide, padded 56 to 80px. This is the container for every marketing section.
- **Product frame:** paper with 10px corners, a border hairline and the frame shadow. It has a 52px header bar (title, count chip, file name, example-data label) over a 22rem inbox column and a detail pane.
- **Figure:** unframed on the sheet. A 13px caption row carries the subject on the left and "Example data" on the right, over a border hairline, with the chart 24px below. No box, no shadow.
- **Side panel:** paper with 10px corners and a border hairline, but no shadow, such as the column-mapping panel. Its header bar also carries the example-data note.
- **App card:** paper with 10px corners, a border hairline, the card shadow and 24px padding. Its header is a 14.5px weight-500 title with a 13px muted subtitle.
- **Stat strip:** the app's headline figures share one paper strip split by 1px border hairlines (four across, two by two on phones), never a row of separate same-size tiles. Each cell is a 12.5px muted label over a 26px weight-500 tabular value and a 12.5px muted note.
- **Findings table:** the app's list of findings is a sortable table, not a stack of cards: Severity, Finding (title over vendor, type and mono ID), Amount, Confidence, Status, Detected. Headers are 12.5px muted buttons with a caret on the sorted column and `aria-sort`; rows are about 62px, take the hover tint, and open the finding. Confidence, Status and Detected give way on narrow screens.
- **Flagged evidence rows:** in every evidence table (hero card, inbox, demo and the app's finding page) the flagged row takes the high-bg tint and, while the finding is still to decide, the focus brackets. Dense tables pass a 2px inset so the corners frame the row, clear of the text; the hero card uses 3px by 10px.

### Inputs / Fields
- **Style:** 40px tall with 6px corners, a border-strong hairline, a paper fill, 14.5px text, 12px horizontal padding and the card shadow. The label sits above in 13px weight 500.
- **Focus:** the border shifts to accent-500 and a 2px accent-500 ring at 30% appears.
- **Error:** a critical-bg panel with a critical-line border and critical-fg text, with a leading Radix icon on sign-in, shown with the form it belongs to.
- **Search (app):** 32px tall, overlay grey fill, no border at rest. When focused it turns to paper with an accent-400 border.
- **Segmented views:** one row of mutually exclusive views, each with its count, such as "To decide 54 · Under review 6 · Resolved 12 · Dismissed 6 · All 72". An overlay grey track with a 1px border ring holds 32px segments in 13px weight 500; the active segment is a paper plate with the card shadow. No icons. It replaces rows of icon-and-number tiles.

### Navigation
- **Public header:** over the sky it is transparent at rest and turns to night glass (sky-night at 45% with a strong backdrop blur and a 10% white hairline) once the sky's own content scrolls beneath it. The white wordmark sits at 20px, links are 15px white at 90% with a 10% white hover plate, "Sign in" is a text link, and the demo action is a white sky pill. Over paper it becomes 85% white with a backdrop blur and a hairline, with the dark wordmark, secondary-text links and a dawn indigo pill. Sky regions mark themselves with `data-field`, and the header samples the element under its bottom edge to choose its state.
- **Mobile drawer:** a 300px paper panel sliding in from the right over a 30% ink scrim, over 300ms on the expo-out curve. It has 15px links and a full-width indigo action at the foot.
- **Demo step rail:** a sticky floating pill bar, 90% white with a blur, the pop shadow and a 5% black ring. Its steps are muted digits with sentence-case labels, and a live "n of 5 decided" count sits on the right.
- **Footer:** set on the daylight sky the page has scrolled into, not on paper. Hairlines are sky-night at 10%, column headings are 13px sky-night weight 500, and links and the legal line are 14px sky-indigo, underlined on hover.
- **App rail:** a 240px dawn gradient that runs from night down to violet indigo, with white type. Section labels are 12px weight 500 at 55% white, in sentence case. Items are 32px tall, 13.5px weight 500 at 80% white, with a 10% white hover. The active item becomes a white plate with sky-night text, a dawn indigo icon and the card shadow. Count badges are 15% white pills, or accent-50 on the active item.

### Finding card with focus brackets (signature)
A finding held in the dawn light. A paper card (97% opacity, 14px corners, the sheet shadow and a 5% black ring) shows the severity chip, the confidence chip, the mono ID and the example-data label. Below them come the finding title with its vendor, the rule that fired, and its evidence rows. The flagged row takes the high-bg tint and is held in focus brackets, which tighten from outside the row onto it over 900ms (expo-out, 500ms delay). The same brackets lock onto every flagged evidence row of an open finding in the findings inbox. The foot carries "Dismiss" (secondary) and "Mark resolved" (indigo). Once a person decides, the brackets go and the foot reads "Resolved by you, logged" with a positive check and an Undo. The product never acts on its own.

### CloseHorizon (signature)
The app's version of the world: the period's close as a sunrise. It is a 132px tile with 12px corners at the foot of the rail. A dawn sky (night, violet, rose, coral) crossfades toward morning blue and gold as the share of decided findings grows, over a strip of sea with a soft glint under the sun. The 112px sun sits on the horizon while findings are open and climbs, over 700ms on expo-out, in proportion to the share decided; it is fully up at the last decision. It reads "Close" (or "Closed") in 15px semi-expanded display with "n of N decided" in 12px white below, and links to the anomalies queue.

### Morning card (signature)
Every marketing page closes on it: the dawn the page opened on has become a clear morning. A sheet-sized card (28px corners, the sheet shadow) holds a drawn scene anchored bottom-right, so the sun and chairs survive any crop. It has a deep-to-pale blue sky, a high sun with a wide warm glow, soft white clouds with cool undersides, and a loose flock of five birds that drifts and beats its wings. Below them, four ranges of hills step from blue haze to deep meadow green, with a sunlit rim on the near crest, fine grass at distance, clumped tufts and wildflowers in the foreground, and three small far trees. On the near hill two white Adirondack chairs face the sun, seen from behind in shade, with a low table and two steaming mugs between them: the close is done. The closing headline (up to 4rem semi-expanded display, sky-night), its line of body in sky-indigo and the indigo pill sit in the open sky at top left. Motion is slow and small, and stops under reduced motion.

### Systems strip (signature)
It sits on the hero's sea where it dissolves into the sky. Official marks only (simple-icons paths) in white at 90%, each cropped to its own outline. Wordmarks stand alone at 21px. Symbol marks are 22px and carry their name in 15px. The strip drifts left in a 48-second loop, pauses on hover, stops under reduced motion and fades out at both edges. Its caption says Ventura reads exports, never that it syncs.

### Audit trail (on ink)
An ink-raised panel with an ink-line border and 10px corners. A vertical 1px ink-line connects 10px nodes: muted for Ventura's own events, ink-text for a person's. Each event reads "What by who", with detail in ink-muted and a tabular timestamp.

### Hairline fact list
Title-and-body rows between 1px border hairlines. The title is 15.5 to 16px weight 500 and the body is 15 to 15.5px secondary text. Rows sit in a single column with an 18rem title column at md, or in two columns with a 56px gap. This replaces card grids for features, checks and assurances.

## Do's and Don'ts

### Do:
- **Do** put every marketing page on `SkyBackdrop` and let scroll set its hour, from dawn at the top to day at the bottom.
- **Do** set all content between a page's opening and its close on a paper sheet (28px corners, the indigo-tinted sheet shadow), with the sky showing 40 to 56px between sheets.
- **Do** keep white type on the night, indigo and violet bands at the top of a page, and use sky-muted for its secondary lines.
- **Do** close every page on the daylight sky with sky-night headlines, sky-indigo body and a dawn indigo pill.
- **Do** use the white pill (accent-800 text) as the action on the dark sky, and dawn indigo (accent-600, hover accent-700) as the action on paper.
- **Do** label every product visual, chart and sample record "Example data".
- **Do** set every amount, count and date in tabular numerals, and identifiers in 12px JetBrains Mono.
- **Do** use Radix icons only where they do a job, such as a direction, a state, a control or a disclosure, sized 14 to 16px in the current colour.
- **Do** show external systems only by their official marks.
- **Do** let the app carry the world only through the dawn rail, the indigo accent and the CloseHorizon. Keep its canvas cool paper grey with white cards and hairlines.
- **Do** hold a still dawn under `prefers-reduced-motion`: no sky change, no sunrise, no marquee, and 1ms transitions.

### Don't:
- **Don't** put a flat solid colour fill behind content, or freeze a scrolling page at one hour of the sky.
- **Don't** place body text or sections directly on the mid-page sky. Only the opening and the close sit on it.
- **Don't** set white type on the rose, coral or gold bands, or ink type on the dark upper sky.
- **Don't** use dawn indigo on the dark sky, or put a white pill on paper.
- **Don't** use critical, high or medium for anything but a finding, and don't colour a status with a severity hue.
- **Don't** add coloured side borders or left-stripe accents to cards, alerts or rows.
- **Don't** use uppercase micro-labels, letter-spaced caps, eyebrows or kickers. Write in sentence case.
- **Don't** use decorative icons, icon tiles on feature lists, or any icon set other than Radix. Don't draw or approximate a brand's mark.
- **Don't** use monospace for figures, timestamps, labels or code-like decoration. It is for IDs only.
- **Don't** show customers, logos, testimonials or results that do not exist, or unlabelled sample data.
- **Don't** add decorative squares, ruled grids or pattern fills. The sky, the sun and the water are the only decoration.
- **Don't** bring the sky gradient, sheets or display-width type into the app's working surfaces beyond the rail and the CloseHorizon.
