# Local operations runtime

See STAFF-PASSWORD-AND-BOOKING.md and operations-server/README.md for current implementation and operation. The former MFA prototype is superseded by Bos's explicit choice of username/password login.

Primary local entry: http://127.0.0.1:8766/experience/ and http://127.0.0.1:8766/studio/.
The old8765 page entry redirects here; old demo login APIs are retired.

Staff accounts and reservations are persistent in operations-server/private/operations.sqlite3. scripts/start-operations.ps1 starts the local service; scripts/backup-operations.ps1 makes an integrity-checked SQLite backup. There are no production cloud credentials in frontend code or documentation.

Miague booking requests use a configured inventory of 25 rooms. Quotes report remaining rooms for selected dates from pending, confirmed and in-house bookings; pending requests temporarily hold a room. Verify that 25 matches the property's actual inventory before operational use. Ebène and Amara each display a planned inventory of 25 rooms, but remain interest-only and do not appear as available or bookable inventory until opened for reservations. Public hosting, online payment collection and external notifications are separate unconfigured services.

## Studio languages and direct Miague requests

Use the Français / English selector on Studio pages. The selection is remembered across pages; labels, actions, dates and statuses change without translating guest names or operational notes.

On /experience/stays/miague/ (or /experience/en/stays/miague/), choose arrival, departure and guests, then Request this stay / Demander ce séjour. This goes directly to the Miague booking form. Enter name/email, accept the request acknowledgement, and submit. The reference appears only after the API persists the pending request; authorized staff then confirm it in Studio reservations. Checkout must follow arrival.

Quote errors are visible and retryable; unavailable dates cannot be submitted. Tests exercise native date typing and immediate submit, both guest languages, server failure feedback, FR/EN dashboard switching and unchanged guest data. Evidence: QA/operations-booking-manual-result.json and QA/operations-browser/studio-language/result.json.
