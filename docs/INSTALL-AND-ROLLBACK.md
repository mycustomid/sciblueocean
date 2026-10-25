# Installation and rollback

## Requirements

Baseline `587a00a77ab5397ed7ec657aa394a48dbfefa6a7`; clean Git checkout; Node/Astro dependencies required for real site build. Script must be executed deliberately on your checked-out repo; no write through connectors.

`bash scripts/apply.sh /path/to/sciblueocean --dry-run` first, then `--apply`. The script creates `.blue-ocean-backup-YYYYMMDDHHMMSS/` in the target repository containing original `src/pages/index.astro` and `public/favicon.svg`. It refuses overwriting an existing `public/experience` or `public/studio` directory.

After copying, `npm ci && npm run build` and inspect built `dist/` for `/experience` and `/studio`. Use a temporary preview not production. Commit only after reviewing diffs; push and deploy are entirely manual. In the event of a failure restore saved files from backup and remove only newly-added `public/experience`/`public/studio` (after verifying that you added no newer work inside them).

**Critical:** The local Python demo server is loopback-only and intentionally cannot be hosted by static Astro output. Do not expose `/studio` as a live functional app until connected to a deployed, authenticated server with actual scoping, rate limiting, monitoring, data retention and storage. Static `/studio` will show offline/error state in Vercel when `/api/demo/*` is absent.

## Staging route to full operations

1. Verify official source media rights and URLs and switch to permitted local/CDN assets.
2. Recheck latest HEAD and patch conflicts; rebase if commit changed.
3. Configure real backend and session/cookie scopes, TLS, roles and audit.
4. Test Kamra (Frappe v16) property-specific methods on private staging, migrate demo flows intentionally (not automatic database copy).
5. Link XAF/Mobile Money gateway only after legal merchant verification; webhooks/reconciliation and refund tests.
6. Run browser E2E, Lighthouse, accessibility and responsive matrix; promote via normal CI/CD.
