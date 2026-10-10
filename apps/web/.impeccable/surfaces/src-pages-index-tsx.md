---
version: 1
slug: "src-pages-index-tsx"
primary_target: "src/pages/index.tsx"
related_targets: ["src/components/layout/PublicLayout.tsx"]
---

# Landing (/)

Scope: the public marketing site's home page, plus the shared public chrome (PublicLayout nav and footer) that every marketing page inherits.
Visitor mode: Persuade.

Audience: controllers and finance managers at mid-size companies evaluating a spend-review tool before month-end close. Pre-launch: no customers, logos, testimonials or results exist; all product visuals use labelled example data.
Primary action: walk through the demo (/demo). Secondary: talk to us (/contact).
Proof: the product's own mechanism shown at work (a finding opened to its rows, baseline, rule and confidence; the reviewer's decision). Never claim live syncing or integrations.
Must not feel like: a generic AI startup (gradients, glow, "AI-powered"), or playful/casual.
Peers whose craft sets the bar: Linear, Mercury.

## Direction contract

THESIS: The category standard, played straight at Linear/Mercury craft: a confident headline over the real product at work. It refuses the category's abstract chart hero with invented savings, AI glow, and grids of identical icon cards. The page proves the mechanism with the interface itself.

OWN-WORLD (revised 2026-10-09 after the owner found the first build bland, chose the "ultramarine field"): an ultramarine field (#2440d6) owns the hero, page intros, logo strip and closing band, with white type, and the header sits on it until scroll. The signature is a live ledger scan in the hero, where flagged rows light up in their severity colour as they are caught. A strip of systems the product reads exports from scrolls on the field, and the findings inbox lifts over the field's edge. Below that it is light, A white canvas with cool tinted neutrals running to a near-black blue ink. One ultramarine accent for actions, links and focus only. Severity red, orange, amber and slate appear only on findings. Archivo set semi-expanded for display (echoing the extended wordmark), Archivo at normal width for body, and JetBrains Mono only for IDs and event names. Hairline borders, 6px controls, 10px product frames with a soft offset shadow. A single deep-ink band carries the human-decision story.

STORY: A controller sees that Ventura reads a spend export and returns a short ranked list of findings, each traceable to rows, with a person deciding. They believe it because each differentiator is demonstrated in UI: baselines, approval-limit clustering, period cut-off, the upload. They walk through the demo.

FIRST VIEWPORT: Nav: logo, Product, Security, Contact, Sign in, and a primary "Walk through the demo". A left-aligned two-line headline at about 64px with a one-sentence subline, the primary button and a "Talk to us" link. Under it, at full content width, the product frame: a findings inbox (left) and the open finding with its evidence rows, baseline and Resolve/Dismiss (right), labelled Example data. The frame enters the fold at about 60% of the height.

FORM: Category standard (the canon card, chosen by the user on the decision page), executed without irony; peers Linear and Mercury; seed key da23ab24. Signature interaction: selecting a finding in the hero inbox swaps the detail pane and highlights its evidence rows. Motion: one orchestrated hero entrance with an expo ease-out from a visible default, 160–220ms state transitions, and reduced-motion respected.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
