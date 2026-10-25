# Integration boundary (do not use as proof of completion)

Public booking: persist guest request to production booking service with server-side availability, rate rules, fees/taxes and PII lifecycle. Staff login must use Frappe or independent properly hosted IAM. Backend engine proposal Kamra PMS stable compatible with Frappe v16, optional ERPNext/HRMS for accounting/payroll in same site, in line with https://kamrapms.com/docs/v2.6.17/self-hosting/erpnext-hr .

Payment gateway: compare contracted provider availability in Cameroon (Mobile Money/Orange Money/MTN, XAF), test sandbox and legal agreements. Example developer reference https://docs.elyonpay.com/en/ ; no provider was selected. Only provider-confirmed webhook **plus** signed/verified server-to-server payment lookup may advance a payment state. Implement idempotency and maker-checker for refunds. Payment UI in this patch is intentionally disabled.

Future production service boundaries: `AUTH` identity and 2FA; `BOOKING` reservation truth from PMS; `CATALOG` verified property/media; `PAYMENT` gateway adapters; `REPORTING` accounting events; `NOTIFY` transactional email/SMS; `AUDIT` immutable records. Distinguish legal companies from properties and tenant security. A branded shell is not an ERP system of record.
