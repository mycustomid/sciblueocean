# Graph Report - D:\code\sciblueocean  (2026-10-26)

## Corpus Check
- Large corpus: 416 files · ~533,226 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder.

## Summary
- 1993 nodes · 5514 edges · 132 communities (122 shown, 10 thin omitted)
- Extraction: 92% EXTRACTED · 8% INFERRED · 0% AMBIGUOUS · INFERRED: 452 edges (avg confidence: 0.6)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Community 0
- Community 1
- Community 2
- Community 3
- Community 4
- Community 5
- Community 6
- Community 7
- Community 8
- Community 9
- Community 10
- Community 11
- Community 12
- Community 13
- Community 14
- Community 15
- Community 16
- Community 17
- Community 18
- Community 19
- Community 20
- Community 21
- Community 22
- Community 23
- Community 24
- Community 25
- Community 26
- Community 27
- Community 28
- Community 29
- Community 30
- Community 31
- Community 32
- Community 33
- Community 34
- Community 35
- Community 36
- Community 37
- Community 38
- Community 39
- Community 40
- Community 41
- Community 42
- Community 43
- Community 44
- Community 45
- Community 46
- Community 47
- Community 48
- Community 49
- Community 50
- Community 51
- Community 52
- Community 53
- Community 54
- Community 55
- Community 56
- Community 57
- Community 58
- Community 59
- Community 60
- Community 61
- Community 62
- Community 63
- Community 64
- Community 65
- Community 66
- Community 67
- Community 68
- Community 69
- Community 70
- Community 71
- Community 72
- Community 73
- Community 74
- Community 75
- Community 76
- Community 77
- Community 78
- Community 79
- Community 80
- Community 81
- Community 82
- Community 84
- Community 85
- Community 86
- Community 87
- Community 88
- Community 90
- Community 91
- Community 92
- Community 93
- Community 94
- Community 95
- Community 96
- Community 97
- Community 98
- Community 109

## God Nodes (most connected - your core abstractions)
1. `ApiError` - 161 edges
2. `AppState` - 98 edges
3. `u()` - 63 edges
4. `ih()` - 55 edges
5. `o()` - 48 edges
6. `legal_entities` - 43 edges
7. `l()` - 43 edges
8. `Auth` - 42 edges
9. `r()` - 42 edges
10. `f()` - 41 edges

## Surprising Connections (you probably didn't know these)
- `load()` --indirect_call--> `e()`  [INFERRED]
  public/app.js → scraped_assets/_next/static/chunks/polyfills-42372ed130431b0a.js
- `renderRooms()` --indirect_call--> `r()`  [INFERRED]
  public/app.js → scraped_assets/_next/static/chunks/150-c732cb1ba579beab.js
- `screenNameFor()` --indirect_call--> `m()`  [INFERRED]
  public/workspace/app.js → scraped_assets/_next/static/chunks/4bd1b696-92152b0f5947070d.js
- `renderLiveTable()` --indirect_call--> `o()`  [INFERRED]
  public/workspace/app.js → scraped_assets/_next/static/chunks/551-27a95cce6ad142c5.js
- `exportCsv()` --indirect_call--> `o()`  [INFERRED]
  public/workspace/app.js → scraped_assets/_next/static/chunks/551-27a95cce6ad142c5.js

## Import Cycles
- None detected.

## Communities (132 total, 10 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.11
Nodes (70): r(), A(), ea(), ee(), eh(), ei(), ek(), el() (+62 more)

### Community 1 - "Community 1"
Cohesion: 0.08
Nodes (77): create_quote(), quote_value(), QuoteInput, quotes(), HeaderMap, Json, Result, State (+69 more)

### Community 2 - "Community 2"
Cohesion: 0.04
Nodes (55): a0(), a3(), a4(), a5(), a7(), a8(), aB(), aD() (+47 more)

### Community 3 - "Community 3"
Cohesion: 0.03
Nodes (11): buildCheckoutProxy(), checkout(), checkoutSignal(), eO(), ew(), __internal_effect(), signInSignal(), signUpSignal() (+3 more)

### Community 4 - "Community 4"
Cohesion: 0.07
Nodes (41): clean(), ClosingConnection, conflict(), connection(), create_booking(), Handler, init_db(), iso_today() (+33 more)

