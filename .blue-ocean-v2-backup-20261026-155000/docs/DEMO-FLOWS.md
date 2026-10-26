# Test presentation script (local-only)

1. `/experience/` editorial homepage, browse Miague/Ebène/Amara and status. Filter available vs upcoming. Monthly projects cannot be booked immediately.
2. `/experience/search/`: enter valid future check-in/check-out and guests, view Miague estimate (40,000 XAF/night) and continue to booking. No online payment.
3. `/experience/booking/`: submit a **synthetic** guest name/e-mail to SQLite; record reference BO-XXXXXXXX. Lookup same reference/e-mail on `/experience/manage/`.
4. `/studio/` sign in as `reception`, password `demo-only-change-me` (local only), open bookings, confirm date. Test a competing overlapping request: second confirmation should fail.
5. Move reservation status to checked in. Switch identity by signing out and signing in as `finance`, add a non-paid folio charge. `settled = 0`, `revenue = 0` because gateway is not connected.
6. Sign out and open `housekeeping`, create and close a cleaning task. Role cannot approve reservations or post folio charges (403).
7. Sign in as `owner`, see non-sensitive portfolio and aggregate indicators. There is no finance posting button in this role.
8. `/studio/companies/` showcases 9 business sectors but explicitly disables eight not-integrated workflows. Never present these as functional ERP.

**Do not demo on client production domain with synthetic auth**. This is a presentation dataset, not a live hotel backend.
