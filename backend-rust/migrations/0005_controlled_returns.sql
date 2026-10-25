-- RC10: returns AGAINST RC9 individual fulfilment facts. NOT statutory credit notes.
-- All state + inventory + DRAFT GL written in one transaction by Rust.
-- Apply to disposable PG16 first, then independently test upgrading RC9 seed.

-- Expand audit-only movement taxonomy while preserving its polarity invariant.
DO $$ DECLARE r record; BEGIN
 FOR r IN SELECT conname FROM pg_constraint
  WHERE conrelid='inventory_movements'::regclass AND contype='c'
  AND pg_get_constraintdef(oid) LIKE '%source_type%'
 LOOP EXECUTE format('ALTER TABLE inventory_movements DROP CONSTRAINT %I',r.conname); END LOOP;
END $$;
ALTER TABLE inventory_movements ADD CONSTRAINT inventory_movements_rc10_source
 CHECK(source_type IN ('purchase_receipt','sales_shipment','customer_return','supplier_return'));
ALTER TABLE inventory_movements ADD CONSTRAINT inventory_movements_rc10_polarity
 CHECK((source_type IN ('purchase_receipt','customer_return') AND quantity_delta>0 AND value_delta_xaf>0)
    OR (source_type IN ('sales_shipment','supplier_return') AND quantity_delta<0 AND value_delta_xaf<0));

DO $$ DECLARE r record; BEGIN
 FOR r IN SELECT conname FROM pg_constraint
  WHERE conrelid='gl_journals'::regclass AND contype='c'
  AND pg_get_constraintdef(oid) LIKE '%source_trade_type%'
 LOOP EXECUTE format('ALTER TABLE gl_journals DROP CONSTRAINT %I',r.conname); END LOOP;
END $$;
ALTER TABLE gl_journals ADD CONSTRAINT gl_trade_pair_rc10 CHECK ((source_trade_type IS NULL) = (source_trade_id IS NULL));
ALTER TABLE gl_journals ADD CONSTRAINT gl_trade_type_rc10
 CHECK(source_trade_type IS NULL OR source_trade_type IN
  ('purchase_receipt','sales_shipment','customer_return','supplier_return'));

CREATE TABLE trade_returns (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 entity_id uuid NOT NULL REFERENCES legal_entities(id),
 fulfilment_id uuid NOT NULL,
 warehouse_id uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN ('customer_return','supplier_return')),
 period_key text NOT NULL CHECK(period_key ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
 request_key text NOT NULL CHECK(char_length(request_key) BETWEEN 8 AND 120),
 request_hash text NOT NULL CHECK(char_length(request_hash)=64),
 reason text NOT NULL CHECK(char_length(reason) BETWEEN 8 AND 500),
 commercial_xaf bigint NOT NULL CHECK(commercial_xaf>0),
 inventory_value_xaf bigint NOT NULL CHECK(inventory_value_xaf>0),
 journal_id uuid,
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,entity_id),
 UNIQUE(entity_id,kind,fulfilment_id,request_key),
 FOREIGN KEY(fulfilment_id,entity_id) REFERENCES trade_fulfilments(id,entity_id),
 FOREIGN KEY(warehouse_id,entity_id) REFERENCES inventory_warehouses(id,entity_id),
 FOREIGN KEY(journal_id,entity_id) REFERENCES gl_journals(id,entity_id),
 FOREIGN KEY(created_by,entity_id) REFERENCES entity_memberships(user_id,entity_id)
);
CREATE INDEX trade_returns_origin_idx ON trade_returns(entity_id,fulfilment_id,created_at DESC);

CREATE TABLE trade_return_lines (
 return_id uuid NOT NULL,
 entity_id uuid NOT NULL,
 item_id uuid NOT NULL,
 quantity bigint NOT NULL CHECK(quantity>0),
 commercial_xaf bigint NOT NULL CHECK(commercial_xaf>0),
 inventory_value_xaf bigint NOT NULL CHECK(inventory_value_xaf>0),
 PRIMARY KEY(return_id,item_id),
 FOREIGN KEY(return_id,entity_id) REFERENCES trade_returns(id,entity_id),
 FOREIGN KEY(item_id,entity_id) REFERENCES inventory_items(id,entity_id)
);
-- Prevent references to unrelated or wrong-kind fulfilments even when bypassing API.
CREATE FUNCTION verify_trade_return_origin() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE found_kind text;
BEGIN
 SELECT kind INTO found_kind FROM trade_fulfilments WHERE id=NEW.fulfilment_id AND entity_id=NEW.entity_id;
 IF found_kind IS NULL OR (NEW.kind='customer_return' AND found_kind<>'sales_shipment')
    OR (NEW.kind='supplier_return' AND found_kind<>'purchase_receipt')
 THEN RAISE EXCEPTION 'return_origin_invalid'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER trade_return_origin_guard BEFORE INSERT ON trade_returns
 FOR EACH ROW EXECUTE FUNCTION verify_trade_return_origin();
