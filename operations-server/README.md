# SCI Blue Ocean local operations

This is a persistent, individual-account **local** operations service for Miague's 25-room inventory. Availability is date-based and computed from pending, confirmed and in-house bookings; pending requests temporarily hold a room. Inventory is not synchronized with an upstream PMS. It has no synthetic reservations, no public staff registration, and no shared-role login. Payment processing and external notifications are not configured. This is not an internet production deployment or a multi-property PMS.

Use the project virtual environment under `D:\code\sciblueocean\.venv-operations` and install `requirements.lock.txt` for the verified package versions (`requirements.txt` declares supported version ranges). Run from the project root:

```powershell
.\.venv-operations\Scripts\python.exe operations-server\app.py create-user --username bos --role manager
.\.venv-operations\Scripts\python.exe operations-server\app.py serve --port 8766
```

The password prompt requires at least 16 characters. Noninteractive provisioning reads one password line from stdin; never put the password in shell arguments. Existing usernames cannot be overwritten.

Open `http://127.0.0.1:8766/studio/`. Sign in with your individual username and password; roles come from the server database. There is no authenticator or OTP enrollment. Previously issued sessions are revoked once during migration to this authentication policy. The retired MFA endpoints return 410 without revealing secrets.

The private SQLite database lives in `operations-server/private/`, outside `public/`. Restrict filesystem access to the operator account and encrypt backups. Passwords use Argon2 hashes; session tokens are stored only as SHA-256 hashes. Legacy authenticator seeds are cleared during the policy migration and are not used. CLI `reset-password --username NAME` reads a replacement password from stdin or the hidden prompt and revokes existing sessions. No unauthenticated HTTP password recovery exists.

After 10 cumulative failed password guesses, the actual remote IP is permanently blocked with HTTP 403 and IP_PERMANENTLY_BLOCKED. Failures and bans persist across time and server restarts. No automatic unblock is scheduled. Account failure counters also limit distributed guesses. Successful logins do not consume failure quotas. Verification admission and failure increments are serialized transactionally, and expensive hash verification has a concurrency bound. Forwarded IP headers are not trusted. This is an application-level cooldown, not a permanent firewall ban.

CLI `disable-user --username NAME` disables access and revokes current sessions. `revoke-sessions --username NAME` revokes all sessions without disabling the account. Session persistence survives server restarts, subject to idle/absolute expiry and account state.

Guest requests require a phone number. After a request is saved, the page displays the dummy test account `1234567890` and opens WhatsApp chat `+62 812-9636-1446` with the booking reference, dates and indicative amount prefilled; the guest must attach the transfer proof manually. The account is fictional and must never receive a real transfer. Reception verifies the proof in WhatsApp, selects one of 25 currently free rooms in Studio, then confirms. Room conflicts are rechecked transactionally; this transfer flow does not modify or remove the separate payment-provider integration.

Staff API: `/api/staff/login`, `/session`, `/me`, `/logout`, `/snapshot` and authorized booking/task/maintenance/pricing mutations. JSON writes require `X-CSRF-Token`; Origin and Host are checked. Public guest API is `/api/booking/public/*`. Guest reference+email lookup is rate-limited and returns limited booking fields. Guest booking submission accepts `Idempotency-Key` or `request_id` (16–128 characters): retries with identical details return the existing receipt; reusing a key for different details returns 409. Both reservation creation and idempotency persistence use one write transaction. Confirmations recheck concurrent inventory conflicts transactionally.

The service refuses non-loopback binding. It deliberately uses a non-Secure cookie on local HTTP; the production design requires reviewed HTTPS ingress, Secure cookies, appropriate trusted host/origin configuration, backup/restore and recovery procedures, real property inventory/capacity/rates verification, and internet abuse controls before exposing it publicly. Do not tunnel this local service. Do not present a local data submission as a production website receipt.


Permanent IP ban recovery is local-admin only: `.\.venv-operations\Scripts\python.exe operations-server\app.py unblock-ip --ip 127.0.0.1 --username ACCOUNT`. Replace IP/account as appropriate. This removes the ban and failure counters; it never changes the password. There is no HTTP endpoint for unbanning. Shared/dynamic IPs can affect legitimate users, and switching IPs can evade an IP-only ban. Current loopback proxies share a source address; internet deployment still needs reviewed ingress source attribution.
