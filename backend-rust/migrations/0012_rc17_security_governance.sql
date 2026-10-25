-- RC17 server-side session invalidation and DB financial-access backstops.
-- No RLS is enabled here: current SQLx pool has no verified SET LOCAL tenant context.
ALTER TABLE app_users ADD COLUMN session_epoch bigint NOT NULL DEFAULT 1 CHECK(session_epoch>0);
ALTER TABLE auth_sessions ADD COLUMN session_epoch bigint NOT NULL DEFAULT 1 CHECK(session_epoch>0);
CREATE INDEX auth_sessions_entity_live ON auth_sessions(entity_id,expires_at) WHERE revoked_at IS NULL;

-- Membership changes revoke *all* sessions of that principal to prevent stale authority.
CREATE FUNCTION rc17_revoke_sessions_on_membership_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (OLD.role,OLD.active) IS DISTINCT FROM (NEW.role,NEW.active) THEN
   UPDATE app_users SET session_epoch=session_epoch+1 WHERE id=NEW.user_id;
   UPDATE auth_sessions SET revoked_at=now() WHERE user_id=NEW.user_id AND revoked_at IS NULL;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER rc17_member_revoke AFTER UPDATE OF role,active ON entity_memberships
 FOR EACH ROW EXECUTE FUNCTION rc17_revoke_sessions_on_membership_change();
-- Historical security events remain append-only via the core audit-events trigger.
CREATE TABLE rc17_security_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),entity_id uuid NOT NULL REFERENCES legal_entities(id),
 actor_id uuid NOT NULL,subject_id uuid NOT NULL,action text NOT NULL
 CHECK(action IN ('revoke_self','revoke_member_sessions')),
 at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(actor_id,entity_id) REFERENCES entity_memberships(user_id,entity_id),
 FOREIGN KEY(subject_id,entity_id) REFERENCES entity_memberships(user_id,entity_id)
);
CREATE TRIGGER rc17_security_event_immutable BEFORE UPDATE OR DELETE ON rc17_security_events
 FOR EACH ROW EXECUTE FUNCTION forbid_audit_event_mutation();
CREATE INDEX rc17_security_events_recent ON rc17_security_events(entity_id,at DESC);
