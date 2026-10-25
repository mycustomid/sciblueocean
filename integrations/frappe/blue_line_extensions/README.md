# Installing in a verified Frappe bench

Custom Frappe app, no custom DocType migrations yet. Requires ERPNext. Keep Kamra optional pending compatibility tests. From bench root: `bench get-app /absolute/path/to/apps/blue_line_extensions` then `bench --site STAGING_SITE install-app blue_line_extensions`. Login occurs on Frappe's built-in `/login` route. All users must have an explicit User Permission for their allowed Company, or API returns no data / denies access. Configure DocType permissions in native Role Permission Manager. `frappe.get_list()` enforces row permissions for list operations; `frappe.db.count` is used only after company scope and DocType permission checks—review Frappe query semantics in target upstream release before exposing cross-site counts.

NOTE: This example does not replace proper tested native workflows, including HR and PMS. Do not enable via production reverse proxy before staging security test.
