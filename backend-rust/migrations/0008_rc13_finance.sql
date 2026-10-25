-- RC13 limited XAF receivables and banking evidence. No legal tax certificate generation.
-- Finance mappings are verified by the implementer, not assumed to be SYSCOHADA-compliant.
CREATE TABLE rc13_accounts (
 entity_id uuid NOT NULL REFERENCES legal_entities(id),
 role text NOT NULL CHECK(role IN ('ar','revenue','bank')),
 account_id uuid NOT NULL,
 PRIMARY KEY(entity_id,role),
 FOREIGN KEY(account_id,entity_id) REFERENCES gl_accounts(id,entity_id)
);
CREATE TABLE rc13_invoices (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 entity_id uuid NOT NULL REFERENCES legal_entities(id),
 customer text NOT NULL CHECK(length(customer) BETWEEN 2 AND 240),
 description text NOT NULL CHECK(length(description) BETWEEN 4 AND 1000),
 external_ref text NOT NULL CHECK(length(external_ref) BETWEEN 4 AND 100),
 total_xaf bigint NOT NULL CHECK(total_xaf BETWEEN 1 AND 9000000000000000),
 paid_xaf bigint NOT NULL DEFAULT 0 CHECK(paid_xaf>=0 AND paid_xaf<=total_xaf),
 period_key text NOT NULL CHECK(period_key ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','issued','partial','paid')),
 created_by uuid NOT NULL, issued_by uuid, journal_id uuid,
 created_at timestamptz NOT NULL DEFAULT now(), issued_at timestamptz,
 UNIQUE(id,entity_id), UNIQUE(entity_id,external_ref),
 FOREIGN KEY(created_by,entity_id) REFERENCES entity_memberships(user_id,entity_id),
 FOREIGN KEY(issued_by,entity_id) REFERENCES entity_memberships(user_id,entity_id),
 FOREIGN KEY(journal_id,entity_id) REFERENCES gl_journals(id,entity_id),
 CHECK(issued_by IS NULL OR created_by<>issued_by),
 CHECK((status='draft' AND issued_by IS NULL AND journal_id IS NULL AND paid_xaf=0) OR
 (status<>'draft' AND issued_by IS NOT NULL AND journal_id IS NOT NULL))
);
CREATE TABLE rc13_receipts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 entity_id uuid NOT NULL REFERENCES legal_entities(id),
 invoice_id uuid NOT NULL,
 amount_xaf bigint NOT NULL CHECK(amount_xaf BETWEEN 1 AND 9000000000000000),
 payment_ref text NOT NULL CHECK(length(payment_ref) BETWEEN 4 AND 120),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','matched')),
 created_by uuid NOT NULL, matched_by uuid, bank_line_id uuid, journal_id uuid,
 created_at timestamptz NOT NULL DEFAULT now(),matched_at timestamptz,
 UNIQUE(id,entity_id), UNIQUE(entity_id,payment_ref),
 FOREIGN KEY(invoice_id,entity_id) REFERENCES rc13_invoices(id,entity_id),
 FOREIGN KEY(created_by,entity_id) REFERENCES entity_memberships(user_id,entity_id),
 FOREIGN KEY(matched_by,entity_id) REFERENCES entity_memberships(user_id,entity_id),
 FOREIGN KEY(journal_id,entity_id) REFERENCES gl_journals(id,entity_id),
 CHECK(matched_by IS NULL OR matched_by<>created_by),
 CHECK((status='pending' AND matched_by IS NULL AND bank_line_id IS NULL AND journal_id IS NULL) OR
 (status='matched' AND matched_by IS NOT NULL AND bank_line_id IS NOT NULL AND journal_id IS NOT NULL))
);
CREATE TABLE rc13_bank_lines (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 entity_id uuid NOT NULL REFERENCES legal_entities(id),
 bank_reference text NOT NULL CHECK(length(bank_reference) BETWEEN 4 AND 120),
 amount_xaf bigint NOT NULL CHECK(amount_xaf>0 AND amount_xaf<=9000000000000000),
 currency text NOT NULL DEFAULT 'XAF' CHECK(currency='XAF'),
 created_by uuid NOT NULL,
 matched_receipt_id uuid,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,entity_id), UNIQUE(entity_id,bank_reference),
 FOREIGN KEY(created_by,entity_id) REFERENCES entity_memberships(user_id,entity_id),
 FOREIGN KEY(matched_receipt_id,entity_id) REFERENCES rc13_receipts(id,entity_id)
);
ALTER TABLE rc13_receipts ADD CONSTRAINT rc13_receipt_bank_scope FOREIGN KEY(bank_line_id,entity_id) REFERENCES rc13_bank_lines(id,entity_id);
CREATE INDEX rc13_invoice_recent ON rc13_invoices(entity_id,created_at DESC);
CREATE INDEX rc13_receipt_invoice ON rc13_receipts(entity_id,invoice_id);
CREATE OR REPLACE FUNCTION rc13_prevent_closed_invoice_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'invoice_delete_forbidden'; END IF;
 IF OLD.entity_id<>NEW.entity_id OR OLD.customer<>NEW.customer OR OLD.description<>NEW.description OR
 OLD.total_xaf<>NEW.total_xaf OR OLD.period_key<>NEW.period_key OR OLD.external_ref<>NEW.external_ref OR
 OLD.created_by<>NEW.created_by OR OLD.created_at<>NEW.created_at OR
 (OLD.status<>'draft' AND (OLD.issued_by IS DISTINCT FROM NEW.issued_by OR OLD.journal_id IS DISTINCT FROM NEW.journal_id)) OR
 NEW.paid_xaf<OLD.paid_xaf OR (OLD.status='paid' AND NEW.status<>'paid')
 THEN RAISE EXCEPTION 'invoice_immutable_business_fields'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER rc13_invoice_guard BEFORE UPDATE OR DELETE ON rc13_invoices FOR EACH ROW EXECUTE FUNCTION rc13_prevent_closed_invoice_mutation();
CREATE TRIGGER rc13_bank_audit_no_delete BEFORE DELETE ON rc13_bank_lines FOR EACH ROW EXECUTE FUNCTION forbid_audit_event_mutation();
CREATE TRIGGER rc13_receipts_audit_no_delete BEFORE DELETE ON rc13_receipts FOR EACH ROW EXECUTE FUNCTION forbid_audit_event_mutation();
