# Future payment gateway — **not active**

Gateway candidates for Cameroon/XAF must be contract-checked, e.g. ElyonPay developer docs at <https://docs.elyonpay.com/en/> (supports XAF and Mobile Money), or another legally validated provider. Do not automatically prefer by marketing claims.

Before activation: merchant onboarding and settlement account, sandbox credentials, provider-signed webhooks, HMAC/cert verification based on actual provider spec, event replay database uniqueness constraint, reconciliation via provider server-to-server lookup, reservation reference matching, amount/currency consistency, charge/refund workflow, accounting ledger mapping, fee/tax handling, privacy audit, and incident-runbook tests.

`webhook_verifier.py` is a standalone example, not a real integration. The demo server has **no payment endpoint** and never marks any booking paid.
