# SCI Blue Ocean — Staff access security design

Date: 2026-10-28. Status: DESIGN, not deployed or implemented production authentication.
Scope: staff access to reservations, stays, housekeeping and finance. Existing public guest booking remains separate.

## Decision

Keep a visible “Connexion personnel / Staff login” entry to /studio/. A discoverable URL is acceptable; hiding it is not an access control.
Use invite-only individual staff identities with mandatory MFA through a maintained OIDC identity provider. Prefer passkeys/security keys; support authenticator TOTP through the provider with controlled recovery. No public staff sign-up, shared passwords, or client-selected roles. Provider/tenant and verified staff emails still need configuration before implementation can be activated.
Reuse the Rust/Postgres authorization and business layer after reviewing its property scope. Add a same-origin staff backend-for-frontend (BFF) which keeps upstream credentials server-side. Do not connect the production Studio to /api/demo, and do not issue a production session from the existing password login without MFA.

## Current evidence and gaps

- public/studio/assets/studio.js uses /api/demo and a local role/password login. It is not production staff auth.
- demo-server/server.py defines a shared demo password and role identities; serve() refuses non-loopback hosts. Keep it isolated. Do not expose via tunnel, reverse proxy, or a production deployment.
- backend-rust/src/auth.rs already verifies Argon2 hashes, uses random opaque bearer tokens stored as SHA-256 hashes, checks active users/memberships and session epoch, expires tokens after eight hours and revokes logout sessions. Login failures are limited per entity/email.
- The Rust auth module is not yet an MFA-backed browser-cookie login. Its bearer response must not be copied into localStorage as a Studio integration shortcut.
- lib/policy.js disables record reads and writes on the public demo by default; it is not a production staff identity service.
- Existing 34 Python integration tests cover local demo permissions and booking transitions. They do not certify a deployed production staff system.

## Browser and server flow

