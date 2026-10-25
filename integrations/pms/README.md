# Kamra PMS integration boundary — not activated

Use Kamra `main`/pinned stable release with Frappe v16 and `payments`; add ERPNext and HRMS on the same Frappe site only with version verification. See <https://github.com/Kamra-PMS/kamra-pms> and <https://kamrapms.com/docs/v2.6.17/self-hosting/erpnext-hr>.

Migrate availability, reservation, guest, property, folio and housekeeping workflows to Kamra's authenticated whitelisted methods **server-side** using property-scoped service identity. Never share Frappe tokens with browser. Pricing/taxes calculated by PMS. Keep request IDs and idempotency across external booking source and payment gateway. An adapter is not included because endpoint names and permissions must be pinned against a running upstream site and real version.

The isolated SQLite app is a customer demo and must never be synchronized automatically to real guests without an explicit controlled data migration.
