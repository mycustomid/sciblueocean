# Production pricing contract and operations (design, not deployed)

Public `GET /api/pricing/quote?property=miague&checkin=YYYY-MM-DD&checkout=YYYY-MM-DD&guests=N` should return: `currency:XAF`, immutable quote ID, unit/property ID, check-in/check-out, nights, nightly-rate breakdown, applicable approved fees/taxes, availability snapshot, total payable, expiration timestamp and pricing rule revision.

Write `POST /api/bookings` with the **server-side validated** quote ID; lock/check actual unit inventory transactionally before holding or confirming a stay. A quote is not an inventory guarantee. Price/fees/taxes must be immutable for the confirmed booking or explicitly re-approved after change. Do not derive the payment amount from a frontend input. For promo codes, require admin-approved expiration and eligibility; do not invent discounts.

State machine: `quote → pending request → manager confirmed → payment awaiting → provider verified → paid`. Expired bookings, cancellation, payment retries, refunds and booking amendments require separate policies and idempotent settlement. The current local demo only supports a subset and is never evidence that production PMS availability is connected.

Miague: public baseline 40,000 FCFA/night. Ebène and Amara: under construction, do not return booking quotes for immediate stays. Studio capacity is **UNVERIFIED**, even though the existing demo selector allows 1–6 people; validate with property manager before launch. Fees and taxes are intentionally `NOT_CONFIGURED` until legal and finance sign-off.

Rate management: manager-only maker/checker for substantial changes, occupancy forecast and policy approval. Keep audit logs, backup, expiry and race condition handling. Copy rate values to immutable confirmed reservation financials. Production must implement throttling, authenticated guest sessions and privacy controls.