1. Public website -> /studio/ login. A static shell may be visible; staff data is never embedded in HTML or public JavaScript.
2. “Connect as staff” -> BFF -> identity provider using Authorization Code + PKCE, one-time state and nonce, exact registered callback URLs, short-lived login transactions. No arbitrary return URLs.
3. Provider authenticates the person and enforces enrolled MFA. Server verifies issuer, signature, audience, expiry, nonce and the configured MFA assurance policy. Missing assurance fails closed.
4. Map immutable issuer+subject to an active staff record and explicitly assigned property memberships. A verified email or successful provider login alone grants no staff access. Never assign a role from form values, query strings or identity-provider self-editable metadata.
5. BFF issues a random opaque session cookie on HTTPS: __Host-bo_staff, Secure, HttpOnly, SameSite=Lax, Path=/, no Domain. Store only its hash in the server database. SameSite=Lax supports the top-level OIDC redirect; also validate CSRF on every state-changing staff request.
6. Studio calls same-origin /api/staff/* with the cookie. Each request checks active account, membership, session epoch, expiry, role, property scope and resource ownership. No browser-held upstream bearer token.
7. A permitted booking action commits its state change and audit event together. Re-read availability with transactional concurrency protection before confirmation. Failed authorization produces no mutation.

## Staff lifecycle and permissions

Invites are single-use, bound to the intended verified identity/email, expire within 24 hours and are stored as hashes. Only a designated identity administrator can invite or change access; ordinary managers cannot grant themselves finance or identity-admin privileges. First administrator is provisioned out of band with MFA; no default admin password.

| Staff role | Permitted work | Restricted work |
| --- | --- | --- |
| Reception | Assigned-property requests, confirmation/cancellation under policy, check-in/out | Staff administration, refunds, unrestricted finance exports |
| Housekeeping | Assigned room tasks and minimum occupancy context | Guest contact details, payment data, other properties |
| Maintenance | Assigned maintenance work | Booking finance and guest identity |
| Finance | Assigned-property folios and reconciled payment records | Granting access or independently approving own exceptional refund |
| Property manager | Assigned-property operations, approved exception workflow | Automatic group-wide access and identity administration |
| Owner/auditor | Explicitly assigned reporting, read-only by default | Daily mutations and automatic unrestricted guest exports |
| Identity administrator | Invite, disable, scope/role changes with audit and MFA reauthentication | Automatic authority to settle payments or approve refunds |

Map these business roles explicitly onto Rust backend permissions; do not blindly equate similarly named roles. Database queries must constrain property/entity as well as record ID. UUIDs do not replace authorization.

Disable/offboard staff by revoking all sessions and incrementing session epoch. Enforce this on the next API request. Require recent MFA reauthentication for role changes, sensitive exports, identity recovery and refund approval. Recovery must not bypass MFA; use provider recovery controls, offline recovery codes and verified admin procedures with notification and audit. Never use security questions.

## Session and attack controls

- Initial application policy: 20-minute idle timeout and 8-hour absolute expiry; server-enforced, no silent extension past absolute expiry. Rotate session on login, privilege changes and reauthentication. Logout revokes server session before clearing cookie; offer revoke-all-devices.
- Rate-limit login initiation/callback, account recovery, invitation and MFA verification. Apply account and IP/global limits with bounded storage; use progressive delay/cooldown, not permanent account lockout that allows denial of service. Proposed initial threshold: 5 account failures/15 minutes plus a separate IP limit, calibrated in staging. Trust forwarding headers only from the configured ingress.
- Generic login/recovery errors, bounded request sizes, no token/password logging. Keep authentication and identity-provider secrets out of frontend bundles and source control.
- For mutating cookie-authenticated requests: CSRF token plus exact Origin validation; reject cross-origin writes. No state-changing GET. SameSite and CORS are additional layers, not substitutes for authorization.
- HTTPS through the approved ingress; database and internal Rust service private. Exact allowed origins, no wildcard credentialed CORS. Staff responses Cache-Control: no-store, private; exclude staff routes/API from shared CDN or service-worker caches.
- Render guest-provided names/notes as text or properly escaped HTML; enforce CSP and deny framing. Authentication cookies do not remove the need to prevent XSS.
- Audit actor, entity/property, action, target, timestamp, request ID and result; redact credentials, tokens and guest details. Alert on repeated failures, suspicious recovery and role changes. Restrict audit deletion/updates and access.
- Back up encrypted production data and verify restoration. Minimize guest-data visibility; no full database snapshot in frontend.

## Release acceptance (required evidence)

1. Unauthenticated direct staff API request -> 401; authenticated wrong-role or wrong-property request -> 403/404 without guest data or mutation.
2. Direct /studio/bookings/ navigation without session shows login; the API still independently denies access with JavaScript disabled or bypassed.
3. Public sign-up, edited role/tenant payloads and a valid but uninvited provider identity cannot create staff access.
4. Missing MFA assurance, reused invitation/callback, expired state, wrong issuer/audience and invalid redirect fail closed.
5. Brute-force and recovery limits hold, including concurrent requests; errors do not reveal account existence.
6. Inspect real HTTPS cookies and verify no session/upstream bearer exists in localStorage, URLs, logs or bundles.
7. Idle/absolute expiry, logout, disable-user, role removal and revoke-all terminate access server-side.
8. Missing/invalid CSRF and hostile Origin writes fail; role/property ID tampering fails for every read, mutation and export.
9. Guest submits request -> assigned staff logs in with MFA -> sees only that property's request -> confirms -> DB/audit reflect the same action; unauthorized staff cannot repeat it.
10. Verify production ingress, identity-provider recovery policy, frontend/API integration and restored backup in staging before live activation. A build, screenshot or SAST pass alone is insufficient.

## Implementation order

A. Configure identity-provider tenant, staff invitations and mandatory MFA; choose the real staff identity administrator and verified accounts. No actual invitations sent by this design task.
B. Implement OIDC/BFF session storage and CSRF, integrate immutable staff mappings with Rust authorization, and close any direct password-only path for production staff.
C. Map property permissions, connect Studio to /api/staff, implement lifecycle/recovery/auditing and the release tests above.
D. Verify on HTTPS staging with synthetic bookings, then activate the approved production deployment. Leave /api/demo local-only.

## Primary guidance

- https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html
- https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html
- https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
- https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html

No claim of being impossible to hack. The acceptance evidence above is required before describing production staff login as operational.

## Additional source audit: concrete implementation blockers

- backend-rust/src/auth.rs:49-61 checks and updates login failure counters separately; parallel attempts can pass the check together. Make attempt reservation/rate limiting atomic, bound global verification concurrency, and run expensive password verification outside async executor threads before keeping any password-based login path.
- backend-rust/src/auth.rs:13 scopes identity to entity, not individual property. backend-rust/src/hospitality.rs:17-19,32-34,47-49 constrains legal entity but can read multiple properties inside it. Add explicit property assignments and filtering before giving reception property-limited access. This is a scope design gap, not proof of cross-entity IDOR.
- backend-rust/src/routes.rs:18 itself reports production_ready:false. No deployment readiness claim follows from existing authentication code.
- Existing session revocation triggers in backend-rust/migrations/0012_rc17_security_governance.sql:7-17 are useful foundations; verify them with actual Postgres integration tests when implementing the BFF.

Audit method: read-only source inspection; no production penetration test, Rust build, or live deployment performed for this design task.
