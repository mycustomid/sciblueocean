# Rust API RC7 contract (pilot)

Base URL local: `http://127.0.0.1:8085`.

| Method | Path | Identity | Behavior |
|--|--|--|--|
| GET | `/health` | Public | Minimal database connectivity probe; `production_ready=false` |
| POST | `/api/v1/login` | Email + password + `entity_id` | Create an 8-hour bearer session |
| GET | `/api/v1/me` | Bearer | Role and tenant identity |
| POST | `/api/v1/logout` | Bearer | Revoke session |
| GET | `/api/v1/entity` | Bearer | Current legal entity only |
| GET | `/api/v1/modules` | Bearer | Nine domain metadata records |
| GET | `/api/v1/overview` | Bearer | Per-company operational status counts + GL draft/posted totals; **not consolidated revenue** |
| GET | `/api/v1/audit-events` | Bearer + finance/auditor/executive | Last 50 audit event identifiers (current entity only) |
| GET | `/api/v1/records/{uuid}` | Bearer | Scoped domain record and real workflow history |
| GET | `/api/v1/journals/{uuid}` | Bearer + accounting read role | Scoped GL header and debit/credit account lines |
| GET | `/api/v1/records?module_key=sugar` | Bearer | Last 100 current-entity records |
| POST | `/api/v1/records` | Bearer + `Idempotency-Key` | Create draft record; no ability to set status |
| POST | `/api/v1/records/{uuid}/transition` | Bearer + role | Controlled approval transition |
| GET | `/api/v1/journals` | Bearer finance/auditor/manager/executive | Last 100 current-entity GL journals |
| POST | `/api/v1/journals` | Bearer finance | Create balanced draft GL journal |
| POST | `/api/v1/journals/{uuid}/post` | Bearer finance/executive | Post journal by a different actor |

Example login JSON (replace placeholder values):

```json
{"email":"operator@example.test","password":"your-local-demo-password","entity_id":"00000000-0000-0000-0000-000000000000"}
```

Example record creation with header `Idempotency-Key: demo-record-2026-01`:

```json
{"module_key":"sugar","counterparty":"Demo supplier","description":"Test batch intake","amount_xaf":1200000,"external_ref":"SUG-DEMO-001"}
```

Approval action examples: `submit`, `approve_manager`, `approve_finance`, `approve_final`, `reject`. Each requires the expected previous status, permission, and for approval a different actor from the creator. A user cannot jump to step 4. Administrative privilege cannot approve business steps. Each approval requires a distinct reviewer (in addition to no self-approval).

Example GL draft:

```json
{"period_key":"2026-10","memo":"Demo sale invoice","source_record_id":null,"lines":[{"account_code":"411","debit_xaf":10000,"credit_xaf":0},{"account_code":"701","debit_xaf":0,"credit_xaf":10000}]}
```

**Response semantics:** HTTP 201 for newly created record, 200 for repeat idempotent request, 400 for invalid input, 401 for unauthenticated, 403 for disallowed role/segregation of duties, 404 for missing/not-owned resource, 409 for state conflict, 500 for DB failure. No fabricated success during frontend offline conditions.

**Caution:** The account numbers and financial samples are demonstrative. Consult a Cameroon-qualified SYSCOHADA accountant and current regulations before real postings.

**RC7 login throttle:** Five failed attempts per entity + case-normalized email in fifteen minutes. The limit does not replace MFA or a gateway WAF. Backend remains NOT production ready.

## RC8 trading vertical (`/api/v1`, pilot only)

All endpoints require bearer auth and operate on the session's legal entity. `group_admin` has **no** business-action override. All order amounts are integer XAF; this vertical handles only stockable item units and complete fulfillment (no partial receipts, returns or tax automation).

| Method | Path | Role / behavior |
|--|--|--|
| GET | `/trade/catalog` | Any authenticated; item, warehouse, balance, and account mapping for entity |
| POST | `/trade/catalog/items` | manager/finance; `{sku,label,unit}` unit `each|kg|litre|metre` |
| POST | `/trade/catalog/warehouses` | manager; `{code,label}` |
| POST | `/trade/posting-accounts` | finance; `{posting_role,account_code}` code must exist and be active in this entity |
| GET | `/trade/movements` | Any authenticated; append-only receipt/shipment ledger |
| GET/POST | `/purchasing/orders` | Any authenticated reads; operator/manager creates using `Idempotency-Key` |
| POST | `/purchasing/orders/{uuid}/approve` | manager/executive, not creator |
| POST | `/purchasing/orders/{uuid}/receive` | operator/manager, not approver; `{period_key:"YYYY-MM"}`; atomic receipt & GL draft |
| GET/POST | `/sales/orders` | Any authenticated reads; operator/manager creates using `Idempotency-Key` |
| POST | `/sales/orders/{uuid}/approve` | manager/executive, not creator |
| POST | `/sales/orders/{uuid}/ship` | operator/manager, not approver; `{period_key:"YYYY-MM"}`; refuses negative stock; atomic shipment & GL draft |

Order body for either purchasing or sales (one or more line items, 50 max; no repeated `item_id`):

```json
{"counterparty":"Demo Trading Customer","warehouse_id":"00000000-0000-0000-0000-000000000000","lines":[{"item_id":"00000000-0000-0000-0000-000000000000","quantity":3,"unit_amount_xaf":2500}]}
```

The accounting role mapping requires five keys: `inventory`, `accounts_payable`, `accounts_receivable`, `sales_revenue`, `cost_of_goods_sold`. An explicit `provision_trade_demo` CLI exists for disposable environments. These sample mappings are NOT statutory SYSCOHADA certification.

Transactions roll back *together* on missing accounts, closed periods or stock errors. Only draft journals are created, and the pre-existing independent posting procedure must be used. No real customer data in RC8.

## RC16–RC17 additional pilot API
See repository overlay root `RC17-API-CONTRACT.md`, `RC17-UAT-SCENARIOS.md`, `RC17-SECURITY-THREAT-MODEL.md`. The `/api/v1/hr/*` endpoints manage HR attendance and base-pay forecasts, but do not calculate lawful payroll, CNPS or IRPP, post GL or send bank payments. `/api/v1/security/*` manages permissions inspection and session revocation. Latest migration version is 12. `group_admin` is not a business approver. RLS has not been enabled; this is not an enterprise security-certified release.
