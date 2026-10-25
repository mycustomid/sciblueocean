-- Blue Line ERP RC6: enterprise foundation. Demo chart/accounts, NOT certified SYSCOHADA localization.
-- All monetary values in this checkpoint are integer XAF units (no FX revaluation yet).
-- PostgreSQL 16 provides gen_random_uuid() without an extension.

CREATE TABLE legal_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_name text NOT NULL CHECK (char_length(legal_name) BETWEEN 2 AND 180),
  country_code char(2) NOT NULL DEFAULT 'CM',
  registration_number text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE operating_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES legal_entities(id),
  code text NOT NULL,
  name text NOT NULL,
  UNIQUE (entity_id, code),
  UNIQUE (id, entity_id)
);

CREATE TABLE app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE CHECK (position('@' in email) > 1),
  display_name text NOT NULL,
  password_hash text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE entity_memberships (
  user_id uuid NOT NULL REFERENCES app_users(id),
  entity_id uuid NOT NULL REFERENCES legal_entities(id),
  role text NOT NULL CHECK (role IN ('group_admin','executive','finance','manager','operator','auditor')),
  active boolean NOT NULL DEFAULT true,
  PRIMARY KEY (user_id, entity_id)
);

CREATE TABLE auth_sessions (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES app_users(id),
  entity_id uuid NOT NULL REFERENCES legal_entities(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz
);
CREATE INDEX auth_sessions_user_idx ON auth_sessions(user_id,expires_at);

CREATE TABLE erp_modules (
  module_key text PRIMARY KEY,
  name text NOT NULL,
  domain_category text NOT NULL CHECK (domain_category IN ('holding','business','shared_service')),
  rollout_status text NOT NULL DEFAULT 'prototype'
);
INSERT INTO erp_modules(module_key,name,domain_category) VALUES
  ('holding','Holding & CAPEX','holding'),
  ('blex','BLEX Currency Exchange','business'),
  ('property','SCI Blue Ocean / Hotel & Property','business'),
  ('construction','Blue Line Construction','business'),
  ('sugar','Blue Line Sugar Manufacturing','business'),
  ('trade','Import / Assembly / Trade','business'),
  ('finance','Finance & SYSCOHADA','shared_service'),
  ('hr','HR & Payroll','shared_service'),
  ('digital','Digital, IT & AI','shared_service');

CREATE TABLE domain_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES legal_entities(id),
  unit_id uuid,
  module_key text NOT NULL REFERENCES erp_modules(module_key),
  external_ref text,
  counterparty text NOT NULL CHECK (char_length(counterparty) BETWEEN 2 AND 240),
  description text NOT NULL CHECK (char_length(description) BETWEEN 3 AND 2000),
  amount_xaf bigint NOT NULL CHECK (amount_xaf BETWEEN 0 AND 9000000000000000),
  currency char(3) NOT NULL DEFAULT 'XAF' CHECK (currency = 'XAF'),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','manager_approved','finance_approved','approved','rejected')),
  created_by uuid NOT NULL REFERENCES app_users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version int NOT NULL DEFAULT 1 CHECK (version > 0),
  UNIQUE(id, entity_id),
  UNIQUE(entity_id,external_ref),
  FOREIGN KEY(unit_id,entity_id) REFERENCES operating_units(id,entity_id)
);
CREATE INDEX domain_records_entity_module_idx ON domain_records(entity_id,module_key,created_at DESC);

CREATE TABLE workflow_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES legal_entities(id),
  record_id uuid NOT NULL,
  actor_id uuid NOT NULL REFERENCES app_users(id),
  from_status text NOT NULL,
  to_status text NOT NULL,
  action text NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(record_id,entity_id) REFERENCES domain_records(id,entity_id)
);
CREATE INDEX workflow_events_record_idx ON workflow_events(record_id,created_at);

CREATE TABLE api_idempotency (
  entity_id uuid NOT NULL REFERENCES legal_entities(id),
  operation text NOT NULL,
  request_key text NOT NULL CHECK(length(request_key) BETWEEN 8 AND 120),
  request_hash text NOT NULL,
  resource_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(entity_id,operation,request_key)
);

CREATE TABLE gl_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES legal_entities(id),
  code text NOT NULL,
  label text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  UNIQUE(entity_id,code),
  UNIQUE(id,entity_id)
);

CREATE TABLE gl_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES legal_entities(id),
  period_key text NOT NULL CHECK (period_key ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  is_locked boolean NOT NULL DEFAULT false,
  UNIQUE(entity_id,period_key)
);

