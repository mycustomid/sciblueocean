# Blue Line ERP — evaluation protocol RC5 (FR / EN / ID)

**Purpose:** show a credible product demo and objectively compare it against an ERP already used by the client. **Status:** demonstration, not a certified live ERP.

## Business hierarchy

- **Group/Holding:** group governance, investment approvals and separate consolidation processes.
- **Five operational areas:** BLEX (FX), Property & Hotel, EPC Construction, Sugar Manufacturing, Import/Assembly/Trade.
- **Three group services:** Finance, HR, Digital/IT. These are not automatically separate legal entities.
- **ERP Core:** group, legal entity, branch/site, cost center, counterparty, documents, workflow, ledger, identity, RBAC, audit.

The four-step business illustration may remain as an executive summary. It must *not* force every transaction through the exact same four stages. Design different workflows for booking, FX conversion, sugar quality release, purchase order, payroll, and incident response.

## Live demo acceptance matrix

| Domain | Demonstrate on BOTH products | Evidence to collect |
|---|---|---|
| Holding / CAPEX | Create CAPEX request, review, audit, director approval, reject, re-submit | source request, approval timestamps, budget reservation, board output |
| BLEX FX | Quote FX, verify KYC, check AML hold, settle with cash/vault reconciliation | deal slip, rate timestamp, KYC decision, vault movement, statutory output |
| Hotel / Property | Reservation with same-room conflict, check-in, POS posting, housekeeping, check-out, billing | folio, receipt, occupancy, room turnover, invoice |
| Construction | BOQ estimate, approved work order, site consumption, progress claim, retention | work package, quantities, sub-contractor invoice, signed measurement |
| Sugar MRP | Cane intake with Brix, production order, inventory consumption, QC quarantine/release, dispatch | weighbridge, batch genealogy, QC certificate, finished goods stock |
| Import / Trade | Purchase, bill of lading, customs expense, goods receipt, landed cost, delivery | import declaration, cost allocation, GRN, customs document |
| Finance | Source invoice -> approved double-entry journal -> bank reconciliation -> entity report | debit=credit, journal trace, reconciliation, intercompany elimination |
| HR / Payroll | Employee, attendance, approved overtime, payroll computation, bank file | payslip, legal rules version, mandatory contributions, transfer authorization |
| Digital / IT | Raise incident, classify, approval of change, deploy, verify audit & rollback | SLA clock, operator identity, incident timeline, change record |

### Rating scale (0–5)

- 0: test fails entirely.
- 1: critical missing functional capabilities.
- 2: partially working / major manual workaround.
- 3: basic workflow works with some gaps.
- 4: robust in the exercised scenarios.
- 5: independently reproducible evidence, negative tests and role validation passed.

Weighted criteria: coverage 20%, workflows 15%, integrity/accounting 20%, server-side security 20%, usability 15%, integrations/operations 10%.
**A score without >= 8 characters of evidence is excluded. Unknown is not zero.** The scorecard never prefills scores for either product.

### Suggested demo steps

1. Agree legal entity and role identities. Use fictional records to avoid client data exposure.
2. Run the same script, device, and input amounts in both solutions.
3. Capture links, screenshots, request IDs and timestamps as evidence.
4. Enter only observed results in **Comparatif ERP & Preuves** within the ERP navigation.
5. Export CSV/JSON and make a gap-based proposal. Do not present nominal sample transactions as consolidated financial reporting.

## Reference software — architectural inspiration, NOT integrated packages

- Odoo: https://www.odoo.com/documentation/19.0/ (company, accounting, inventory, workflow)
- Odoo Community Association hospitality: https://github.com/OCA/vertical-hotel
- ERPNext / Frappe: https://github.com/frappe/erpnext
- Frappe HR: https://github.com/frappe/hrms
- Apache Fineract: https://github.com/apache/fineract (financial services core, not plug-and-play FX compliance)
- Odoo account consolidation: https://github.com/OCA/account-consolidation
- IBM Carbon: https://carbondesignsystem.com/
- WCAG 2.2: https://www.w3.org/TR/WCAG22/

**Do not use marketing statements such as “certified SYSCOHADA”, “approved by BEAC”, “regulated COBAC” or “fully integrated backend” without actual verifiable evidence.**
