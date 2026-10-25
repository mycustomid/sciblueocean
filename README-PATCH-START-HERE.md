# SCI BLUE OCEAN — FULL GUEST & STUDIO REDESIGN MEGA PATCH

**Release date:** 2026-10-26. **Baseline target:** `mycustomid/sciblueocean@587a00a77ab5397ed7ec657aa394a48dbfefa6a7`. **Not deployed, not pushed.**

This replaces the previous small guest booking patch as a **full design-system + route + local-operational-demo package**. It does **not** replace your existing ERP source or magically connect to a real PMS. A complete booking interface, property collection, and 13 designed staff route templates are included with a working **loopback-only Python/SQLite demo** for selected workflows.

## What is actually in this ZIP?

- 17 guest pages: home, collection, three residence details, search, booking request, my booking, login placeholder, sign-up placeholder, contact, FAQ, policies, editorial, location, monthly living, brand story.
- 13 distinct Staff Studio pages: sign-in, dashboard, reservations, availability calendar, arrivals/front-desk, guests, housekeeping, folios, maintenance, reports, property portfolio, 9 businesses, roles, and integration settings (13 pages after login + sign-in = 14 URLs).
- Bespoke dual design systems: **guest** (editorial hospitality, photographic, open light backgrounds) vs **staff** (functional dense operation with dark vertical rail and airy white workflows).
- No fake confirmations: guest booking requests persist to an isolated SQLite database; hotel staff can confirm non-overlapping stays and change actual demo reservation state; housekeeping/maintenance/folio demo functions persist. 15 integration tests pass.
- Local-original trademark/logo file from current GitHub repo, kept for brand review. New monogram treatments are proposed creative work, not official trademarks.
- Optional untouched-integration Frappe app source from previous ERP checkpoint in `integrations/frappe/`; **not installed, not verified against Kamra**.
- Documentation, dry-run apply script, route/control inventory, executable API tests and QA logs.

## Demo — direct local startup

Requires **Python 3.10+**; no npm/Docker needed to test static UI + operational demonstration.

```bash
python demo-server/server.py --port 8765
# Browser: http://127.0.0.1:8765/experience/
# Staff:   http://127.0.0.1:8765/studio/
```

The staff demo password is `demo-only-change-me` and the role is selected on the login form (**only on 127.0.0.1**, do not publish the demo server). Users: `reception`, `manager`, `housekeeping`, `finance`, `maintenance`, `owner`. Sessions are verified server-side; switching the role on the interface is disabled. For private local trials, set `BLUE_OCEAN_DEMO_PASSWORD` to your own throwaway value.

Demo public request: `/experience/booking/`; after submitting, lookup at `/experience/manage/` using the reference and entered email. The data is synthetic. There are no real payment endpoints or real bookings. To reset the demo, stop the server and remove `demo-server/demo.sqlite3` after backup.

## Install into audited repo

```bash
bash scripts/apply.sh /path/to/sciblueocean --dry-run
bash scripts/apply.sh /path/to/sciblueocean --apply
cd /path/to/sciblueocean
npm ci
npm run build
```

The script refuses an unrecognized HEAD or dirty working tree and never commits, pushes or deploys. Files created are in `public/experience/`, `public/studio/`, `public/favicon.svg`; only original `src/pages/index.astro` is replaced, with a timestamped backup. Old `/workspace/`, Rust backend, existing Vercel API and others remain untouched. On Vercel static hosting, demo API paths **are not included**: the Studio must not be represented as production-connected. See `docs/INSTALL-AND-ROLLBACK.md`.

## Important production limitations

| Area | Status |
|---|---|
| Page/source generation, route audit, JS syntax | PASS |
| Local demo DB read/write and role protection | PASS (15 tested API cases) |
| Multi-property live inventory / Kamra PMS | NOT CONNECTED |
| Real guest account, identity emails | NOT IMPLEMENTED |
| Cameroon payment gateway + real transactions | DISABLED |
| Astro npm dependency install/build | NOT RUN (network unavailable) |
| Chromium visual tests | BLOCKED (sandbox browser access restriction) |
| Official photo URLs live accessibility | NOT VERIFIED; fail gracefully to designed fallback |
| Full EN editorial translation | INCOMPLETE; FR master + EN navigation only |
| Live-domain visual parity | NOT CERTIFIED |

Use only as a staging-reviewed additive patch, never as proof that payment or ERP processes are production-ready.
