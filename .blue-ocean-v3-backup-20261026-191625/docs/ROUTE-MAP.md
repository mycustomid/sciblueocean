# Route map

## Guest

`/` and `/experience/` homepage; `/experience/stays/`; `/experience/stays/miague/`; `/experience/stays/ebene/`; `/experience/stays/amara/`; `/experience/search/`; `/experience/booking/`; `/experience/manage/`; `/experience/signin/`; `/experience/signup/`; `/experience/monthly/`; `/experience/bonapriso/`; `/experience/our-story/`; `/experience/journal/`; `/experience/contact/`; `/experience/faq/`; `/experience/policies/`.

## Studio (local only)

`/studio/` role login; `/studio/dashboard/`; `/studio/bookings/`; `/studio/calendar/`; `/studio/arrivals/`; `/studio/guests/`; `/studio/housekeeping/`; `/studio/folios/`; `/studio/maintenance/`; `/studio/reports/`; `/studio/portfolio/`; `/studio/companies/`; `/studio/people/`; `/studio/settings/`.

## Preserved upstream

The existing `/workspace/` is not overwritten; existing `/api/` endpoints are not overwritten; `backend-rust/` is untouched. `/studio/` is a separate isolated demonstration. `src/pages/index.astro` is the only target file replaced after applying.