### Community 5 - "Community 5"
Cohesion: 0.12
Nodes (53): addChargeModal(), addDays(), btn(), closeModal(), demoSeed(), denied(), download(), empty() (+45 more)

### Community 6 - "Community 6"
Cohesion: 0.12
Nodes (53): addChargeModal(), addDays(), btn(), closeModal(), demoSeed(), denied(), download(), empty() (+45 more)

### Community 7 - "Community 7"
Cohesion: 0.15
Nodes (45): approve(), approve_purchase(), approve_sale(), audit(), catalog(), create_item(), create_order(), create_purchase() (+37 more)

### Community 8 - "Community 8"
Cohesion: 0.09
Nodes (3): DemoAPI, DateTime, DemoAPI

### Community 9 - "Community 9"
Cohesion: 0.09
Nodes (37): loadModules(), request(), reset(), state(), addCharge(), api(), bookingActions(), bookingList() (+29 more)

### Community 10 - "Community 10"
Cohesion: 0.14
Nodes (38): advisory(), approve_count(), approve_transfer(), audit(), CountInput, counts(), hash(), note_ok() (+30 more)

### Community 11 - "Community 11"
Cohesion: 0.09
Nodes (42): c5(), c9(), cK(), cM(), cO(), cz(), e6(), eB() (+34 more)

### Community 12 - "Community 12"
Cohesion: 0.10
Nodes (25): handler(), handler(), handler(), handler(), DatabaseEngine, db, __dirname, __filename (+17 more)

### Community 13 - "Community 13"
Cohesion: 0.10
Nodes (41): aE(), aN(), aP(), ax(), ej(), fm(), ih(), im() (+33 more)

### Community 14 - "Community 14"
Cohesion: 0.14
Nodes (34): audited(), check_lines(), execute(), fulfilments(), PartialInput, PartialLine, progress(), purchase_lines() (+26 more)

### Community 15 - "Community 15"
Cohesion: 0.09
Nodes (38): ac(), aG(), aK(), au(), aV(), c0(), c1(), cc() (+30 more)

### Community 16 - "Community 16"
Cohesion: 0.12
Nodes (32): add_gl_line(), create_return(), historical_cost(), list_returns(), posting_account(), reject_bad_reason(), req(), returnable() (+24 more)

### Community 17 - "Community 17"
Cohesion: 0.24
Nodes (35): approve_progress(), batches(), BatchInput, complete_batch(), CompleteBatchInput, create_batch(), create_import(), create_project() (+27 more)

### Community 18 - "Community 18"
Cohesion: 0.13
Nodes (33): api(), authenticate(), availableSections(), clearSession(), dashboardTitle(), detailButton(), exportCsv(), filteredDemoRows() (+25 more)

### Community 19 - "Community 19"
Cohesion: 0.09
Nodes (34): a1(), a2(), at(), b(), c2(), c4(), cb(), cj() (+26 more)

### Community 20 - "Community 20"
Cohesion: 0.24
Nodes (32): account(), bank_lines(), BankLineInput, create_bank_line(), create_invoice(), create_receipt(), draft_two_line(), InvoiceInput (+24 more)

### Community 21 - "Community 21"
Cohesion: 0.25
Nodes (29): audit(), BookingInput, bookings(), check_in(), check_out(), create_booking(), create_lease(), create_property() (+21 more)

### Community 22 - "Community 22"
Cohesion: 0.15
Nodes (18): create(), invalid_period_rejected(), journal(), JournalInput, JournalLineInput, JournalResponse, line(), list() (+10 more)

### Community 23 - "Community 23"
Cohesion: 0.11
Nodes (24): add(), cancel(), cancelQueries(), destroy(), #et(), fetch(), fetchNextPage(), fetchOptimistic() (+16 more)

### Community 24 - "Community 24"
Cohesion: 0.18
Nodes (25): a_(), c(), cp(), eR(), lF(), o$(), oj(), oQ() (+17 more)

### Community 25 - "Community 25"
Cohesion: 0.21
Nodes (25): a(), c(), canRun(), clearInterval(), componentDidUpdate(), createResult(), d(), f() (+17 more)