CREATE TABLE gl_journals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES legal_entities(id),
  period_key text NOT NULL,
  memo text NOT NULL CHECK (char_length(memo) BETWEEN 4 AND 1000),
  source_record_id uuid,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','posted')),
  created_by uuid NOT NULL REFERENCES app_users(id),
  posted_by uuid REFERENCES app_users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  posted_at timestamptz,
  UNIQUE(id,entity_id),
  FOREIGN KEY(source_record_id,entity_id) REFERENCES domain_records(id,entity_id),
  FOREIGN KEY(entity_id,period_key) REFERENCES gl_periods(entity_id,period_key)
);

CREATE TABLE gl_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES legal_entities(id),
  journal_id uuid NOT NULL,
  account_id uuid NOT NULL,
  debit_xaf bigint NOT NULL DEFAULT 0 CHECK (debit_xaf >= 0),
  credit_xaf bigint NOT NULL DEFAULT 0 CHECK (credit_xaf >= 0),
  CHECK ((debit_xaf > 0 AND credit_xaf = 0) OR (credit_xaf > 0 AND debit_xaf = 0)),
  FOREIGN KEY(journal_id,entity_id) REFERENCES gl_journals(id,entity_id),
  FOREIGN KEY(account_id,entity_id) REFERENCES gl_accounts(id,entity_id)
);
CREATE INDEX gl_lines_journal_idx ON gl_lines(journal_id);

CREATE TABLE audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES legal_entities(id),
  actor_id uuid REFERENCES app_users(id),
  event_type text NOT NULL,
  resource_type text NOT NULL,
  resource_id uuid NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_events_entity_created_idx ON audit_events(entity_id,created_at DESC);

-- Database backstop: posted journals cannot be edited or deleted using application permissions.
CREATE OR REPLACE FUNCTION forbid_posted_journal_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE current_status text;
BEGIN
  IF TG_TABLE_NAME = 'gl_lines' THEN
    IF TG_OP = 'DELETE' THEN
      SELECT status INTO current_status FROM gl_journals WHERE id=OLD.journal_id;
    ELSE
      SELECT status INTO current_status FROM gl_journals WHERE id=NEW.journal_id;
    END IF;
    IF current_status = 'posted' THEN RAISE EXCEPTION 'posted_journal_immutable'; END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.status = 'posted' THEN RAISE EXCEPTION 'posted_journal_immutable'; END IF;
  ELSIF OLD.status = 'posted' THEN
    RAISE EXCEPTION 'posted_journal_immutable';
  END IF;
  RETURN COALESCE(NEW,OLD);
END $$;
CREATE TRIGGER gl_lines_no_posted_update BEFORE INSERT OR UPDATE OR DELETE ON gl_lines
  FOR EACH ROW EXECUTE FUNCTION forbid_posted_journal_mutation();
CREATE TRIGGER gl_journals_no_posted_change BEFORE UPDATE OR DELETE ON gl_journals
  FOR EACH ROW EXECUTE FUNCTION forbid_posted_journal_mutation();

-- Enforced at DB layer: no unbalanced or empty journal may be posted, even through SQL clients.
CREATE OR REPLACE FUNCTION enforce_posted_journal_balance() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE dr numeric; cr numeric; lines_count int; closed boolean;
BEGIN
  IF NEW.status = 'posted' AND OLD.status <> 'posted' THEN
    SELECT count(*), COALESCE(sum(debit_xaf),0), COALESCE(sum(credit_xaf),0)
      INTO lines_count,dr,cr FROM gl_lines WHERE journal_id = NEW.id;
    IF lines_count < 2 OR dr <= 0 OR dr <> cr THEN
      RAISE EXCEPTION 'journal_not_balanced';
    END IF;
    SELECT is_locked INTO closed FROM gl_periods
      WHERE entity_id = NEW.entity_id AND period_key = NEW.period_key;
    IF closed IS DISTINCT FROM false THEN RAISE EXCEPTION 'period_is_closed'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER gl_journals_balance_before_post BEFORE UPDATE OF status ON gl_journals
  FOR EACH ROW EXECUTE FUNCTION enforce_posted_journal_balance();

-- Prevent silent changes to audit histories and approved financial values.
CREATE OR REPLACE FUNCTION forbid_audit_event_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'audit_event_immutable'; END $$;
CREATE TRIGGER audit_events_append_only BEFORE UPDATE OR DELETE ON audit_events
  FOR EACH ROW EXECUTE FUNCTION forbid_audit_event_mutation();
CREATE TRIGGER workflow_events_append_only BEFORE UPDATE OR DELETE ON workflow_events
  FOR EACH ROW EXECUTE FUNCTION forbid_audit_event_mutation();
