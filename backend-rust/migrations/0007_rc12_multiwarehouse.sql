-- RC12: intra-entity warehouse transfers + counted stock adjustments.
-- Do not execute against live books without backup, reconciliation and staging UAT.
-- Source movement append-only. Draft -> applied is the only document transition.
CREATE TABLE inventory_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES legal_entities(id),
  from_warehouse_id uuid NOT NULL,
  to_warehouse_id uuid NOT NULL,
  item_id uuid NOT NULL,
  quantity bigint NOT NULL CHECK(quantity BETWEEN 1 AND 1000000),
  reason text NOT NULL CHECK(char_length(reason) BETWEEN 8 AND 500),
  request_key text NOT NULL CHECK(char_length(request_key) BETWEEN 8 AND 120),
  request_hash text NOT NULL CHECK(char_length(request_hash)=64),
  status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','applied')),
  value_xaf bigint CHECK(value_xaf > 0),
  created_by uuid NOT NULL,
  approved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  applied_at timestamptz,
  UNIQUE(id,entity_id), UNIQUE(entity_id,request_key),
  FOREIGN KEY(from_warehouse_id,entity_id) REFERENCES inventory_warehouses(id,entity_id),
  FOREIGN KEY(to_warehouse_id,entity_id) REFERENCES inventory_warehouses(id,entity_id),
  FOREIGN KEY(item_id,entity_id) REFERENCES inventory_items(id,entity_id),
  FOREIGN KEY(created_by,entity_id) REFERENCES entity_memberships(user_id,entity_id),
  FOREIGN KEY(approved_by,entity_id) REFERENCES entity_memberships(user_id,entity_id),
  CHECK (from_warehouse_id<>to_warehouse_id),
  CHECK (approved_by IS NULL OR approved_by<>created_by),
  CHECK ((status='draft' AND approved_by IS NULL AND value_xaf IS NULL AND applied_at IS NULL)
      OR (status='applied' AND approved_by IS NOT NULL AND value_xaf IS NOT NULL AND applied_at IS NOT NULL))
);
CREATE INDEX inventory_transfers_scope ON inventory_transfers(entity_id,created_at DESC);

CREATE TABLE inventory_stock_counts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES legal_entities(id),
  warehouse_id uuid NOT NULL,
  item_id uuid NOT NULL,
  snapshot_quantity bigint NOT NULL CHECK(snapshot_quantity>=0),
  snapshot_value_xaf bigint NOT NULL CHECK(snapshot_value_xaf>=0),
  counted_quantity bigint NOT NULL CHECK(counted_quantity>=0 AND counted_quantity<=1000000000),
  -- Required ONLY to value a positive discovery when existing stock is zero.
  opening_unit_cost_xaf bigint CHECK(opening_unit_cost_xaf BETWEEN 1 AND 1000000000),
  period_key text NOT NULL CHECK(period_key ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  reason text NOT NULL CHECK(char_length(reason) BETWEEN 8 AND 500),
  request_key text NOT NULL CHECK(char_length(request_key) BETWEEN 8 AND 120),
  request_hash text NOT NULL CHECK(char_length(request_hash)=64),
  status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','applied')),
  adjustment_xaf bigint,
  journal_id uuid,
  created_by uuid NOT NULL,
  approved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  applied_at timestamptz,
  UNIQUE(id,entity_id), UNIQUE(entity_id,request_key),
  FOREIGN KEY(warehouse_id,entity_id) REFERENCES inventory_warehouses(id,entity_id),
  FOREIGN KEY(item_id,entity_id) REFERENCES inventory_items(id,entity_id),
  FOREIGN KEY(journal_id,entity_id) REFERENCES gl_journals(id,entity_id),
  FOREIGN KEY(created_by,entity_id) REFERENCES entity_memberships(user_id,entity_id),
  FOREIGN KEY(approved_by,entity_id) REFERENCES entity_memberships(user_id,entity_id),
  CHECK(snapshot_quantity<>counted_quantity),
  CHECK (approved_by IS NULL OR approved_by<>created_by),
  CHECK ((status='draft' AND approved_by IS NULL AND adjustment_xaf IS NULL AND journal_id IS NULL AND applied_at IS NULL)
      OR (status='applied' AND approved_by IS NOT NULL AND adjustment_xaf IS NOT NULL AND adjustment_xaf<>0 AND journal_id IS NOT NULL AND applied_at IS NOT NULL))
);
CREATE INDEX inventory_stock_counts_scope ON inventory_stock_counts(entity_id,created_at DESC);