### Community 26 - "Community 26"
Cohesion: 0.13
Nodes (24): e7(), fa(), fc(), fd(), fE(), ff(), fi(), fk() (+16 more)

### Community 27 - "Community 27"
Cohesion: 0.24
Nodes (22): addCharge(), api(), bookingActions(), bookingList(), button(), dateStamp(), draw(), empty() (+14 more)

### Community 28 - "Community 28"
Cohesion: 0.17
Nodes (23): ao(), as(), c8(), cg(), eo(), eu(), eW(), fy() (+15 more)

### Community 29 - "Community 29"
Cohesion: 0.11
Nodes (23): ce(), cH(), cl(), cn(), cQ(), cr(), ct(), cW() (+15 more)

### Community 30 - "Community 30"
Cohesion: 0.15
Nodes (20): ensure_fulfilment_closed_on_commit(), protect_finalized_fulfilment(), trade_fulfilment_lines, trade_fulfilment_lines_immutable, trade_fulfilments, trade_fulfilments_commit_complete, trade_fulfilments_finalized_guard, trade_fulfilments_order_scope (+12 more)

### Community 31 - "Community 31"
Cohesion: 0.11
Nodes (22): build(), defaultMutationOptions(), defaultQueryOptions(), ensureInfiniteQueryData(), ensureQueryData(), fetchInfiniteQuery(), fetchQuery(), getCurrentResult() (+14 more)

### Community 32 - "Community 32"
Cohesion: 0.13
Nodes (20): audit_events_append_only, forbid_audit_event_mutation(), workflow_events_append_only, inventory_movements_append_only, trade_return_lines_immutable_guard, rc15_batch_delete_guard, rc15_batch_transition_guard, rc15_batches (+12 more)

### Community 33 - "Community 33"
Cohesion: 0.25
Nodes (18): api_idempotency, app_users, audit_events, auth_sessions, domain_records, erp_modules, forbid_posted_journal_mutation(), gl_accounts (+10 more)

### Community 34 - "Community 34"
Cohesion: 0.20
Nodes (17): access_gate(), permissions(), revoke_member(), revoke_self(), route_allowed(), HeaderMap, Json, Path (+9 more)

### Community 35 - "Community 35"
Cohesion: 0.14
Nodes (20): c6(), d(), e5(), e8(), eM(), eV(), eY(), f() (+12 more)

### Community 36 - "Community 36"
Cohesion: 0.12
Nodes (19): clear(), continue(), er(), execute(), findAll(), getAll(), isFocused(), mount() (+11 more)

### Community 37 - "Community 37"
Cohesion: 0.30
Nodes (17): Auth, hash_token(), login(), LoginRequest, LoginResponse, logout(), me(), register_failure() (+9 more)

### Community 38 - "Community 38"
Cohesion: 0.24
Nodes (16): fillTrade(), loadOrigins(), loadPartialLines(), loadPartialOrders(), loadReturnable(), loadReturns(), loadTrade(), pending() (+8 more)

### Community 39 - "Community 39"
Cohesion: 0.23
Nodes (15): inventory_balances, inventory_items, inventory_movements, inventory_warehouses, trade_idempotency, trade_purchase_lines, trade_purchase_orders, trade_sales_lines (+7 more)

### Community 40 - "Community 40"
Cohesion: 0.25
Nodes (8): ApiError, Error, Response, StatusCode, String, Into, IntoResponse, Self

### Community 41 - "Community 41"
Cohesion: 0.12
Nodes (15): astro, dependencies, astro, tailwindcss, @tailwindcss/vite, name, private, scripts (+7 more)

### Community 42 - "Community 42"
Cohesion: 0.33
Nodes (14): create_purchase_order_draft(), list_documents(), me(), Whitelisted session-authenticated methods. No passwords / API keys in browser., submit_document(), workspace(), allowed_companies(), ensure_authenticated() (+6 more)

### Community 43 - "Community 43"
Cohesion: 0.23
Nodes (14): entity_memberships, rc16_attendance, rc16_attendance_guard(), rc16_attendance_state, rc16_employee_update_guard, rc16_employees, rc16_leave_guard(), rc16_leave_requests (+6 more)

