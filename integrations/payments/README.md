# Cameroon booking payment (XAF) — integration boundary

**Status:** Provider implementation scaffold only; not wired into guest frontend and no real charges initiated. Merchant account, KYC, actual payment methods and sandbox need verification.

## Exact intended state machine

`REQUESTED → CONFIRMED_BY_STAFF → PAYMENT_INTENT_CREATED → PSP_PENDING → PSP_SUCCESS_VERIFIED → PAID → CHECK_IN`

Reject invalid `REQUESTED → PAID`, amount mismatch, currency mismatch, reference mismatch, repeated transaction with different ID. Payment mode is conditional on confirmed booking and a server-side XAF amount (never accept browser-submitted amounts).

`FlutterwaveXAF.create_mobile_money_charge` uses network MTN or ORANGEMONEY with `currency=XAF`, `country=CM`. The provider's asynchronous response does not mean paid. On webhook verify the secret header and then verify transaction ID via Flutterwave API before recording paid. Lock and idempotently update DB. Enforce HTTPS, retries and 2-phase ledger posting in future ERPNext/Kamra integration.

See official docs: https://developer.flutterwave.com/docs/francophone and https://developer.flutterwave.com/docs/webhooks

## Prerequisites

- Live merchant KYC, Cameroon eligibility, PSP test/live API keys and allowed payment channels.
- Operator review of taxes, deposits, refunds, cancellations and overnight inventory holds.
- Secure backend with auth, identity, rate limits, logging, CSRF and reconciliation.
- Browser integration must only receive redirect/pending state; **never** API secrets.

## Demo

Local server provides `POST /api/demo/public/payment-intent` after staff confirms booking; returns no checkout URL. Finance-only simulation (`/api/demo/payment/test-settle`) requires environment `BLUE_OCEAN_ENABLE_SIMULATED_SETTLEMENT=YES`. Neither is a live payment.
