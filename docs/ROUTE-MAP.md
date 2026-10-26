# SCI V3 paired routes
Every FR guest route `/experience/<route>/` has a corresponding EN `/experience/en/<route>/`.

Routes:
- `/` guest collection homepage
- `/stays/` collection filter
- `/stays/miague/`, `/stays/ebene/`, `/stays/amara/` property gallery and relevant CTA
- `/search/` location/date/guest search results
- `/booking/` studio reservation request
- `/manage/` reference+email tracking
- `/payment/` payment intent/status
- `/monthly/` expressions of interest
- `/bonapriso/` neighbourhood
- `/our-story/` company story
- `/faq/` frequently asked questions
- `/policies/` conditions and privacy draft requiring approval
- `/contact/` local-demo enquiry form
- `/journal/` editorial guide
- `/signin/`, `/signup/` route preserved, NOT CONNECTED to production guest auth

`/studio/` and `/workspace/` are preserved, not publicly authenticated production ERP.
