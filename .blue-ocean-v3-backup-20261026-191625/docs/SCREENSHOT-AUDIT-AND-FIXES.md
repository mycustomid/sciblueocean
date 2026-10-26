# Screenshot-based design audit

Uploaded screenshots from 2026-10-26 were used as regression anchors, not as proof of runtime success.

| Screenshot scene | Root cause | Source fix | Visual acceptance not yet executed |
|---|---|---|---|
| Homepage 03/04/05 | HTML used `.feature-story`, `.neighborhood-feature`, `.home-contact` without defined rules | Responsive 50/50 visual-editorial grid; proper text spacing and background; full-bleed neighborhood media | Chromium desktop/mobile blocked |
| Hero booking bar | Small glyph-only navigation, inconsistent inputs | Rounded search shell, larger touch targets, focus-within, calendar and search icons | Browser interactions not run |
| Miague details | `.property-gallery`, `.detail-layout`, `.detail-block`, `.detail-booking`, `.amenities-grid`, `.detail-notes` missing CSS | Gallery mosaic, two-column content+price card, proper amenity grid, tables, consistent labels | Browser interactions not run |
| Monthly living | Story cards not styled consistently | Editorial grids and project status components; projects are still under construction | Responsive screenshots not run |
| Bonapriso and Our story | Large empty areas without content-grid constraints | 2-column editorial/story/photo with responsive stacking | Responsive screenshots not run |
| Language nav | FR/EN treated as primitive switch and translated nav only | Disclosure menu with French and English preview, persisted and keyboard-controlled | UI still partially French; full EN backlog |
| Generic monogram/logo | `B.` custom icon not original | SCI logo from user's repo commit, locally served; replaced in header, Studio and footer | Visual QA pending |
| Payment | No guest payment journey, no data model | `/experience/payment/`, `/studio/payments/`, server-side intent and role-gated simulated settlement, PSP adapter | Live merchant API blocked by onboarding |

**Important:** Photos from HEAD include real Miague and architectural visualisations Ebène and Amara. Do not label construction renders as completed units. CSS and route audits are not substitutes for real Playwright pixel review.
