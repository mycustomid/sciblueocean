# SCI Blue Ocean — Flutterwave Cameroon merchant onboarding (client handover)

Date reviewed: 26 October 2026. Country: Cameroon. Settlement currency: **XAF / FCFA**.

## For the CLIENT — request a verified business merchant account

1. Visit **https://app.flutterwave.com/login** and select **Create account**. Register the **legal company** that owns the hospitality revenue, not the developer/agency.
2. Verify the business email and phone; choose Cameroon and an appropriate business category (hotel/property accommodation). Confirm the expected legal merchant display name and actual settlement bank account belong to the same business.
3. Gather Flutterwave Cameroon KYC documentation (exact list can vary by company/legal form and the latest merchant review):
   - Company incorporation certificate / RCCM equivalent;
   - Memorandum and Articles of Association / statutes;
   - IDs of manager/directors and relevant beneficial owners (where required);
   - Taxpayer's Card / NIU; tax certificate and/or certificate of non-indebtedness, if requested;
   - Corporate settlement bank account details and bank domiciliation evidence;
   - Operating-address proof (dated utility bill / lease / title), attestation of location, and location plan;
   - Current business/trade license, director-authorisation letter if needed;
   - Signed/stamped merchant contract and KYC forms when requested;
   - Verified website URL https://sciblueocean.com and business description;
   - Pricing, booking and cancellation/refund policy pages and business contact information.
4. Request **MTN Mobile Money, Orange Money and card acceptance in XAF/Cameroon** to be enabled. Confirm per-channel limits, fees, settlements, refund support, test facilities and approval timelines directly with the provider. Never assume every network is active on account creation.
5. Configure a **test-mode** environment first. Finance/business owner must complete KYC and merchant verification for LIVE mode.
6. Do not send secret keys in WhatsApp, email or GitHub. Have an authorised manager place keys in a protected hosting environment or password manager. Developers need test access, public merchant metadata, and a test settlement procedure; business account stays under client control.

## For DEVELOPERS — integration steps

- Backend adapter: `integrations/payments/flutterwave_hosted.py` (Flutterwave v3 Standard `POST /v3/payments` and `GET /v3/transactions/{id}/verify`).
- Confirmed booking in trusted DB → amount and currency XAF frozen server-side → unique payment reference → create hosted checkout URL on backend → redirect to provider (never collect card numbers on our site).
- After callback, **verify transaction server to server**. Require successful status + exact XAF amount + exact tx_ref. Webhook signature uses v3 `verif-hash` (not the different v4 HMAC scheme); require strong secret and signature, then still verify server-side.
- Idempotent, auditable settlement entry; reconcile unpaid/pending items with provider API, support retries, chargebacks/refunds; do not auto-settle on redirect.
- In this patch: `demo-server` is loopback-only. `BLUE_OCEAN_ENABLE_FLW_TEST_CHECKOUT=YES` enables **TEST checkout only if `FLW_SECRET_KEY` starts with `FLWSECK_TEST`**. Callback must be public HTTPS staging endpoint. No live merchant credentials belong in this environment.
- **Required for production:** deploy authenticated backend at an HTTPS domain, guest identity/OTP or session authentication, inventory locking, rate limiting, queue for webhooks, production DB/backups, PCI/payment privacy review, transaction monitoring, and legal cancellation policy approval.
- Suggested redirect/callback: `https://<verified-staging-domain>/api/payment/flutterwave/callback` (replace only after backend deployment). Webhook: `https://<verified-staging-domain>/api/payment/flutterwave/webhook` — routes in the demo are examples, not publicly routable Vercel endpoints.
- Keep static frontend on Vercel, but run API/stateful payment service separately. Static Astro pages **cannot securely process payment verification** on their own.

## Business decisions still required before LIVE

| Decision | Responsible | Why |
|---|---|---|
| Legal entity / settlement bank | Client owner & Finance | KYC and account ownership |
| Authoritative nightly pricing, fees and deposit rules | Property manager | Prevent incorrect charges |
| Booking confirmation/expiry policy | Property manager | Prevent overselling |
| Cancellation, refund, no-show terms | Client legal/operations | Customer transparency |
| WhatsApp/email booking confirmations | Client marketing/operations | Legitimate communication channel |
| Data-controller and retention policy | Client legal/IT | Guest privacy |
| Approved merchant test and live keys | Client merchant admin | Never hardcoded or shared in ZIP |

## Official sources verified

- Signup instructions: https://www.flutterwave.com/us/support/my-account/how-to-create-a-flutterwave-account
- Cameroon onboarding list: https://flutterwave.com/mu/support/onboarding/onboarding-requirements-for-using-flutterwave-in-cameroon
- Cameroon business account and bank details: https://www.flutterwave.com/rw/support/general/heres-all-you-need-to-know-about-operating-a-flutterwave-account-in-cameroon
- Cameroon mobile money MTN/Orange: https://developer.flutterwave.com/docs/francophone
- Flutterwave v3 Standard checkout: https://developer.flutterwave.com/v3.0/docs/flutterwave-standard-1
- v3 webhook verification and idempotency: https://developer.flutterwave.com/v3.0.0/docs/webhooks

**Status:** source integration prepared and unit-tested with mock provider responses, merchant KYC and live settlement **NOT RUN**.
