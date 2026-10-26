# SCI Blue Ocean — V4 Booking, Revenue & Discovery Mega Patch

**Date:** 27 October 2026. **Baseline:** `mycustomid/sciblueocean` at `2bea7a1652222e2e95f17640755f08955a77686c` (V3 commit). Target is **existing SCI repo only**; Blue Line holding remains untouched. No automatic git push or deployment. V4 supersedes V3. This archive includes the V3 guest/static studio scaffold plus the V4 overlay.

## What's implemented

- Server-authoritative `GET /api/demo/public/quote` with an integer-XAF nightly breakdown, date/guest validation, availability check, individually configured nightly rate overrides and non-invented taxes (NOT CONFIGURED by default). One date range is a checkout-exclusive stay; 3 nights at 40,000 FCFA/night are estimated at 120,000 FCFA BEFORE unverified taxes and fees.
- V4 live pricing UI on every FR/EN search/booking form, including property detail/quick search; a clearly labeled 40,000 FCFA/night static estimate when backend is offline (never presented as payable or confirmed). A new admin `/studio/pricing/` allows Manager-only demo rate overrides and inventory blocks, enforced by API server role/CSRF. The demo DB persists and retests rates in actual booking creation.
- Demo availability prevents confirmed-booking overlaps and blocked inventory. Guest booking remains `pending` until staff confirms. Only Miague studio may receive booking requests; Ebène and Amara take interest requests only.
- Existing V3 FR/EN 18 route pairs, guest booking, folio, front desk, payments, house-keeping, contact and lead flows preserved. Anonymous conversion funnel is **opt-in**, whitelist-only, and tracks no guest identity.
- Existing Flutterwave v3 hosted-payment adapter requires explicit test credentials and a configured HTTPS callback. Payment is created only after staff booking confirmation, with amount from the server-owned booking snapshot. `FLW_SECRET_HASH` v3 webhook header verification and provider re-verification are required. Test-only; live payments not enabled.
- SEO preparation script sets canonical, reciprocal hreflang and staging `noindex` by default. Real sitemap/public indexing only generated after verified ownership, domain selection and explicit `--publish`.

## Honest environment scope

**The standalone `demo-server/` is a LOOPBACK-ONLY Python + SQLite test harness, not production PMS, not deployable as Vercel static functions.** No real accommodation inventory, approved tax law, authenticated guest accounts, verified maximum occupancy, PSP merchant keys, live analytics integrations, email/WhatsApp delivery or real payment settlement. The production site must use a separately deployed authenticated booking/PMS service with concurrency safeguards and live merchant checkout verification. See `docs/RELEASE-AND-GAPS-V4.md`.

## Test the ZIP locally

```bash
python3 -m unittest discover -s tests -p 'test_*.py' -v
python3 -m pytest tests/test_pricing_v4.py tests/test_demo_api.py tests/test_guest_v3_api.py test/test_hosted_v3.py test/test_payment_workflow.py -q
python3 scripts/audit_v4.py
python3 demo-server/server.py --port 8765
# Guest: http://127.0.0.1:8765/experience/en/
# Admin: http://127.0.0.1:8765/studio/ (demo role manager)
# Pricing: http://127.0.0.1:8765/studio/pricing/
```

Original `README` V3 also has demo credentials; set `BLUE_OCEAN_DEMO_PASSWORD` locally instead. Do not use an old default password on a shared machine.

## Apply (additive overlay to checked-out repository)

```bash
bash scripts/apply.sh /path/to/sciblueocean --dry-run
bash scripts/apply.sh /path/to/sciblueocean --apply
cd /path/to/sciblueocean
npm ci
npm run build
```

Installer refuses any HEAD other than the verified SHA and any dirty working tree. It checks original client logo/photo bytes before proceeding and never replaces those assets. Backup saved in `.blue-ocean-v4-backup-*` in the local checkout. Your repository must remain clean before attempting install.

**Production SEO:** do not publish the preview domain as canonical by default. After domain ownership/approval and completed page/legal review, run `python3 scripts/prepare_seo_v4.py --origin https://APPROVED_DOMAIN --publish`, inspect `robots.txt`, canonical and sitemap diff, then use the installer. Without `--publish`, staging is `noindex`.

**Live payments:** do not turn on checkout merely by adding keys in the browser. Use test keys on an HTTPS test backend, verify mobile money availability from Flutterwave merchant dashboard, register v3 webhook `verif-hash` secret and return URL, test webhook replay & pending states, then obtain client written authorization for live cutover.

## Proof

Read `QA/V4-TEST-RESULTS.log`, `QA/V4-STATIC-AUDIT.log`, and `docs/RELEASE-AND-GAPS-V4.md`. Browser screenshot tests are marked BLOCKED because Chromium reports `ERR_BLOCKED_BY_ADMINISTRATOR` on local addresses. No screenshot or npm/Astro full checkout build is claimed.
