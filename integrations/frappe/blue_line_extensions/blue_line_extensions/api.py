"""Whitelisted session-authenticated methods. No passwords / API keys in browser."""
import frappe
from frappe import _
from .security import ensure_authenticated, allowed_companies, require_company, require_doctype, ALLOWED_LIST, validate_limit

@frappe.whitelist(methods=["GET"])
def me():
    user = ensure_authenticated()
    return {"user": user, "companies": allowed_companies(), "roles": frappe.get_roles(user)}

@frappe.whitelist(methods=["GET"])
def workspace(company=None):
    ensure_authenticated()
    companies = allowed_companies()
    if company:
        require_company(company)
        companies = [company]
    results = []
    for scoped_company in companies:
        metrics = {}
        for dt in ("Purchase Order", "Sales Order", "Sales Invoice"):
            if frappe.has_permission(dt, ptype="read"):
                metrics[dt] = frappe.db.count(dt, {"company": scoped_company})
        results.append({"company": scoped_company, "counts": metrics})
    return {"companies": results, "source": "frappe.db", "last_refresh": frappe.utils.now_datetime().isoformat()}

@frappe.whitelist(methods=["GET"])
def list_documents(doctype, company, limit=20):
    require_doctype(doctype)
    require_company(company)
    limit = validate_limit(limit)
    # get_list applies Frappe row-level role & User Permissions, unlike get_all.
    return frappe.get_list(doctype, filters={ALLOWED_LIST[doctype]: company}, fields=["name", "docstatus", "modified"], limit_page_length=limit, order_by="modified desc")

@frappe.whitelist(methods=["POST"])
def create_purchase_order_draft(company, supplier, items):
    ensure_authenticated()
    require_company(company)
    if not frappe.has_permission("Purchase Order", ptype="create"):
        frappe.throw(_("Cannot create Purchase Order"), frappe.PermissionError)
    if isinstance(items, str):
        items = frappe.parse_json(items)
    if not isinstance(items, list) or not 1 <= len(items) <= 100:
        frappe.throw(_("Provide 1–100 items"), frappe.ValidationError)
    if not isinstance(supplier, str) or not supplier.strip() or len(supplier) > 140:
        frappe.throw(_("Valid supplier required"), frappe.ValidationError)
    normalized = []
    for row in items:
        if not isinstance(row, dict) or set(row) - {"item_code", "qty", "rate", "schedule_date", "warehouse"}:
            frappe.throw(_("Invalid item fields"), frappe.ValidationError)
        try:
            qty = float(row["qty"])
            rate = float(row["rate"])
        except (KeyError, TypeError, ValueError):
            frappe.throw(_("Invalid quantity/rate"), frappe.ValidationError)
        if not 0 < qty <= 1e9 or not 0 <= rate <= 1e12:
            frappe.throw(_("Quantity/rate out of bounds"), frappe.ValidationError)
        if not isinstance(row.get("item_code"), str) or not row["item_code"].strip():
            frappe.throw(_("Item code required"), frappe.ValidationError)
        normalized.append({**row, "qty": qty, "rate": rate})
    doc = frappe.get_doc({"doctype": "Purchase Order", "company": company, "supplier": supplier, "items": normalized})
    doc.insert()  # Frappe native DocType validation + native permission checks, never ignore_permissions
    return {"name": doc.name, "docstatus": doc.docstatus, "status": "DRAFT"}

@frappe.whitelist(methods=["POST"])
def submit_document(doctype, name, company):
    require_doctype(doctype)
    require_company(company)
    if not frappe.has_permission(doctype, ptype="submit"):
        frappe.throw(_("Submit permission required"), frappe.PermissionError)
    doc = frappe.get_doc(doctype, name)
    if doc.get(ALLOWED_LIST[doctype]) != company:
        frappe.throw(_("Document is outside permitted company"), frappe.PermissionError)
    if not doc.has_permission("submit"):
        frappe.throw(_("Document submit denied"), frappe.PermissionError)
    doc.submit()  # No payment-status spoofing; native business workflow and GL validation.
    return {"name": doc.name, "docstatus": doc.docstatus}
