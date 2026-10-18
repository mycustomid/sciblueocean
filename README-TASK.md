# SCI BLUE OCEAN — HOTEL OS | MASTER HANDOFF

## Project identity

- Repository suggestion: **`sciblueocean`** (independent from `la-roseraie-danne`).
- Product: **Hotel OS**, an interactive, purely fictional demonstration of hotel operations.
- Do not use branding, text, sample people or marketing assets from La Roseraie d'Anne.
- The real-world hotel relationship of SCI BLUE OCEAN is not confirmed. Do not describe demo capacities, prices, rooms, contacts, invoices, or performance as company facts.

## Architectural constraints

- Astro 5 for the static shell; progressive native browser JavaScript for stateful interactions; Tailwind 4 Vite plugin available for subsequent development.
- Static-first. No JS frameworks/hydration needed for the current dashboard.
- FR-first; English accessible through single-click toggle.
- XAF/FCFA for all price display; optional **illustrative** TVA 19.25% in proforma only.
- Accessible labels, keyboard support, responsive 390px/mobile to desktop.
- All sample data 100% fictional. No source of truth beyond local browser storage.

## Interface inventory

1. Dashboard overview and KPIs
2. Inventory of 24 demo rooms/suites
3. Reservation create, room/date conflict checks, check-in, check-out, cancel
4. Monthly calendar with date selection
5. Fictional VIP guest CRM
6. Proforma and deposit simulator + print/PDF via browser
7. Housekeeping task workflow
8. Operations and generator/security simulated statuses
9. Reports and CSV/JSON exports
10. Demo settings/reset

## UX roles

- `direction` — general management + all demo modules
- `reception` — room inventory, bookings, guests, basic billing review
- `housekeeping` — room/status, tasks, simulated operations
- `finance` — billing, reports, payment simulation

**Warning:** client-only role filters are not security controls. There is deliberately no login in this demo. Production requires actual server-side RBAC and persistence.

## Main code

- `src/pages/index.astro` — Astro frontend shell
- `public/app.js` — seed, events, validation, routing, role views
- `public/styles.css` — design system / responsive visual styling
- `standalone/` — immediately runnable static preview with matching assets
- `tests/smoke.py` — automated browser QA using Python Playwright
- `VERIFICATION.md` — test results and environment limitations

## Next stage for production (do NOT pretend already complete)

Secure sessions, user accounts, server RBAC, validated property list, PostgreSQL transactional reservation model, genuine invoices/tax settings, guest data protection, export control, backup/restore, real POS/payment integration, backend event audit and per-user scopes. A redesign of the static demo is not a substitute.
