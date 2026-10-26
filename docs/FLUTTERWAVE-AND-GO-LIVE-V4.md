# Flutterwave Cameroon (v3): onboarding and developer checklist

Provider reference: https://developer.flutterwave.com/reference/checkout and https://developer.flutterwave.com/docs/transaction-verification.

1. Client creates/controls Flutterwave business merchant account. Client submits registration documents (business registration, taxpayer ID, authorized representatives, settlement bank account, address and any compliance details requested by Flutterwave). Obtain explicit approval for XAF and MTN/Orange Mobile Money based on merchant's actual account features. Never ask to send secrets over chat.
2. Developer asks client to create TEST access credentials through authorized secure transfer, configure `FLW_SECRET_KEY`, `FLW_SECRET_HASH`, `FLW_CALLBACK_URL` in a secret manager on HTTPS staging backend, and enable test checkout explicitly. Do not put secret keys in GitHub, Astro public files or browser JS.
3. Server creates one unique `tx_ref` per confirmed booking payment intent (currency XAF, server-owned amount); Flutterwave v3 POST `/v3/payments` yields hosted URL. Do not manually collect card numbers.
4. Callback alone never marks Paid. Authenticate incoming v3 webhooks with `verif-hash`, independently GET `/v3/transactions/{id}/verify`, and verify `tx_ref`, status, currency XAF and exact amount. Use idempotent database updates and a scheduled verification process for pending/failed webhooks.
5. Exercise MTN/Orange mobile money test scenarios, retry/failure/refund, duplicate callbacks, settlement discrepancy. Confirm country-specific availability in merchant dashboard; Flutterwave's public generic method table contains inconsistent XAF/XOF option-label mapping, so do not hardcode payment_options until confirmed by provider.
6. Before live go-live: production HTTPS domain ownership, hotel policies including refunds/cancellation, legal taxes, live inventory and capacity, role security, monitoring, operator training and client sign-off. Change test keys to live **only on production backend** after client approval.

SDK/adapter included in `integrations/payments/` is restricted to v3 API semantics. Flutterwave v4 signatures differ and must NOT be mixed. Existing demo-server remains loopback only.
