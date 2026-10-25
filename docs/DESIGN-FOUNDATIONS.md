# Design foundations — bespoke, non-template

## Product distinction

**Guest (the experience):** Trust by calm materiality, architectural imagery and clean booking chronology. Primary canvas `#fdfcf9`, support `#f7f5f0`, navigational teal `#124f53`, restrained golden detail `#aa8b62`, ink `#152d30`. Georgia headings and DM Sans interfaces. Hero editorial typographic asymmetry, three property portfolio cards, booking band, roomy editorial sections. FR primary reflecting Cameroon market. No artificial ratings, reviews, badges or maps claiming exact geographic pins.

**Staff (the operations):** Professional work surfaces with differentiated information density, dark rail `#15343a`, white tables, neutral backgrounds, consistent status chips, server-backed actions. Design avoids nine almost-identical dashboards. Hotel operations are functional for selected demo flows; other industry processes explicitly non-connected.

**Airbnb patterns reused conceptually**: high quality media, direct date/guest search, clear price breakdown, detail right-rail, mobile collapse. No Airbnb copied assets or source code. Background reference: https://www.airbnb.com/help/article/39 and https://www.airbnb.com/accessibility/

## Property truth source

Source live property page as observed 25–26 October 2026 at https://sciblueocean.com/ : Résidence Miague studio request from 40,000 FCFA/night; Résidence Ebène under construction, pre-rental from 400,000 FCFA/month; Résidence Amara under construction, pre-rental from 450,000 FCFA/month. Do not treat monthly listings as available rooms. No online payment is currently collected at request stage; staff confirmation is required.

## UI safeguards

- Touch-target intent >=44px for primary actions; keyboard-accessible native dates, `:focus-visible`, semantic headings, status announcements, mobile drawer with Escape.
- Layout fluid 390px to 1440px; browser screenshots remain unverified due container browser policy.
- No fictitious testimonial, number of stars, hotel tax, regulatory logo, or fake card processing.
- Property photography references source-domain filenames and is **not included**: actual rights and URLs must be confirmed before production. Owned SCI logo from audited GitHub repo is bundled as a review/reference asset.

## Accessibility gaps before production

Verify focus trapping and backdrop behavior on dialog, full EN translations, non-visual date search parity, screen reader order, contrast, overflow at very narrow widths, reduced-motion and actual WCAG testing on live browser.
