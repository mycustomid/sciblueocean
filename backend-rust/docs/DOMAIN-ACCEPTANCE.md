# Nine modules: acceptance criteria before comparing with Odoo or a client's ERP

All acceptance tests below are **NOT YET PASSING**. These are required business goals and reference artifacts, not claims of implementation. Proof must be recorded as a real transaction replay, screenshot/video, generated accounting entries, and evidence log.

| Domain | Real-world reference | Must show in full product | Sample measurable acceptance case |
|---|---|---|---|
| 01 Holding & CAPEX | Odoo/OCA consolidation, investment governance | Legal subsidiaries, currency normalization, CAPEX approval, investment-to-ledger integration, elimination worksheets | Submit 2 subsidiary CAPEX budgets, approve based on mandate, compare consolidated trial balance with elimination |
| 02 BLEX FX | Fineract (inspiration, NOT ready-made FX bureau), AML tools | KYC, risk screening, cash drawer/vault counts, FX ticket rates, spread, multi-currency settlement, regulatory audit | Execute FX sale; verify cash stock in both currencies, posting and KYC hold |
| 03 SCI Hotel & Property | OCA vertical-hotel / Odoo property | Room availability, reservation/folio, housekeeping, POS, deposit, lease, night audit | Two concurrent bookings same room/date must conflict; check-out creates complete accounting evidence |
| 04 Construction | ERPNext Projects | Estimate, BoQ, contracts, procurement, material issues, WBS, retention, variation, progress billing | One project generates vendor cost, milestone bill and margin report |
| 05 Sugar Manufacturing | ERPNext manufacturing/QC | Weighbridge, lot genealogy, BOM, shop-floor steps, yield, Brix/ICUMSA QC, by-products | Convert received cane lot to bagged sugar + molasses; reconcile mass and valuation |
| 06 Import & Trade | Odoo Purchase/Inventory/Landed Cost | Shipment BL, customs declarations, receipts, SKD/CKD assembly, duties, landed cost, dispatch | One import container produces correct unit landed cost and inventory receipt |
| 07 Accounting & Consolidation | Odoo Accounting, OCA | Company ledger, trial balance, double entry, period close, reconciliations, taxes, eliminations | Post balanced journal, lock period, prove no cross-entity posting or retroactive mutation |
| 08 HR & Payroll | Frappe HRMS | Employee lifecycle, contracts, time/leave, deductions, payroll batch, CNPS/IRPP local validation | From attendance to payslip to net payout; resolve late adjustment without editing posted payroll |
| 09 Digital & AI | Frappe Desk/ITSM, monitoring | Incidents, SLAs, queue jobs, observability, incidents-to-change-management, AI evidence | Ticket triggers incident, escalation and release, with timestamps and approval trails |

## Comparison benchmark format
Use three evidence groups for every requirement: **client ERP**, **Blue Line ERP**, **auditor notes**. Record pass/fail/partial/N/A, time-to-complete, error rate, screenshot, trace ID, and a reproducible test dataset. An unimplemented feature = fail, never auto-score 100%. A frontend dashboard display does not qualify as an actual business transaction.

## Must-have group-wide scenarios
- Organization: same physical person works across two legal entities with different scoped roles; no cross-leak.
- Finance: source transaction posts journal in entity of origin with immutable historical trace.
- Procurement: purchase request → approval → PO → receipt → invoice → payment with matching references.
- Concurrency: two users attempt conflicting update, one receives explicit conflict response.
- Recovery: restore a clean environment from backup and reconcile balances.

RC6 actual implemented: tenant-scoped pilot records, 4-step generic approval, standalone balanced GL, authenticated pilot UI. All other cases require future checkpoints.
