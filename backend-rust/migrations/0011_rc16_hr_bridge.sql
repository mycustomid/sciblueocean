-- RC16: HR/payroll PREVIEW only; no statutory CNPS/IRPP, bank transfer or posting.
-- Employee compensation is sensitive; API read endpoints MUST enforce HR roles.
ALTER TABLE entity_memberships DROP CONSTRAINT entity_memberships_role_check;
ALTER TABLE entity_memberships ADD CONSTRAINT entity_memberships_role_check
 CHECK (role IN ('group_admin','executive','finance','manager','operator','auditor','hr','hr_manager'));

CREATE TABLE rc16_employees (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), entity_id uuid NOT NULL REFERENCES legal_entities(id),
 staff_code text NOT NULL CHECK(length(staff_code) BETWEEN 3 AND 40),
 display_name text NOT NULL CHECK(length(trim(display_name)) BETWEEN 2 AND 160),
 monthly_base_xaf bigint NOT NULL CHECK(monthly_base_xaf BETWEEN 1 AND 100000000000),
 active boolean NOT NULL DEFAULT true,
 created_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,entity_id),UNIQUE(entity_id,staff_code),
 FOREIGN KEY(created_by,entity_id) REFERENCES entity_memberships(user_id,entity_id)
);
CREATE TABLE rc16_attendance (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),entity_id uuid NOT NULL REFERENCES legal_entities(id),
 employee_id uuid NOT NULL, work_day date NOT NULL,
 minutes_worked int NOT NULL CHECK(minutes_worked BETWEEN 0 AND 1440),
 status text NOT NULL DEFAULT 'submitted' CHECK(status IN ('submitted','accepted')),
 created_by uuid NOT NULL,accepted_by uuid,created_at timestamptz NOT NULL DEFAULT now(),accepted_at timestamptz,
 UNIQUE(id,entity_id),UNIQUE(entity_id,employee_id,work_day),
 FOREIGN KEY(employee_id,entity_id) REFERENCES rc16_employees(id,entity_id),
 FOREIGN KEY(created_by,entity_id) REFERENCES entity_memberships(user_id,entity_id),
 FOREIGN KEY(accepted_by,entity_id) REFERENCES entity_memberships(user_id,entity_id),
 CHECK((status='submitted' AND accepted_by IS NULL AND accepted_at IS NULL) OR
 (status='accepted' AND accepted_by IS NOT NULL AND accepted_by<>created_by AND accepted_at IS NOT NULL))
);
CREATE TABLE rc16_leave_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),entity_id uuid NOT NULL REFERENCES legal_entities(id),
 employee_id uuid NOT NULL,starts_on date NOT NULL,ends_on date NOT NULL,
 reason text NOT NULL CHECK(length(trim(reason)) BETWEEN 5 AND 500),
 status text NOT NULL DEFAULT 'submitted' CHECK(status IN ('submitted','approved','rejected')),
 created_by uuid NOT NULL,reviewed_by uuid,created_at timestamptz NOT NULL DEFAULT now(),reviewed_at timestamptz,
 UNIQUE(id,entity_id),CHECK(ends_on>=starts_on), CHECK(ends_on-starts_on<=90),
 FOREIGN KEY(employee_id,entity_id) REFERENCES rc16_employees(id,entity_id),
 FOREIGN KEY(created_by,entity_id) REFERENCES entity_memberships(user_id,entity_id),
 FOREIGN KEY(reviewed_by,entity_id) REFERENCES entity_memberships(user_id,entity_id),
 CHECK((status='submitted' AND reviewed_by IS NULL AND reviewed_at IS NULL) OR
 (status IN ('approved','rejected') AND reviewed_by IS NOT NULL AND reviewed_by<>created_by AND reviewed_at IS NOT NULL))
);
-- Do not assume all leave requests are legally payroll-deductible.
CREATE TABLE rc16_payroll_runs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),entity_id uuid NOT NULL REFERENCES legal_entities(id),
 period_key text NOT NULL CHECK(period_key ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','manager_reviewed','finance_verified')),
 created_by uuid NOT NULL,manager_by uuid,finance_by uuid,
 created_at timestamptz NOT NULL DEFAULT now(),reviewed_at timestamptz,verified_at timestamptz,
 UNIQUE(id,entity_id),UNIQUE(entity_id,period_key),
 FOREIGN KEY(created_by,entity_id) REFERENCES entity_memberships(user_id,entity_id),
 FOREIGN KEY(manager_by,entity_id) REFERENCES entity_memberships(user_id,entity_id),
 FOREIGN KEY(finance_by,entity_id) REFERENCES entity_memberships(user_id,entity_id),
 CHECK((status='draft' AND manager_by IS NULL AND finance_by IS NULL AND reviewed_at IS NULL AND verified_at IS NULL) OR
 (status='manager_reviewed' AND manager_by IS NOT NULL AND manager_by<>created_by AND reviewed_at IS NOT NULL AND finance_by IS NULL AND verified_at IS NULL) OR
 (status='finance_verified' AND manager_by IS NOT NULL AND finance_by IS NOT NULL AND
 manager_by<>created_by AND finance_by<>created_by AND finance_by<>manager_by AND reviewed_at IS NOT NULL AND verified_at IS NOT NULL))
);
CREATE TABLE rc16_payroll_lines (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), entity_id uuid NOT NULL REFERENCES legal_entities(id),
 run_id uuid NOT NULL,employee_id uuid NOT NULL,
 monthly_base_xaf bigint NOT NULL CHECK(monthly_base_xaf BETWEEN 1 AND 100000000000),
 -- Only base-salary forecast; tax/deduction/net amounts deliberately NOT computed.
 UNIQUE(run_id,employee_id),
 FOREIGN KEY(run_id,entity_id) REFERENCES rc16_payroll_runs(id,entity_id),
 FOREIGN KEY(employee_id,entity_id) REFERENCES rc16_employees(id,entity_id)
);
CREATE INDEX rc16_attendance_entity_day ON rc16_attendance(entity_id,work_day DESC);
CREATE INDEX rc16_leave_entity_recent ON rc16_leave_requests(entity_id,created_at DESC);
CREATE INDEX rc16_payroll_entity_recent ON rc16_payroll_runs(entity_id,period_key DESC);

