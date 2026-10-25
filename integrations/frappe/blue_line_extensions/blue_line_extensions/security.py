"""Narrow Frappe scope checks; never rely on browser-selected scope."""
import frappe
from frappe import _

# Only expose known Company-linked Doctypes, never arbitrary caller-supplied DocTypes.
ALLOWED_LIST = {
    "Purchase Order": "company",
    "Sales Order": "company",
    "Sales Invoice": "company",
    "Purchase Invoice": "company",
    "Stock Entry": "company",
    "Work Order": "company",
    "Project": "company",
}


def ensure_authenticated():
    user = getattr(getattr(frappe, "session", None), "user", None)
    if not user or user == "Guest":
        frappe.throw(_("Authentication required"), frappe.PermissionError)
    return user


def allowed_companies():
    """Server-side Company scope. Deny by default if no explicit Company permission.

    App operators must assign Company User Permissions to **every** user; broad
    company access is intentionally rejected by this integration facade.
    Frappe's own role and User Permission enforcement remains additionally active.
    """
    user = ensure_authenticated()
    rows = frappe.get_all("User Permission", filters={"user": user, "allow": "Company"}, fields=["for_value"])
    return sorted({r.for_value for r in rows if r.for_value})


def require_company(company):
    if not company or company not in allowed_companies():
        frappe.throw(_("Company access denied"), frappe.PermissionError)
    return company


def require_doctype(doctype):
    ensure_authenticated()
    if doctype not in ALLOWED_LIST:
        frappe.throw(_("Unsupported DocType"), frappe.PermissionError)
    if not frappe.has_permission(doctype, ptype="read"):
        frappe.throw(_("Permission denied"), frappe.PermissionError)
    return doctype


def validate_limit(value):
    try:
        value = int(value)
    except (TypeError, ValueError):
        frappe.throw(_("Invalid limit"), frappe.ValidationError)
    if value < 1 or value > 100:
        frappe.throw(_("Limit must be between 1 and 100"), frappe.ValidationError)
    return value
