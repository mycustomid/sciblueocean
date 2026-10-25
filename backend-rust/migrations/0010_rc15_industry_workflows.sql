-- RC15 industry pilot dossiers: no stock mutation, final statutory release or GL posting.
CREATE TABLE rc15_projects (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),entity_id uuid NOT NULL REFERENCES legal_entities(id),
 project_code text NOT NULL CHECK(length(project_code) BETWEEN 3 AND 64),
 name text NOT NULL CHECK(length(name) BETWEEN 3 AND 240),
 budget_xaf bigint NOT NULL CHECK(budget_xaf BETWEEN 1 AND 9000000000000000),
 created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,entity_id),UNIQUE(entity_id,project_code),
 FOREIGN KEY(created_by,entity_id) REFERENCES entity_memberships(user_id,entity_id)
);
CREATE TABLE rc15_progress (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), entity_id uuid NOT NULL REFERENCES legal_entities(id),
 project_id uuid NOT NULL, completion_percent integer NOT NULL CHECK(completion_percent BETWEEN 1 AND 100),
 spent_xaf bigint NOT NULL CHECK(spent_xaf BETWEEN 0 AND 9000000000000000),
 note text NOT NULL CHECK(length(note) BETWEEN 8 AND 1000),
 status text NOT NULL DEFAULT 'submitted' CHECK(status IN ('submitted','accepted')),
 submitted_by uuid NOT NULL,accepted_by uuid,
 created_at timestamptz NOT NULL DEFAULT now(),accepted_at timestamptz,
 UNIQUE(id,entity_id),FOREIGN KEY(project_id,entity_id) REFERENCES rc15_projects(id,entity_id),
 FOREIGN KEY(submitted_by,entity_id) REFERENCES entity_memberships(user_id,entity_id),
 FOREIGN KEY(accepted_by,entity_id) REFERENCES entity_memberships(user_id,entity_id),
 CHECK(accepted_by IS NULL OR submitted_by<>accepted_by),
 CHECK((status='submitted' AND accepted_by IS NULL AND accepted_at IS NULL) OR
 (status='accepted' AND accepted_by IS NOT NULL AND accepted_at IS NOT NULL))
);
CREATE TABLE rc15_batches (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),entity_id uuid NOT NULL REFERENCES legal_entities(id),
 batch_code text NOT NULL CHECK(length(batch_code) BETWEEN 3 AND 64),
 item_id uuid NOT NULL, planned_quantity bigint NOT NULL CHECK(planned_quantity BETWEEN 1 AND 1000000000),
 produced_quantity bigint CHECK(produced_quantity BETWEEN 0 AND planned_quantity),
 brix_x100 integer CHECK(brix_x100 BETWEEN 0 AND 10000),
 status text NOT NULL DEFAULT 'planned' CHECK(status IN ('planned','awaiting_qc','qc_passed','qc_rejected','released')),
 created_by uuid NOT NULL, completed_by uuid,qc_by uuid,released_by uuid,
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(id,entity_id),UNIQUE(entity_id,batch_code),
 FOREIGN KEY(item_id,entity_id) REFERENCES inventory_items(id,entity_id),
 FOREIGN KEY(created_by,entity_id) REFERENCES entity_memberships(user_id,entity_id),
 FOREIGN KEY(completed_by,entity_id) REFERENCES entity_memberships(user_id,entity_id),
 FOREIGN KEY(qc_by,entity_id) REFERENCES entity_memberships(user_id,entity_id),
 FOREIGN KEY(released_by,entity_id) REFERENCES entity_memberships(user_id,entity_id),
 CHECK(released_by IS NULL OR (released_by<>qc_by AND released_by<>created_by))
);
CREATE TABLE rc15_import_dossiers (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),entity_id uuid NOT NULL REFERENCES legal_entities(id),
 bl_reference text NOT NULL CHECK(length(bl_reference) BETWEEN 4 AND 120),
 container_reference text NOT NULL CHECK(length(container_reference) BETWEEN 4 AND 120),
 description text NOT NULL CHECK(length(description) BETWEEN 8 AND 1000),
 eta date NOT NULL, evidence_reference text CHECK(length(evidence_reference) BETWEEN 8 AND 240),
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','documents_checked')),
 created_by uuid NOT NULL,checked_by uuid,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,entity_id),UNIQUE(entity_id,bl_reference),
 FOREIGN KEY(created_by,entity_id) REFERENCES entity_memberships(user_id,entity_id),
 FOREIGN KEY(checked_by,entity_id) REFERENCES entity_memberships(user_id,entity_id),
 CHECK(checked_by IS NULL OR checked_by<>created_by)
);
CREATE INDEX rc15_project_progress_recent ON rc15_progress(entity_id,project_id,created_at DESC);
CREATE INDEX rc15_import_recent ON rc15_import_dossiers(entity_id,created_at DESC);
-- Restrict removal of evidence. Corrections require separate adjustment events in later versions.
CREATE TRIGGER rc15_project_delete_guard BEFORE DELETE ON rc15_projects FOR EACH ROW EXECUTE FUNCTION forbid_audit_event_mutation();
CREATE TRIGGER rc15_progress_delete_guard BEFORE DELETE ON rc15_progress FOR EACH ROW EXECUTE FUNCTION forbid_audit_event_mutation();
CREATE TRIGGER rc15_batch_delete_guard BEFORE DELETE ON rc15_batches FOR EACH ROW EXECUTE FUNCTION forbid_audit_event_mutation();
CREATE TRIGGER rc15_import_delete_guard BEFORE DELETE ON rc15_import_dossiers FOR EACH ROW EXECUTE FUNCTION forbid_audit_event_mutation();

