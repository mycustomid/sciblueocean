# V4 Release / Gaps — 27 October 2026

| Component | Status | Evidence / next gate |
|---|---|---|
| Date price quote, nightly XAF integer arithmetic, role-based rates | PASS local SQLite API | `tests/test_pricing_v4.py` |
| Confirmed overlap + manager-defined inventory blocks | PASS local SQLite API | Pricing API tests |
| FR/EN routes + V4 UI assets | PASS static link audit | `scripts/audit_v4.py`; not browser-reviewed |
| Booking estimates resistant to client price tampering | PASS local SQLite API | `tests/test_pricing_v4.py` |
| Previous V3 operations + test-only provider | PASS local regression tests (scope-specific) | QA pytest log |
| Real PMS/ERPNext/Kamra integration | NOT CONNECTED | Replace isolated demo SQLite; define signed canonical quote and inventory integration |
| Legal lodging tax, mandatory service charge, refunds/cancellation policy | BLOCKED | Obtain company/legal-approved rule book, avoid representing estimate as final |
| Actual studio occupancy maximum | BLOCKED | Property manager must confirm maximum allowed guests |
| Vercel static API or production hosting | NOT VERIFIED | Configure separate authenticated service + secrets manager + TLS + backups |
| Flutterwave merchant account and live settlement | BLOCKED | Merchant onboarding, mobile money enablement, end-to-end sandbox then live sign-off |
| Real guest accounts/password reset + privacy permissions | NOT IMPLEMENTED | Auth service and rate limits; do not use reference/email lookup as production identity |
| Analytics retention/consent policy | DEMO opt-in only | Privacy policy/legal review and durable production consent system |
| Browser screenshots / mobile visual inspection | BLOCKED | Chromium ERR_BLOCKED_BY_ADMINISTRATOR; run Playwright in developer environment |
| Astro `npm ci` + `npm run build` in real repo | NOT RUN here | Run in actual GitHub checkout after installer dry-run |
| Production SEO indexing | GATED | Confirm site ownership; `prepare_seo_v4.py --publish`, Search Console, sitemap |

**Integrity != production readiness.** All source tests must be repeated against the actual deployed stack. Security-critical guest operations currently do not meet production expectations; do not deploy this demo server to the internet.