-- Tamper protection: employees are append-only until controlled amendment workflows exist;
-- attendance and leave states can transition once, no direct modification of business facts.
CREATE TRIGGER rc16_employee_update_guard BEFORE UPDATE OR DELETE ON rc16_employees
 FOR EACH ROW EXECUTE FUNCTION forbid_audit_event_mutation();
CREATE TRIGGER rc16_payroll_line_guard BEFORE UPDATE OR DELETE ON rc16_payroll_lines
 FOR EACH ROW EXECUTE FUNCTION forbid_audit_event_mutation();
CREATE FUNCTION rc16_attendance_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'attendance_immutable'; END IF;
 IF OLD.status<>'submitted' OR NEW.status<>'accepted' OR
 (to_jsonb(NEW) - 'status' - 'accepted_by' - 'accepted_at') IS DISTINCT FROM
 (to_jsonb(OLD) - 'status' - 'accepted_by' - 'accepted_at') OR
 NEW.accepted_by IS NULL OR NEW.accepted_by=OLD.created_by OR NEW.accepted_at IS NULL
 THEN RAISE EXCEPTION 'attendance_invalid_transition'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER rc16_attendance_state BEFORE UPDATE OR DELETE ON rc16_attendance
 FOR EACH ROW EXECUTE FUNCTION rc16_attendance_guard();
CREATE FUNCTION rc16_leave_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'leave_immutable'; END IF;
 IF OLD.status<>'submitted' OR NEW.status NOT IN ('approved','rejected') OR
 (to_jsonb(NEW) - 'status' - 'reviewed_by' - 'reviewed_at') IS DISTINCT FROM
 (to_jsonb(OLD) - 'status' - 'reviewed_by' - 'reviewed_at') OR
 NEW.reviewed_by IS NULL OR NEW.reviewed_by=OLD.created_by OR NEW.reviewed_at IS NULL
 THEN RAISE EXCEPTION 'leave_invalid_transition'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER rc16_leave_state BEFORE UPDATE OR DELETE ON rc16_leave_requests
 FOR EACH ROW EXECUTE FUNCTION rc16_leave_guard();
CREATE FUNCTION rc16_run_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'payroll_immutable'; END IF;
 IF (to_jsonb(NEW) - 'status' - 'manager_by' - 'finance_by' - 'reviewed_at' - 'verified_at') IS DISTINCT FROM
 (to_jsonb(OLD) - 'status' - 'manager_by' - 'finance_by' - 'reviewed_at' - 'verified_at')
 THEN RAISE EXCEPTION 'payroll_facts_immutable'; END IF;
 IF OLD.status='draft' AND NEW.status='manager_reviewed' AND NEW.manager_by IS NOT NULL AND NEW.manager_by<>OLD.created_by AND NEW.reviewed_at IS NOT NULL
 AND NEW.finance_by IS NULL AND NEW.verified_at IS NULL THEN RETURN NEW; END IF;
 IF OLD.status='manager_reviewed' AND NEW.status='finance_verified' AND NEW.manager_by=OLD.manager_by AND
 NEW.reviewed_at=OLD.reviewed_at AND NEW.finance_by IS NOT NULL AND NEW.finance_by<>OLD.created_by AND NEW.finance_by<>OLD.manager_by
 AND NEW.verified_at IS NOT NULL THEN RETURN NEW; END IF;
 RAISE EXCEPTION 'payroll_invalid_transition';
END $$;
CREATE TRIGGER rc16_run_state BEFORE UPDATE OR DELETE ON rc16_payroll_runs
 FOR EACH ROW EXECUTE FUNCTION rc16_run_guard();