### Community 44 - "Community 44"
Cohesion: 0.20
Nodes (12): only_manager_role_for_manager_step(), Json, Option, PgPool, Result, String, Uuid, Value (+4 more)

### Community 45 - "Community 45"
Cohesion: 0.30
Nodes (12): fillTrade(), loadOrigins(), loadPartialLines(), loadPartialOrders(), loadReturnable(), loadReturns(), loadTrade(), probe() (+4 more)

### Community 46 - "Community 46"
Cohesion: 0.18
Nodes (14): bindMethods(), buildSignInProxy(), buildSignUpProxy(), buildWaitlistProxy(), constructor(), formatMessage(), gateMethod(), gateProperty() (+6 more)

### Community 47 - "Community 47"
Cohesion: 0.40
Nodes (12): allow(), audit_feed(), journal_detail(), overview(), record_detail(), HeaderMap, Json, Path (+4 more)

### Community 48 - "Community 48"
Cohesion: 0.17
Nodes (3): credentials, Element, root

### Community 49 - "Community 49"
Cohesion: 0.36
Nodes (9): fillTrade(), loadPartialLines(), loadPartialOrders(), loadTrade(), probe(), refresh(), renderOverview(), request() (+1 more)

### Community 50 - "Community 50"
Cohesion: 0.36
Nodes (9): b(), f(), g(), i(), j(), N(), v(), x() (+1 more)

### Community 51 - "Community 51"
Cohesion: 0.33
Nodes (11): aa(), al(), ar(), ee(), id(), l5(), l9(), ln() (+3 more)

### Community 52 - "Community 52"
Cohesion: 0.24
Nodes (11): addObserver(), b(), clearGcTimeout(), clearTimeout(), ee(), optionalRemove(), removeObserver(), scheduleGc() (+3 more)

### Community 53 - "Community 53"
Cohesion: 0.18
Nodes (9): html, js, main, mirrorHtml, mirrorJs, mod, root, schema (+1 more)

### Community 54 - "Community 54"
Cohesion: 0.18
Nodes (9): auth, filenames, hr, main, policy, root, security, sql16 (+1 more)

### Community 55 - "Community 55"
Cohesion: 0.24
Nodes (6): can_module(), ensure_module(), Result, String, Vec, visible_modules()

### Community 56 - "Community 56"
Cohesion: 0.44
Nodes (8): account_setup(), headers(), purchase_sale_stock_journal_and_entity_isolation(), HeaderMap, Option, PgPool, Uuid, user()

### Community 57 - "Community 57"
Cohesion: 0.36
Nodes (5): field(), nightCount(), performSearch(), request(), updateQuote()

### Community 58 - "Community 58"
Cohesion: 0.42
Nodes (7): fillTrade(), loadTrade(), probe(), refresh(), renderOverview(), request(), setupBase()

### Community 59 - "Community 59"
Cohesion: 0.22
Nodes (5): checks, errors, isSCI, root, slugs

### Community 60 - "Community 60"
Cohesion: 0.39
Nodes (7): rc13_bank_audit_no_delete, rc13_bank_lines, rc13_invoice_guard, rc13_invoices, rc13_prevent_closed_invoice_mutation(), rc13_receipts, rc13_receipts_audit_no_delete

### Community 61 - "Community 61"
Cohesion: 0.32
Nodes (7): rc14_fx_no_mutation, rc14_fx_quotes, rc14_leases, rc14_leases_no_mutation, rc14_properties, rc14_reservations, rc14_rooms

### Community 62 - "Community 62"
Cohesion: 0.43
Nodes (5): field(), nightCount(), performSearch(), request(), updateQuote()

### Community 63 - "Community 63"
Cohesion: 0.36
Nodes (5): HTMLParser, command(), HTMLIds, main(), source_checks()

### Community 64 - "Community 64"
Cohesion: 0.29
Nodes (8): getObserversCount(), invalidate(), invalidateQueries(), isActive(), isDisabled(), isFetched(), isStatic(), refetchQueries()

### Community 65 - "Community 65"
Cohesion: 0.25
Nodes (6): html, pilot, root, rust, server, sql

### Community 66 - "Community 66"
Cohesion: 0.52
Nodes (6): actor(), api_headers(), HeaderMap, PgPool, Uuid, verify_approval_evidence_and_cross_entity_access()

