# SCI Blue Ocean — Hospitality Booking + Operations Studio — UI/Payment Corrective Mega Patch

**Edition:** 26 October 2026 • **Target repo:** `mycustomid/sciblueocean` • **Audited HEAD:** `c0c3eda9be41dc574e9b09e51654436d50a88031`

**Deliverable:** Source overlay and self-contained loopback demo, NOT a live deploy. No push/deploy to GitHub or production. This revises the original ZIP of the same day; do not stack ZIPs. It preserves current brand/photo commit and does not alter the 9-product ERP or Rust backend.

## What changed from screenshot feedback

1. Found 77 class names used in guest templates without CSS definitions. Added `refinement-v2.css` with responsive layout for property gallery, 2-column editorial story, booking/detail, Bonapriso, monthly, footer and section typography. Missing styles after correction: seven state/utility names; no major layout selectors missing.
2. Replaced fabricated `B.` brand mark with the official SCI Blue Ocean logo **already committed by the repo owner**, under `public/experience/assets/original-sci-logo.png`. Kept existing published imagery from newest GitHub HEAD, using **local paths only**.
3. Converted simplistic FR/EN switch to accessible disclosure menu with radio-like language choices, keyboard/Escape and persisted selection. Essential interface text/navigation gets an English preview; legal/editorial content remains **FR-first**. Do not claim full translation completeness.
4. Authored local SVG symbols for search, calendar, guests, property amenities, wallet, safety, payments and Studio navigation.
5. Added `/experience/payment/` (lookup → approved booking → payment intent) and `/studio/payments/` (Finance/Manager test settlement), with server-side checks and SQLite state. **Payment gateway live is NOT connected.** No real debit occurs.
6. Added Flutterwave Cameroon XAF adapter with independent transaction validation and signed webhook-header check; it is intentionally not wired to execute on this demo server. Operator onboarding and production compliance required.
7. Added unit tests for PSP adapter, API booking→confirmed→intent→settled simulation and cross-role/CSRF/idempotency controls.

## Run locally (NO real guests, only synthetic data)

```sh
cd SCI_BLUE_OCEAN_UX_PAYMENT_V2_MEGA_PATCH_2026-10-26
python demo-server/server.py --host 127.0.0.1 --port 8765
```

Open `http://127.0.0.1:8765/experience/` or `http://127.0.0.1:8765/studio/`. Demo login accepts the role identifiers `reception`, `manager`, `housekeeping`, `finance`, `maintenance`, `owner`; local-only password from `.env.example`. NEVER expose this process to the public. Demo data are synthetic.

The finance simulation is disabled by default. For explicit offline test only, set `BLUE_OCEAN_ENABLE_SIMULATED_SETTLEMENT=YES` on your localhost server before starting it. The API still requires Finance/Manager and a valid session CSRF token.

## Apply to new HEAD (after reviewing the dry-run)

```sh
bash scripts/apply.sh /path/to/sciblueocean --dry-run
bash scripts/apply.sh /path/to/sciblueocean --apply
cd /path/to/sciblueocean
npm ci && npm run build
```

The installer **rejects different HEADs, dirty trees, or modified original media**, backs up changed files, never touches `/workspace`, `backend-rust`, existing API or database, and never pushes/deploys.

## Release truth

- PASS: static link audit, CSS parser, JS syntax, 7 new automated payment/API tests, loopback HTTP route checks, original local media files/hash parity against connector-provided files.
- NOT RUN: Astro build on full checked-out GitHub repository; real desktop/mobile browser visual QA (`ERR_BLOCKED_BY_ADMINISTRATOR`), external production server, cloud environment.
- NOT CONNECTED: real merchant checkout, MTN MoMo/Orange Money settlement, Frappe/Kamra, auth for guest sign-in, email/SMS notifications.

See `QA/` and `docs/` for evidence and constraints. A static Vercel deployment alone cannot run this Python demo API.
