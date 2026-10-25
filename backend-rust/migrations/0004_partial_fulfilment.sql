-- RC9 additive migration: partial receipts and shipments. RC8 single-shot operations remain supported.
-- Apply only after backup/upgrade validation; no automatic live migration approved.
ALTER TABLE trade_purchase_lines ADD COLUMN received_qty bigint NOT NULL DEFAULT 0 CHECK (received_qty>=0);
ALTER TABLE trade_purchase_lines ADD CONSTRAINT purchase_received_within_order CHECK(received_qty<=quantity);
ALTER TABLE trade_sales_lines ADD COLUMN shipped_qty bigint NOT NULL DEFAULT 0 CHECK (shipped_qty>=0);
ALTER TABLE trade_sales_lines ADD CONSTRAINT sales_shipped_within_order CHECK(shipped_qty<=quantity);
-- Backfill fulfilment counters for RC8 *already-closed* source orders.
UPDATE trade_purchase_lines l SET received_qty=l.quantity
 WHERE EXISTS(SELECT 1 FROM trade_purchase_orders o WHERE o.id=l.order_id AND o.entity_id=l.entity_id AND o.status='received');
UPDATE trade_sales_lines l SET shipped_qty=l.quantity
 WHERE EXISTS(SELECT 1 FROM trade_sales_orders o WHERE o.id=l.order_id AND o.entity_id=l.entity_id AND o.status='shipped');
ALTER TABLE trade_purchase_orders DROP CONSTRAINT trade_purchase_orders_status_check;
ALTER TABLE trade_purchase_orders ADD CONSTRAINT trade_purchase_orders_status_check
  CHECK (status IN ('draft','approved','partially_received','received'));
ALTER TABLE trade_sales_orders DROP CONSTRAINT trade_sales_orders_status_check;
ALTER TABLE trade_sales_orders ADD CONSTRAINT trade_sales_orders_status_check
  CHECK (status IN ('draft','approved','partially_shipped','shipped'));
CREATE TABLE trade_fulfilments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 entity_id uuid NOT NULL REFERENCES legal_entities(id),
 order_id uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN ('purchase_receipt','sales_shipment')),
 request_key text NOT NULL CHECK(char_length(request_key) BETWEEN 8 AND 120),
 request_hash text NOT NULL,
 period_key text NOT NULL CHECK(period_key ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
 amount_xaf bigint NOT NULL CHECK(amount_xaf>0),
 cost_xaf bigint NOT NULL CHECK(cost_xaf>0),
 journal_id uuid,
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,entity_id), UNIQUE(entity_id,kind,order_id,request_key),
 FOREIGN KEY(created_by,entity_id) REFERENCES entity_memberships(user_id,entity_id),
 FOREIGN KEY(journal_id,entity_id) REFERENCES gl_journals(id,entity_id)
);
-- Guard polymorphic foreign key at DB layer (either PO or SO, always same entity).
CREATE FUNCTION verify_trade_fulfilment_order() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.kind='purchase_receipt' THEN
   IF NOT EXISTS(SELECT 1 FROM trade_purchase_orders WHERE id=NEW.order_id AND entity_id=NEW.entity_id)
   THEN RAISE EXCEPTION 'purchase_order_not_in_entity'; END IF;
 ELSE
   IF NOT EXISTS(SELECT 1 FROM trade_sales_orders WHERE id=NEW.order_id AND entity_id=NEW.entity_id)
   THEN RAISE EXCEPTION 'sales_order_not_in_entity'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER trade_fulfilments_order_scope BEFORE INSERT ON trade_fulfilments
 FOR EACH ROW EXECUTE FUNCTION verify_trade_fulfilment_order();

CREATE TABLE trade_fulfilment_lines (
 fulfilment_id uuid NOT NULL,
 entity_id uuid NOT NULL,
 item_id uuid NOT NULL,
 quantity bigint NOT NULL CHECK(quantity>0),
 commercial_amount_xaf bigint NOT NULL CHECK(commercial_amount_xaf>0),
 inventory_value_xaf bigint NOT NULL CHECK(inventory_value_xaf>0),
 PRIMARY KEY(fulfilment_id,item_id),
 FOREIGN KEY(fulfilment_id,entity_id) REFERENCES trade_fulfilments(id,entity_id),
 FOREIGN KEY(item_id,entity_id) REFERENCES inventory_items(id,entity_id)
);
CREATE INDEX trade_fulfilment_order_idx ON trade_fulfilments(entity_id,order_id,created_at DESC);
-- Full-order RC8 movements use order_id as source_id; RC9 movements use fulfilment event id.
-- The existing per-(entity,source_type,source_id,item) uniqueness remains valid for each event.
-- IMPORTANT: receipt/ship event facts are append-only, correction/credit flows need a dedicated RC10 model.
-- Finalized fulfilments are immutable; the creator fills amounts+journal while still unfinalized.
CREATE FUNCTION protect_finalized_fulfilment() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' OR OLD.journal_id IS NOT NULL THEN
   RAISE EXCEPTION 'finalized_fulfilment_immutable';
 END IF;
 IF NEW.journal_id IS NULL OR NEW.amount_xaf<=0 OR NEW.cost_xaf<=0 THEN
   RAISE EXCEPTION 'fulfilment_must_finalize_atomically';
 END IF;
 IF NEW.entity_id<>OLD.entity_id OR NEW.order_id<>OLD.order_id OR NEW.kind<>OLD.kind
    OR NEW.request_key<>OLD.request_key OR NEW.request_hash<>OLD.request_hash
    OR NEW.period_key<>OLD.period_key OR NEW.created_by<>OLD.created_by THEN
   RAISE EXCEPTION 'fulfilment_identity_cannot_change';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER trade_fulfilments_finalized_guard BEFORE UPDATE OR DELETE ON trade_fulfilments
 FOR EACH ROW EXECUTE FUNCTION protect_finalized_fulfilment();
CREATE TRIGGER trade_fulfilment_lines_immutable BEFORE UPDATE OR DELETE ON trade_fulfilment_lines
 FOR EACH ROW EXECUTE FUNCTION forbid_audit_event_mutation();

-- Prevent committing an incomplete placeholder event: journal must be linked by commit time.
CREATE FUNCTION ensure_fulfilment_closed_on_commit() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE finalized_journal uuid;
BEGIN
 SELECT journal_id INTO finalized_journal FROM trade_fulfilments WHERE id=NEW.id;
 IF finalized_journal IS NULL THEN RAISE EXCEPTION 'incomplete_fulfilment_transaction'; END IF;
 RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER trade_fulfilments_commit_complete AFTER INSERT ON trade_fulfilments
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION ensure_fulfilment_closed_on_commit();