### Community 67 - "Community 67"
Cohesion: 0.48
Nodes (5): probe(), refresh(), renderOverview(), request(), setupBase()

### Community 68 - "Community 68"
Cohesion: 0.48
Nodes (6): download_worker(), extract_links_from_text(), fetch_url(), main(), Blackhole Asset Scraper for https://sciblueocean.com/ Crawls pages, Next.js…, save_file()

### Community 69 - "Community 69"
Cohesion: 0.29
Nodes (5): main, migrations, root, rust, sql

### Community 70 - "Community 70"
Cohesion: 0.47
Nodes (5): identity(), rc13_invoice_bank_reconciliation_end_to_end(), HeaderMap, PgPool, Uuid

### Community 71 - "Community 71"
Cohesion: 0.53
Nodes (5): actor(), overlap_same_room_rejected_adjacent_stay_allowed(), HeaderMap, PgPool, Uuid

### Community 72 - "Community 72"
Cohesion: 0.53
Nodes (5): actor(), rc15_entity_scoped_maker_checker_and_manufacturing_qc(), HeaderMap, PgPool, Uuid

### Community 73 - "Community 73"
Cohesion: 0.53
Nodes (5): hr_role_isolation_independent_review_and_base_salary_forecast(), identity(), HeaderMap, PgPool, Uuid

### Community 74 - "Community 74"
Cohesion: 0.53
Nodes (5): actor(), admin_bypass_removed_and_membership_change_revokes_tokens(), HeaderMap, PgPool, Uuid

### Community 75 - "Community 75"
Cohesion: 0.53
Nodes (4): probe(), refresh(), request(), setupBase()

### Community 76 - "Community 76"
Cohesion: 0.47
Nodes (4): a(), s(), w(), y()

### Community 77 - "Community 77"
Cohesion: 0.33
Nodes (4): appSrc, base, configSrc, html

### Community 78 - "Community 78"
Cohesion: 0.50
Nodes (4): rc17_member_revoke, rc17_revoke_sessions_on_membership_change(), rc17_security_event_immutable, rc17_security_events

### Community 79 - "Community 79"
Cohesion: 0.40
Nodes (4): main(), Box, Error, Result

### Community 80 - "Community 80"
Cohesion: 0.40
Nodes (4): main(), Box, Error, Result

### Community 81 - "Community 81"
Cohesion: 0.40
Nodes (4): main(), Box, Error, Result

### Community 82 - "Community 82"
Cohesion: 0.40
Nodes (4): main(), Box, Error, Result

### Community 84 - "Community 84"
Cohesion: 0.50
Nodes (3): port(), ROOT, start()

### Community 85 - "Community 85"
Cohesion: 0.60
Nodes (4): bootstrap(), _find_chromium(), Browser smoke tests for standalone Hotel OS (Odoo Architecture). Requires: pip…, run()

### Community 86 - "Community 86"
Cohesion: 0.83
Nodes (3): api(), refresh(), refreshAll()

### Community 87 - "Community 87"
Cohesion: 0.83
Nodes (3): api(), refresh(), refreshAll()

### Community 88 - "Community 88"
Cohesion: 0.83
Nodes (3): api(), refresh(), refreshAll()

## Knowledge Gaps
- **70 isolated node(s):** `auth_login_attempts`, `__filename`, `__dirname`, `INITIAL_MODULES`, `INITIAL_RECORDS` (+65 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `sa()` connect `Community 13` to `Community 24`?**
  _High betweenness centrality (0.003) - this node is a cross-community bridge._
- **Why does `sf()` connect `Community 24` to `Community 13`?**
  _High betweenness centrality (0.003) - this node is a cross-community bridge._
- **Why does `sc()` connect `Community 24` to `Community 11`, `Community 29`?**
  _High betweenness centrality (0.003) - this node is a cross-community bridge._
- **Are the 6 inferred relationships involving `ih()` (e.g. with `az()` and `c()`) actually correct?**
  _`ih()` has 6 INFERRED edges - model-reasoned connections that need verification._
- **What connects `auth_login_attempts`, `__filename`, `__dirname` to the rest of the system?**
  _70 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.10929292929292929 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.08151260504201681 - nodes in this community are weakly interconnected._