-- Allow linked paired entries (same transfer/item, different warehouse) while retaining
-- one source-item-warehouse movement for each event. Source and polarity remain constrained.
ALTER TABLE inventory_movements DROP CONSTRAINT IF EXISTS inventory_movements_entity_id_source_type_source_id_item_id_key;
ALTER TABLE inventory_movements ADD CONSTRAINT inventory_movement_event_warehouse_unique
 UNIQUE(entity_id,source_type,source_id,item_id,warehouse_id);
ALTER TABLE inventory_movements DROP CONSTRAINT IF EXISTS inventory_movements_rc10_source;
ALTER TABLE inventory_movements DROP CONSTRAINT IF EXISTS inventory_movements_rc10_polarity;
ALTER TABLE inventory_movements ADD CONSTRAINT inventory_movements_rc12_source CHECK(source_type IN
 ('purchase_receipt','sales_shipment','customer_return','supplier_return',
  'warehouse_transfer_out','warehouse_transfer_in','stock_count_gain','stock_count_loss'));
ALTER TABLE inventory_movements ADD CONSTRAINT inventory_movements_rc12_polarity CHECK (
 (source_type IN ('purchase_receipt','customer_return','warehouse_transfer_in','stock_count_gain')
   AND quantity_delta>0 AND value_delta_xaf>0)
 OR (source_type IN ('sales_shipment','supplier_return','warehouse_transfer_out','stock_count_loss')
   AND quantity_delta<0 AND value_delta_xaf<0));

ALTER TABLE gl_journals DROP CONSTRAINT IF EXISTS gl_trade_type_rc10;
ALTER TABLE gl_journals ADD CONSTRAINT gl_trade_type_rc12 CHECK(source_trade_type IS NULL OR source_trade_type IN
 ('purchase_receipt','sales_shipment','customer_return','supplier_return','stock_count_adjustment'));
ALTER TABLE trade_posting_accounts DROP CONSTRAINT IF EXISTS trade_posting_roles_rc10;
ALTER TABLE trade_posting_accounts ADD CONSTRAINT trade_posting_roles_rc12 CHECK(posting_role IN
 ('inventory','accounts_payable','accounts_receivable','sales_revenue','cost_of_goods_sold',
  'purchase_price_variance','inventory_adjustment_gain','inventory_adjustment_loss'));

-- Defend committed documents from direct SQL rewrite. All draft operations can be
-- cancelled by a future controlled cancellation flow, not by hidden deletion.
CREATE FUNCTION rc12_protect_transfer() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' OR OLD.status='applied' THEN RAISE EXCEPTION 'transfer_immutable'; END IF;
 IF NEW.status<>'applied' OR OLD.entity_id<>NEW.entity_id OR OLD.from_warehouse_id<>NEW.from_warehouse_id OR
  OLD.to_warehouse_id<>NEW.to_warehouse_id OR OLD.item_id<>NEW.item_id OR OLD.quantity<>NEW.quantity OR
  OLD.created_by<>NEW.created_by OR OLD.request_key<>NEW.request_key OR OLD.request_hash<>NEW.request_hash OR
  OLD.reason<>NEW.reason THEN RAISE EXCEPTION 'transfer_identity_immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER rc12_transfer_guard BEFORE UPDATE OR DELETE ON inventory_transfers
 FOR EACH ROW EXECUTE FUNCTION rc12_protect_transfer();
CREATE FUNCTION rc12_protect_count() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' OR OLD.status='applied' THEN RAISE EXCEPTION 'count_immutable'; END IF;
 IF NEW.status<>'applied' OR NEW.entity_id<>OLD.entity_id OR NEW.warehouse_id<>OLD.warehouse_id OR
  NEW.item_id<>OLD.item_id OR NEW.snapshot_quantity<>OLD.snapshot_quantity OR NEW.snapshot_value_xaf<>OLD.snapshot_value_xaf OR
  NEW.counted_quantity<>OLD.counted_quantity OR NEW.created_by<>OLD.created_by OR
  NEW.request_key<>OLD.request_key OR NEW.request_hash<>OLD.request_hash OR
  NEW.period_key<>OLD.period_key OR NEW.reason<>OLD.reason OR
  NEW.opening_unit_cost_xaf IS DISTINCT FROM OLD.opening_unit_cost_xaf
 THEN RAISE EXCEPTION 'count_identity_immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER rc12_stock_count_guard BEFORE UPDATE OR DELETE ON inventory_stock_counts
 FOR EACH ROW EXECUTE FUNCTION rc12_protect_count();
