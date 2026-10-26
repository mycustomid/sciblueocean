# SCI BLUE OCEAN — V3 BILINGUAL GUEST + PAYMENT INTEGRATION MEGA PATCH

Prepared: 2026-10-26 · target GitHub repo `mycustomid/sciblueocean` HEAD `e59bb497a94cf91a59798d45dce322d185346735`.

**This ZIP is a cumulative replacement for V2. Install ONLY V3; do not overlay V2 again.** No GitHub push or deployment done.

## What is genuinely new

- Fully authored bilingual **FR and EN static pages for all 18 guest routes** (36 route files), rather than partial JS text-node replacements.
- Language switch has route parity for deep pages; logo and original building photos come from the actual SCI project assets.
- Rebalanced hospitality layouts for desktop/mobile: search/results, cards, room gallery, monthly living, Bonapriso, policies, contact, FAQ, local guest flows, and payment panel.
- Functional **local demo**: SQLite booking creation/lookup, staff confirmation, stay estimate, interest sign-ups for Ebène/Amara, guest enquiry persistence, booking status and test payment intent.
- Flutterwave **v3 Standard** hosted checkout provider adapter and transaction verification, with optional **test-only** bridge requiring client test key and HTTPS callback. No real funds charged by default.
- Merchant registration checklist and business/technical handoff: `docs/CLIENT-FLUTTERWAVE-ONBOARDING-2026-10-26.md`.
- Existing staff Studio and legacy ERP pages remain in the patch as V2 baseline — they are **not** a claimed live PMS integration.

## Preview locally without npm

```bash
cd SCI_BLUE_OCEAN_V3_WORK  # the extracted ZIP root; directory may be renamed
python demo-server/server.py --port 8765 --db /tmp/blue-ocean-demo.sqlite3
```

- FR: http://127.0.0.1:8765/experience/
- EN: http://127.0.0.1:8765/experience/en/
- EN property: http://127.0.0.1:8765/experience/en/stays/miague/
- Studio: http://127.0.0.1:8765/studio/

Use test/demo data only. This loopback server is not safe for public Internet exposure.

## Installing to local clone of *current* GitHub repo

```bash
bash scripts/apply.sh /path/to/sciblueocean --dry-run
bash scripts/apply.sh /path/to/sciblueocean --apply
cd /path/to/sciblueocean
npm ci
npm run build
```

Installer refuses unexpected HEAD or dirty git tree, backs up overwritten files, and never pushes or deploys. If HEAD changed, re-audit diffs before changing expected commit.

## Tests

```bash
python scripts/build_v3.py          # regenerate all FR/EN guest routes
python scripts/qa_v3.py             # locale, image, link, icon audit
python -m unittest discover -s tests -p 'test_*.py' -v
python -m unittest discover -s test -p 'test_hosted_v3.py' -v
node --check patch/public/experience/assets/site-v3.js
```

## Critical limitations

- Only Miague's private studio accepts reservation requests; **Ebène and Amara are under construction**, available for non-binding pre-rental interest only.
- Confirmed booking ≠ payment received. Payment reconciliation MUST verify with provider API before paid state.
- **No real merchant connection or live payment** is included; client KYC, test keys and HTTPS staging backend are mandatory.
- Live guest accounts, bank settlements, PMS room inventory and actual Vercel serverless integration are **NOT CONNECTED**. Public static Astro alone cannot use the local demo API in production.
- Browser screenshot QA was blocked by administrator policy in this sandbox. The packaged source, functional unit tests and HTTP routes are not proof of 100% visual quality.
- Refer to `QA/RELEASE-READINESS-V3.md` for precise PASS/BLOCKED/NOT RUN and `docs/V3-FEATURE-PARITY-AND-GAPS.md` for original-site parity.
