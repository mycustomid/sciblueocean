# RC6 Rust ERP architecture

## Decisions
- `Axum` HTTP backend, `Tokio` asynchronous runtime, `SQLx` parametrized PostgreSQL queries.
- One shared PostgreSQL operational core; users have membership in named legal entities. Each bearer session is **bound to one entity**, server enforced.
- Nine **ERP domain workspaces**, not automatically nine incorporated subsidiaries. Five operating business modules, three group shared services, plus holding.
- No fake production OAuth, live BEAC compliance, certified payroll, or Odoo integration claim.
- Node.js legacy handlers remain in the RC5 baseline for comparison; they are **not** Rust and must not be used for production accounting.

## Logical topology

```text
Corporate marketing site  bluelinecapitale (Astro/Vercel)
              | links
SCI ERP showcase           sciblueocean (Astro/Vercel)
              | pilot access (separate API origin; explicit allowlist)
Enterprise Rust API        Axum/Tokio, standalone Docker/Linux service
              | prepared SQL, transaction boundaries, connection pool
PostgreSQL 16+             company-scoped operational records, GL & history
```

## Service boundaries
`/health` tests DB connection; login issues randomly generated opaque session token; only its SHA-256 digest is stored. `POST /api/v1/records` accepts one record with a required idempotency key; `POST .../transition` updates status in a transaction with an audit event. `POST /api/v1/journals` creates balanced drafts and `.../post` posts only after checking a second user and accounting period; database trigger independently verifies balance.

## Trust boundaries
- No login = no module list, record list or GL access. `/health` is a minimal unauthenticated probe.
- Public self-registration and role-switching are absent.
- SQL uses bound values, plus entity conditions for all record retrieval and mutation.
- Role claim comes from DB membership, never a client-supplied role string.
- Tokens expire after 8 hours and can be revoked.
- Legacy role-select demo is NOT enterprise login.

## Known POC compromises
1. This is a **foundation**, not a complete ERP service; approval stages are shared and not fully domain-specific.
2. No refresh-token rotation, password reset/MFA, IP throttling, device/session management or SSO.
3. No Postgres RLS policy yet; tenant isolation is currently application-enforced with composite FKs as a schema backstop.
4. No automatic posting from hotel/FX/manufacturing events; GL is a standalone subledger pilot.
5. Integer-only XAF amounts: multi-currency accounting, FX exchange and reversals pending.
6. Single fiscal period locking primitive; no robust financial close engine, taxes or reconciliation.
7. CLI-only provisioning is an operations tool, not mature identity management.
8. Use staging only until Cargo checks, DB tests, privilege penetration tests and backup/restore work are completed.

## Hosting
Because this is a native Rust service, deploy on a server/container host with HTTPS reverse proxy or another Rust-compatible host. Keep marketing and ERP frontend deployments separate. Set the frontend API origin explicitly and enforce CORS allowlist, TLS, network restrictions, observability and database secrets. The Astro/Vercel deploy alone does NOT deploy Rust.

## RC7 evidence and maker-checker guard

Evidence reads are scoped to `auth.entity_id` at the SQL predicate on every route. Approval actors must be independent at each stage, and IT administrative role is not business approval authority. PostgreSQL 0002 adds composite references connecting child records to membership/tenant identifiers; this is **not database row-level security** and does not replace a least-privilege application DB role. The view `/rc7/` remains isolated from the legacy Node demo.
