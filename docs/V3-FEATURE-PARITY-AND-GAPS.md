# V3 feature parity / QA register

Baseline: https://sciblueocean.com/ public landing (browser access); previous V2 repo HEAD `e59bb497a94cf91a59798d45dce322d185346735`.

| Original capability | V3 equivalent | Verification |
|---|---|---|
| Miague studio reservation request | /experience/booking/ or /experience/en/booking/; POST demo booking API | Functional loopback SQLite test, NOT real hotel inventory |
| Choose dates, residence, guests | Search forms and route-synced query | Static/HTTP validated, browser visual blocked |
| My Bookings | /experience/manage/ and /experience/en/manage/ | Reference + email demo lookup only |
| Sign-in and sign-up routes | /signin/ and /signup/ in both languages | Deliberate non-active state; production guest auth NOT CONNECTED |
| Ebène and Amara pre-rental interest | /monthly/ with persisted interest request to SQLite | Functional demo test; no email notification |
| Authentic local media, two architectural projects | Gallery with local high-resolution original logo and photography | Asset presence PASS; client media rights to confirm |
| Amenities and property facts | Per-property verified features, secure residence, parking, rates and hours | Content from website original; some room amenities require client input |
| Payment after booking confirmation | /payment/, payment intent API, Flutterwave hosted checkout test adapter | Mock API tests PASS; live NOT ACTIVE |
| Booking/arrival policies & privacy | /policies/ and /faq/ in FR/EN | Content present, operator/legal signoff REQUIRED |
| Direct contact | /contact/ persisted in local test DB | Demo only, no email delivery |
| Original staff/ERP | /studio/ & /workspace/ preserved from V2 | No new ERP production integration claimed |
| FR/EN toggle | Fully authored static sibling pages for each of 18 routes, no runtime translate | 36 route cross-check PASS |
| Neighborhood detail | /bonapriso/ plus map link | Informational, no map API charge |

## Remaining production blockers

1. Owner must supply exact Miague room facilities and photos of studio interiors. Do not advertise swimming pool, airport transfer, free Wi-Fi, gym or kitchen without client verification.
2. PMS inventory/availability and booking transaction atomicity on a production DB are not connected. Demo SQLite only.
3. Guest account sign-in/up, password resets, OTP, guest consent, full data retention/privacy are not deployed.
4. Client merchant must complete Flutterwave verification; configure secret keys under server-managed environment.
5. Real webhook queue, callback and checkout are not publicly deployed. Flutterwave test calls have no integration test using actual provider account.
6. Cancellation/refund/tax/fees/deposit policies require business/legal signoff, not invented numbers.
7. FR/EN pages are structurally paired, but native speaker editorial and legal translation review required.
8. Browser screenshot test is **BLOCKED** by `net::ERR_BLOCKED_BY_ADMINISTRATOR` for loopback, despite HTTP and unit tests passing.
9. Astro build against real HEAD is NOT RUN in this environment; installer requires `npm ci && npm run build` in actual clone.
10. Price 40,000 FCFA/night and upcoming 400,000/450,000 FCFA/month are website reference prices, not an approved operational rate table.
