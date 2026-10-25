-- RC5 architecture reference migration; NOT wired to the current demo API.
-- PostgreSQL 15+ recommended. Apply only after DBA review and integration plan.
-- ERP businesses may have 5 operating units but not necessarily 9 legal entities.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS erp_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text UNIQUE NOT NULL,
  display_name text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS legal_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), group_id uuid NOT NULL REFERENCES erp_groups(id),
  code text NOT NULL, legal_name text NOT NULL, registration_number text,
  currency_code char(3) NOT NULL DEFAULT 'XAF', active boolean NOT NULL DEFAULT true,
  UNIQUE(group_id, code));
CREATE TABLE IF NOT EXISTS facilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), entity_id uuid NOT NULL REFERENCES legal_entities(id),
  code text NOT NULL, name text NOT NULL, facility_type text NOT NULL,
  UNIQUE(entity_id, code));
CREATE TABLE IF NOT EXISTS cost_centers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), entity_id uuid NOT NULL REFERENCES legal_entities(id),
  code text NOT NULL, name text NOT NULL, UNIQUE(entity_id, code));
CREATE TABLE IF NOT EXISTS app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), identity_subject text UNIQUE NOT NULL,
  display_name text NOT NULL, disabled boolean NOT NULL DEFAULT false);
CREATE TABLE IF NOT EXISTS membership_roles (
  user_id uuid NOT NULL REFERENCES app_users(id), entity_id uuid NOT NULL REFERENCES legal_entities(id),
  role_code text NOT NULL, PRIMARY KEY(user_id,entity_id,role_code));
CREATE TABLE IF NOT EXISTS business_parties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), group_id uuid NOT NULL REFERENCES erp_groups(id),
  kind text NOT NULL CHECK(kind IN('customer','supplier','employee','counterparty')),
  display_name text NOT NULL, external_ref text, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS domains (
  code text PRIMARY KEY, display_name text NOT NULL, class text NOT NULL
  CHECK(class IN('holding','operating','shared_service')));
CREATE TABLE IF NOT EXISTS workflow_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), domain_code text NOT NULL REFERENCES domains(code),
  document_type text NOT NULL, version integer NOT NULL CHECK(version>0),
  UNIQUE(domain_code,document_type,version));
CREATE TABLE IF NOT EXISTS workflow_states (
  definition_id uuid NOT NULL REFERENCES workflow_definitions(id), code text NOT NULL,
  label text NOT NULL, terminal boolean NOT NULL DEFAULT false,
  PRIMARY KEY(definition_id,code));
CREATE TABLE IF NOT EXISTS workflow_transitions (
  definition_id uuid NOT NULL REFERENCES workflow_definitions(id), from_state text NOT NULL,
  to_state text NOT NULL, permission_code text NOT NULL, requires_evidence boolean NOT NULL DEFAULT true,
  PRIMARY KEY(definition_id,from_state,to_state),
  FOREIGN KEY(definition_id,from_state) REFERENCES workflow_states(definition_id,code),
  FOREIGN KEY(definition_id,to_state) REFERENCES workflow_states(definition_id,code));
CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), entity_id uuid NOT NULL REFERENCES legal_entities(id),
  domain_code text NOT NULL REFERENCES domains(code), document_type text NOT NULL,
  reference text NOT NULL, counterparty_id uuid REFERENCES business_parties(id),
  cost_center_id uuid REFERENCES cost_centers(id),
  workflow_definition_id uuid REFERENCES workflow_definitions(id),
  state_code text NOT NULL DEFAULT 'draft', currency_code char(3) NOT NULL DEFAULT 'XAF',
  amount numeric(20,2) NOT NULL DEFAULT 0 CHECK(amount>=0),
  created_by uuid NOT NULL REFERENCES app_users(id), created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(entity_id,domain_code,reference));
CREATE TABLE IF NOT EXISTS document_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, document_id uuid NOT NULL REFERENCES documents(id),
  actor_id uuid NOT NULL REFERENCES app_users(id), event_type text NOT NULL,
  old_state text,new_state text, created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb);
CREATE INDEX IF NOT EXISTS doc_events_doc_idx ON document_events(document_id,created_at);
CREATE TABLE IF NOT EXISTS document_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), document_id uuid NOT NULL REFERENCES documents(id),
  storage_key text NOT NULL, sha256 char(64) NOT NULL, mime_type text NOT NULL,
  uploaded_by uuid NOT NULL REFERENCES app_users(id), uploaded_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS gl_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), entity_id uuid NOT NULL REFERENCES legal_entities(id),
  code text NOT NULL, name text NOT NULL, UNIQUE(entity_id,code));
CREATE TABLE IF NOT EXISTS journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), entity_id uuid NOT NULL REFERENCES legal_entities(id),
  document_id uuid REFERENCES documents(id), journal_code text NOT NULL,
  reference text NOT NULL, posted_at timestamptz,
  status text NOT NULL DEFAULT 'draft' CHECK(status IN('draft','posted','reversed')),
  UNIQUE(entity_id,journal_code,reference));
CREATE TABLE IF NOT EXISTS journal_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), entry_id uuid NOT NULL REFERENCES journal_entries(id),
  account_id uuid NOT NULL REFERENCES gl_accounts(id),
  debit numeric(20,2) NOT NULL DEFAULT 0 CHECK(debit>=0),
  credit numeric(20,2) NOT NULL DEFAULT 0 CHECK(credit>=0),
  CHECK ((debit>0 AND credit=0) OR (credit>0 AND debit=0)));
CREATE INDEX IF NOT EXISTS journal_lines_entry_idx ON journal_lines(entry_id);
-- Production posting must be implemented as a SERIALIZABLE server-side transaction,
-- verifying both entity ownership and SUM(debit)=SUM(credit) per entry.
-- Row-level security must be applied using verified authenticated memberships;
-- do not rely on request-provided entity_id. These tables are private by default.
COMMIT;