-- Once finalized, no update and no delete. Corrections need another explicit document.
CREATE FUNCTION protect_finalized_return() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' OR OLD.journal_id IS NOT NULL THEN RAISE EXCEPTION 'finalized_return_immutable'; END IF;
 IF NEW.journal_id IS NULL OR NEW.commercial_xaf<=0 OR NEW.inventory_value_xaf<=0 THEN
  RAISE EXCEPTION 'return_must_finalize_atomically';
 END IF;
 IF NEW.entity_id<>OLD.entity_id OR NEW.fulfilment_id<>OLD.fulfilment_id OR
    NEW.warehouse_id<>OLD.warehouse_id OR NEW.kind<>OLD.kind OR
    NEW.period_key<>OLD.period_key OR NEW.request_key<>OLD.request_key OR
    NEW.request_hash<>OLD.request_hash OR NEW.created_by<>OLD.created_by OR NEW.reason<>OLD.reason
 THEN RAISE EXCEPTION 'return_identity_immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER trade_returns_immutable_guard BEFORE UPDATE OR DELETE ON trade_returns
 FOR EACH ROW EXECUTE FUNCTION protect_finalized_return();
CREATE TRIGGER trade_return_lines_immutable_guard BEFORE UPDATE OR DELETE ON trade_return_lines
 FOR EACH ROW EXECUTE FUNCTION forbid_audit_event_mutation();
CREATE FUNCTION enforce_return_complete() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM trade_returns WHERE id=NEW.id AND journal_id IS NOT NULL)
 THEN RAISE EXCEPTION 'incomplete_return'; END IF;
 RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER trade_returns_commit_check AFTER INSERT ON trade_returns
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION enforce_return_complete();

-- Supplier return variance is a required mapped GL role if original price differs from current AVCO.
DO $$ DECLARE r record; BEGIN
 FOR r IN SELECT conname FROM pg_constraint WHERE conrelid='trade_posting_accounts'::regclass AND contype='c' AND pg_get_constraintdef(oid) LIKE '%posting_role%'
 LOOP EXECUTE format('ALTER TABLE trade_posting_accounts DROP CONSTRAINT %I',r.conname); END LOOP;
END $$;
ALTER TABLE trade_posting_accounts ADD CONSTRAINT trade_posting_roles_rc10
 CHECK(posting_role IN ('inventory','accounts_payable','accounts_receivable','sales_revenue','cost_of_goods_sold','purchase_price_variance'));

-- DB backstop: origin item must exist, quantity never exceeds original fulfilment.
-- FOR UPDATE serializes direct SQL clients as well as API requests for one origin event.
CREATE FUNCTION validate_return_line_origin_and_cap() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE origin uuid; original_qty bigint; already_returned bigint;
BEGIN
 SELECT r.fulfilment_id INTO origin FROM trade_returns r WHERE r.id=NEW.return_id AND r.entity_id=NEW.entity_id;
 IF origin IS NULL THEN RAISE EXCEPTION 'return_parent_missing'; END IF;
 PERFORM 1 FROM trade_fulfilments f WHERE f.id=origin AND f.entity_id=NEW.entity_id FOR UPDATE;
 SELECT l.quantity INTO original_qty FROM trade_fulfilment_lines l
  WHERE l.fulfilment_id=origin AND l.entity_id=NEW.entity_id AND l.item_id=NEW.item_id;
 IF original_qty IS NULL THEN RAISE EXCEPTION 'return_item_not_in_origin'; END IF;
 SELECT COALESCE(SUM(rl.quantity),0) INTO already_returned
  FROM trade_return_lines rl JOIN trade_returns r ON r.id=rl.return_id AND r.entity_id=rl.entity_id
  WHERE r.entity_id=NEW.entity_id AND r.fulfilment_id=origin AND rl.item_id=NEW.item_id;
 IF already_returned+NEW.quantity>original_qty THEN RAISE EXCEPTION 'return_quantity_exceeds_origin'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER trade_return_lines_origin_cap BEFORE INSERT ON trade_return_lines
 FOR EACH ROW EXECUTE FUNCTION validate_return_line_origin_and_cap();
