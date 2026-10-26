# Booking → payment: technical contract

**Scope: Cameroon, FCFA/XAF; primary PSP candidate Flutterwave**. Based on official docs https://developer.flutterwave.com/docs/francophone and https://developer.flutterwave.com/docs/webhooks . Card payment and MTN/Orange Money can be enabled only if the merchant account is approved for the desired channels. Connectivity has NOT been tested.

## State machine

```
guest request (pending)
   -> front desk checks availability, confirms room/rate (confirmed)
   -> server creates immutable XAF payment intent (awaiting_payment)
   -> guest selects MTN/Orange Money/Card after live PSP integration
   -> server initiates PSP charge with secret key and unique tx_ref
   -> asynchronous provider event = pending notification (never Paid by itself)
   -> server verifies provider transaction directly by id,
      tx_ref, amount, currency=XAF, status=successful
   -> transactional DB update idempotently marks payment PAID
   -> receipt/reconciliation / cancellation & refund policy
   -> PMS/Kamra record update in one-directional reconciled event
```

**Nonnegotiables:** approved booking before PSP charge, authenticated customer capabilities, rate quote server-owned, one intent idempotency key per booking, separate reservation and payment statuses, no admin keys in Astro, webhooks validated with secret, transaction reverified via PSP API, fail-closed on mismatches, replay idempotency, account reconciliation, signed-off legal/merchant contracts.

## What is testable in this ZIP

- `POST /api/demo/public/request` -> request created in isolated SQLite.
- Finance/Reception/Manager login and `POST /api/demo/booking/transition` confirm.
- `POST /api/demo/public/payment-intent` is rejected until confirmed and idempotently created after confirmation; still returns `checkout_url: null`.
- `POST /api/demo/payment/test-settle` is disabled by default; with explicit opt-in it is Finance/Manager-only and requires demo session CSRF. It changes local demo DB, not PSP.
- `/experience/payment/` shows pending/confirmed/payment status and never claims an actual debit.
- `/studio/payments/` allows simulated operator settlement *only* when the server is opted in.

## Production integration blockers

1. Merchant approval, test keys, production keys, webhook secret, network/country channel enablement, fee schedule and settlement destination.
2. Certified production-grade secret storage, TLS, actual user identity, guest authorization/rate limiting and audit retention.
3. Handling cancellations, failed/pending provider events, amount changes and partial deposits, payout reconciliation, disputes/refunds.
4. ERPNext/Kamra reconciliation and inventory holds/expiry rules.
5. Real UI/keyboard/browser testing, payments sandbox retries, integration security assessment.
