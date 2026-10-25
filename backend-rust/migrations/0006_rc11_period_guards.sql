-- RC11: prevent direct SQL changes to draft journal and lines in LOCKED periods.
-- Journal posting is already protected in 0001; this also guards drafts.
-- Additive for empty/disposable staging database; back up first.
CREATE OR REPLACE FUNCTION rc11_guard_journal_period() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  check_entity uuid;
  check_period text;
  is_closed boolean;
BEGIN
  IF TG_TABLE_NAME='gl_lines' THEN
    -- A line may not be moved from a closed journal to an open journal.
    IF TG_OP='UPDATE' AND (NEW.journal_id<>OLD.journal_id OR NEW.entity_id<>OLD.entity_id) THEN
      RAISE EXCEPTION 'journal_line_identity_immutable';
    END IF;
    IF TG_OP='DELETE' THEN
      SELECT entity_id,period_key INTO check_entity,check_period
        FROM gl_journals WHERE id=OLD.journal_id AND entity_id=OLD.entity_id;
    ELSE
      SELECT entity_id,period_key INTO check_entity,check_period
        FROM gl_journals WHERE id=NEW.journal_id AND entity_id=NEW.entity_id;
    END IF;
    IF check_entity IS NULL THEN RAISE EXCEPTION 'journal_parent_missing'; END IF;
  ELSE
    check_entity=NEW.entity_id;
    check_period=NEW.period_key;
    IF TG_OP='UPDATE' AND
       (OLD.entity_id<>NEW.entity_id OR OLD.period_key<>NEW.period_key) THEN
      RAISE EXCEPTION 'journal_entity_or_period_immutable';
    END IF;
  END IF;

  -- Lock period row so close and journal mutation cannot race.
  SELECT is_locked INTO is_closed FROM gl_periods
    WHERE entity_id=check_entity AND period_key=check_period FOR SHARE;
  IF is_closed IS DISTINCT FROM false THEN RAISE EXCEPTION 'period_is_closed'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER rc11_gl_lines_period_guard
 BEFORE INSERT OR UPDATE OR DELETE ON gl_lines
 FOR EACH ROW EXECUTE FUNCTION rc11_guard_journal_period();
CREATE TRIGGER rc11_gl_journals_period_guard
 BEFORE INSERT OR UPDATE ON gl_journals
 FOR EACH ROW EXECUTE FUNCTION rc11_guard_journal_period();

-- DB backstop for journal posting metadata, including direct SQL clients.
ALTER TABLE gl_journals ADD CONSTRAINT rc11_posted_requires_identity_and_time CHECK
 ((status='draft' AND posted_by IS NULL AND posted_at IS NULL)
  OR (status='posted' AND posted_by IS NOT NULL AND posted_at IS NOT NULL));
