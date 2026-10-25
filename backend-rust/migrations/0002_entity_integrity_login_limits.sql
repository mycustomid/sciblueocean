-- RC7 incremental guards for the RC6 schema. Apply to disposable DB before any customer data.
-- Reject pre-existing cross-entity relations instead of silently reassigning records.
ALTER TABLE auth_sessions ADD CONSTRAINT auth_sessions_member_scope
  FOREIGN KEY (user_id,entity_id) REFERENCES entity_memberships(user_id,entity_id);
ALTER TABLE domain_records ADD CONSTRAINT domain_records_creator_scope
  FOREIGN KEY (created_by,entity_id) REFERENCES entity_memberships(user_id,entity_id);
ALTER TABLE workflow_events ADD CONSTRAINT workflow_events_actor_scope
  FOREIGN KEY (actor_id,entity_id) REFERENCES entity_memberships(user_id,entity_id);
ALTER TABLE gl_journals ADD CONSTRAINT gl_journals_creator_scope
  FOREIGN KEY (created_by,entity_id) REFERENCES entity_memberships(user_id,entity_id);
ALTER TABLE gl_journals ADD CONSTRAINT gl_journals_poster_scope
  FOREIGN KEY (posted_by,entity_id) REFERENCES entity_memberships(user_id,entity_id);
ALTER TABLE audit_events ADD CONSTRAINT audit_events_actor_scope
  FOREIGN KEY (actor_id,entity_id) REFERENCES entity_memberships(user_id,entity_id);
ALTER TABLE api_idempotency ADD CONSTRAINT api_idempotency_record_scope
  FOREIGN KEY (resource_id,entity_id) REFERENCES domain_records(id,entity_id);
CREATE INDEX workflow_events_entity_record_idx ON workflow_events(entity_id,record_id,created_at);
CREATE INDEX gl_journals_entity_status_idx ON gl_journals(entity_id,status,created_at DESC);
CREATE INDEX auth_sessions_valid_idx ON auth_sessions(expires_at) WHERE revoked_at IS NULL;

-- Account/entity throttle for local pilot. Email is stored as a digest, never plaintext.
-- 5 failed attempts within 15 minutes prevents further password guesses for that user/entity.
CREATE TABLE auth_login_attempts (
  entity_id uuid NOT NULL,
  email_digest text NOT NULL,
  failures int NOT NULL DEFAULT 0 CHECK (failures >= 0),
  last_failed timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (entity_id,email_digest)
);