-- RC15 database backstop: business facts/approvals are not rewritable after entry.
-- Privileged migrations/operators can still change database schema; restrict DB roles in production.
ALTER TABLE rc15_batches ADD CONSTRAINT rc15_batch_state_fields CHECK(
 (status='planned' AND produced_quantity IS NULL AND completed_by IS NULL AND qc_by IS NULL AND released_by IS NULL)
 OR (status='awaiting_qc' AND produced_quantity IS NOT NULL AND completed_by IS NOT NULL AND qc_by IS NULL AND released_by IS NULL)
 OR (status IN ('qc_passed','qc_rejected') AND produced_quantity IS NOT NULL AND completed_by IS NOT NULL AND qc_by IS NOT NULL AND released_by IS NULL)
 OR (status='released' AND produced_quantity IS NOT NULL AND completed_by IS NOT NULL AND qc_by IS NOT NULL AND released_by IS NOT NULL)
);
CREATE FUNCTION rc15_guard_progress_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.status<>'submitted' OR NEW.status<>'accepted' OR
 NEW.entity_id<>OLD.entity_id OR NEW.project_id<>OLD.project_id OR NEW.completion_percent<>OLD.completion_percent OR
 NEW.spent_xaf<>OLD.spent_xaf OR NEW.note<>OLD.note OR NEW.submitted_by<>OLD.submitted_by OR
 NEW.created_at<>OLD.created_at OR NEW.accepted_by IS NULL OR NEW.accepted_by=OLD.submitted_by OR NEW.accepted_at IS NULL
 THEN RAISE EXCEPTION 'rc15_progress_immutable_or_invalid_transition'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER rc15_progress_transition_guard BEFORE UPDATE ON rc15_progress FOR EACH ROW EXECUTE FUNCTION rc15_guard_progress_update();
CREATE FUNCTION rc15_guard_batch_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.entity_id<>OLD.entity_id OR NEW.batch_code<>OLD.batch_code OR NEW.item_id<>OLD.item_id OR
 NEW.planned_quantity<>OLD.planned_quantity OR NEW.created_by<>OLD.created_by OR NEW.created_at<>OLD.created_at
 THEN RAISE EXCEPTION 'rc15_batch_identity_immutable'; END IF;
 IF (OLD.status='planned' AND NEW.status='awaiting_qc' AND NEW.produced_quantity IS NOT NULL AND
     NEW.brix_x100 IS NOT NULL AND NEW.completed_by IS NOT NULL AND NEW.qc_by IS NULL AND NEW.released_by IS NULL)
 OR (OLD.status='awaiting_qc' AND NEW.status IN ('qc_passed','qc_rejected') AND
     NEW.produced_quantity=OLD.produced_quantity AND NEW.brix_x100=OLD.brix_x100 AND
     NEW.completed_by=OLD.completed_by AND NEW.qc_by IS NOT NULL AND NEW.released_by IS NULL AND
     NEW.qc_by<>OLD.created_by AND NEW.qc_by<>OLD.completed_by)
 OR (OLD.status='qc_passed' AND NEW.status='released' AND NEW.produced_quantity=OLD.produced_quantity AND
     NEW.brix_x100=OLD.brix_x100 AND NEW.completed_by=OLD.completed_by AND NEW.qc_by=OLD.qc_by AND
     NEW.released_by IS NOT NULL AND NEW.released_by<>NEW.created_by AND NEW.released_by<>NEW.qc_by AND
     NEW.released_by<>NEW.completed_by)
 THEN RETURN NEW; END IF;
 RAISE EXCEPTION 'rc15_invalid_batch_state_transition';
END $$;
CREATE TRIGGER rc15_batch_transition_guard BEFORE UPDATE ON rc15_batches FOR EACH ROW EXECUTE FUNCTION rc15_guard_batch_update();
CREATE FUNCTION rc15_guard_import_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.status<>'draft' OR NEW.status<>'documents_checked' OR
 NEW.entity_id<>OLD.entity_id OR NEW.bl_reference<>OLD.bl_reference OR NEW.container_reference<>OLD.container_reference OR
 NEW.description<>OLD.description OR NEW.eta<>OLD.eta OR NEW.created_by<>OLD.created_by OR NEW.created_at<>OLD.created_at OR
 NEW.checked_by IS NULL OR NEW.checked_by=OLD.created_by OR NEW.evidence_reference IS NULL
 THEN RAISE EXCEPTION 'rc15_import_immutable_or_invalid_transition'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER rc15_import_transition_guard BEFORE UPDATE ON rc15_import_dossiers FOR EACH ROW EXECUTE FUNCTION rc15_guard_import_update();
CREATE TRIGGER rc15_projects_no_update BEFORE UPDATE ON rc15_projects FOR EACH ROW EXECUTE FUNCTION forbid_audit_event_mutation();
