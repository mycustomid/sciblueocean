# SCI BLUE OCEAN · HOTEL OS — Interactive Demo

**Purpose:** a fictional hotel/property-management dashboard prototype, **not** an operational hotel system. The public luxury/La Roseraie site has **not** been modified. This is an independent replacement concept for the hotel management experience.

## Open immediately — no dependencies

Open `standalone/index.html` in a browser. It uses bundled CSS and JavaScript only. All demo changes persist in the browser's `localStorage` (same browser/profile only). For best results, host `standalone/` over an HTTP server, e.g. `python -m http.server 8080 -d standalone` and visit `http://localhost:8080`.

## Astro 5 project

```bash
npm install
npm run dev
npm run build
```

Uses Astro 5 + Tailwind v4 Vite plugin; zero React hydration needed. Astro's page uses accessible semantic HTML and plain JavaScript for the interactive dashboard. Styling is custom CSS so the no-install standalone build works too.

## Roles (UI simulations, not authentication)

- **Direction:** overview, rooms, reservations, calendar, guests, invoices, housekeeping, operations, reports, settings.
- **Réception:** overview, rooms, reservations, calendar, guests, invoices and housekeeping (no operations/reporting/settings).
- **Gouvernante:** overview, rooms, calendar, housekeeping and operations; changes are limited to room/housekeeping actions.
- **Comptabilité:** overview, reservations, calendar, invoices, reports; handles payment tracking and printing.

Role switching *does not authenticate or protect data*. Don't enter real PII. Do not deploy with guest information or public admin exposure.

## Features

- 24 fictional rooms; rooms dashboard and status workflow
- Create reservations with date and room availability checking; check-in, check-out and cancel
- Calendar with month navigation, arrival/reservation filter
- Fictional guest directory; filter and add guest with basic validation
- Quote/proforma builder with optional **sample** TVA at 19.25%, deposits/payments, print-to-PDF layout
- Housekeeping checklist and operations status controls
- Derived dashboard KPIs; basic chart; CSV/JSON exports; reset demo state
- French-first, 1-click English toggle; mobile sidebar/drawer; accessible labels and status feedback
- Data persists only in localStorage; no network calls and no real access control

## Explicit limitations

Not a true PMS, no server authentication, booking engine, payment processor, database, audit-compliant logs, multi-user sync, verified tax compliance, accounting exports or live room/operations monitoring. All hotel data, counts, identities, prices and performance metrics are fictitious. The identity SCI BLUE OCEAN is used **only as a proposed project label**, not confirmation the company operates a specific hotel. `sciblueocean.com` was not available for reliable visual/content extraction at build time. The wave emblem is original placeholder artwork.

The 19.25% VAT setting is a UI example, not an opinion on which tax regime applies. Obtain approval from a Cameroon tax/accounting professional before using any real invoice.

## QA checklist

- Run `node --check public/app.js`, `npm run build` after dependencies are installed
- Test roles, FR/EN, and 390px mobile navigation
- Test reservation conflict, cancel and room statuses
- Test print preview, JSON/CSV download, reset and reload persistence
- Browser E2E tests in `tests/smoke.py` (optional, requires Python Playwright)

## Deployment safety

**DEMO ONLY** prominently displayed. For production add server-side authentication, RBAC, audited APIs, database with transactions/double-booking constraint, user isolation, backups, financial/legal configuration, observability, and security tests. Merely hiding UI is not protection.
