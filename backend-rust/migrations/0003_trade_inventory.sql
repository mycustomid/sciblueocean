-- RC8 limited trade vertical: full-order purchase receipt, full-order sales shipment,
-- entity-scoped weighted average stock and DRAFT journal evidence. Not certified OHADA.
-- Apply to clean/staging PG16 after migrations 0001-0002; backup before upgrade.

CREATE TABLE inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES legal_entities(id),
  sku text NOT NULL CHECK (char_length(sku) BETWEEN 2 AND 48),
  label text NOT NULL CHECK (char_length(label) BETWEEN 2 AND 240),
  unit text NOT NULL DEFAULT 'each' CHECK (unit IN ('each','kg','litre','metre')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id,entity_id), UNIQUE(entity_id,sku)
);
CREATE TABLE inventory_warehouses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES legal_entities(id),
  code text NOT NULL CHECK (char_length(code) BETWEEN 2 AND 48),
  label text NOT NULL CHECK (char_length(label) BETWEEN 2 AND 240),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id,entity_id),UNIQUE(entity_id,code)
);
CREATE TABLE inventory_balances (
  entity_id uuid NOT NULL REFERENCES legal_entities(id),
  warehouse_id uuid NOT NULL,
  item_id uuid NOT NULL,
  quantity bigint NOT NULL DEFAULT 0 CHECK (quantity>=0),
  value_xaf bigint NOT NULL DEFAULT 0 CHECK (value_xaf>=0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(entity_id,warehouse_id,item_id),
  FOREIGN KEY(warehouse_id,entity_id) REFERENCES inventory_warehouses(id,entity_id),
  FOREIGN KEY(item_id,entity_id) REFERENCES inventory_items(id,entity_id),
  CHECK ((quantity=0 AND value_xaf=0) OR quantity>0)
);

CREATE TABLE trade_purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES legal_entities(id),
  supplier text NOT NULL CHECK (char_length(supplier) BETWEEN 2 AND 240),
  warehouse_id uuid NOT NULL,
  total_xaf bigint NOT NULL CHECK(total_xaf>0 AND total_xaf<=9000000000000000),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','received')),
  created_by uuid NOT NULL,
  approved_by uuid,
  received_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  received_at timestamptz,
  UNIQUE(id,entity_id),
  FOREIGN KEY(warehouse_id,entity_id) REFERENCES inventory_warehouses(id,entity_id),
  FOREIGN KEY(created_by,entity_id) REFERENCES entity_memberships(user_id,entity_id),
  FOREIGN KEY(approved_by,entity_id) REFERENCES entity_memberships(user_id,entity_id),
  FOREIGN KEY(received_by,entity_id) REFERENCES entity_memberships(user_id,entity_id),
  CHECK (approved_by IS NULL OR approved_by<>created_by),
  CHECK (received_by IS NULL OR received_by<>approved_by)
);
CREATE TABLE trade_purchase_lines (
  entity_id uuid NOT NULL,
  order_id uuid NOT NULL,
  line_no integer NOT NULL CHECK(line_no BETWEEN 1 AND 50),
  item_id uuid NOT NULL,
  quantity bigint NOT NULL CHECK(quantity BETWEEN 1 AND 1000000),
  unit_cost_xaf bigint NOT NULL CHECK(unit_cost_xaf BETWEEN 1 AND 1000000000),
  PRIMARY KEY(order_id,line_no), UNIQUE(order_id,item_id),
  FOREIGN KEY(order_id,entity_id) REFERENCES trade_purchase_orders(id,entity_id),
  FOREIGN KEY(item_id,entity_id) REFERENCES inventory_items(id,entity_id)
);
CREATE TABLE trade_sales_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES legal_entities(id),
  customer text NOT NULL CHECK (char_length(customer) BETWEEN 2 AND 240),
  warehouse_id uuid NOT NULL,
  total_xaf bigint NOT NULL CHECK(total_xaf>0 AND total_xaf<=9000000000000000),
  status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','approved','shipped')),
  created_by uuid NOT NULL,
  approved_by uuid,
  shipped_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  shipped_at timestamptz,
  UNIQUE(id,entity_id),
  FOREIGN KEY(warehouse_id,entity_id) REFERENCES inventory_warehouses(id,entity_id),
  FOREIGN KEY(created_by,entity_id) REFERENCES entity_memberships(user_id,entity_id),
  FOREIGN KEY(approved_by,entity_id) REFERENCES entity_memberships(user_id,entity_id),
  FOREIGN KEY(shipped_by,entity_id) REFERENCES entity_memberships(user_id,entity_id),
  CHECK (approved_by IS NULL OR approved_by<>created_by),
  CHECK (shipped_by IS NULL OR shipped_by<>approved_by)
);
CREATE TABLE trade_sales_lines (
  entity_id uuid NOT NULL,
  order_id uuid NOT NULL,
  line_no integer NOT NULL CHECK(line_no BETWEEN 1 AND 50),
  item_id uuid NOT NULL,
  quantity bigint NOT NULL CHECK(quantity BETWEEN 1 AND 1000000),
  unit_price_xaf bigint NOT NULL CHECK(unit_price_xaf BETWEEN 1 AND 1000000000),
  PRIMARY KEY(order_id,line_no), UNIQUE(order_id,item_id),
  FOREIGN KEY(order_id,entity_id) REFERENCES trade_sales_orders(id,entity_id),
  FOREIGN KEY(item_id,entity_id) REFERENCES inventory_items(id,entity_id)
);
CREATE TABLE inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES legal_entities(id),
  warehouse_id uuid NOT NULL,
  item_id uuid NOT NULL,
  source_type text NOT NULL CHECK(source_type IN ('purchase_receipt','sales_shipment')),
  source_id uuid NOT NULL,
  quantity_delta bigint NOT NULL CHECK(quantity_delta<>0),
  value_delta_xaf bigint NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(entity_id,source_type,source_id,item_id),
  FOREIGN KEY(warehouse_id,entity_id) REFERENCES inventory_warehouses(id,entity_id),
  FOREIGN KEY(item_id,entity_id) REFERENCES inventory_items(id,entity_id),
  FOREIGN KEY(created_by,entity_id) REFERENCES entity_memberships(user_id,entity_id),
  CHECK((source_type='purchase_receipt' AND quantity_delta>0 AND value_delta_xaf>0)
     OR (source_type='sales_shipment' AND quantity_delta<0 AND value_delta_xaf<0))
);
CREATE INDEX inventory_movements_scope_idx ON inventory_movements(entity_id,created_at DESC);

-- Explicit, entity-specific ledger mapping; no implicit regulatory SYSCOHADA account assumptions.
CREATE TABLE trade_posting_accounts (
  entity_id uuid NOT NULL REFERENCES legal_entities(id),
  posting_role text NOT NULL CHECK(posting_role IN ('inventory','accounts_payable','accounts_receivable','sales_revenue','cost_of_goods_sold')),
  account_id uuid NOT NULL,
  PRIMARY KEY(entity_id,posting_role),
  FOREIGN KEY(account_id,entity_id) REFERENCES gl_accounts(id,entity_id)
);
-- One idempotency response per created purchase/sale order (separate from domain_records FK).
CREATE TABLE trade_idempotency (
  entity_id uuid NOT NULL REFERENCES legal_entities(id),
  operation text NOT NULL CHECK(operation IN ('create_purchase','create_sale')),
  request_key text NOT NULL CHECK(char_length(request_key) BETWEEN 8 AND 120),
  request_hash text NOT NULL,
  order_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(entity_id,operation,request_key)
);
-- The extra source metadata is informational; created via atomic Rust transaction.
ALTER TABLE gl_journals ADD COLUMN source_trade_type text CHECK(source_trade_type IN ('purchase_receipt','sales_shipment'));
ALTER TABLE gl_journals ADD COLUMN source_trade_id uuid;
ALTER TABLE gl_journals ADD CONSTRAINT gl_trade_source_pair CHECK ((source_trade_type IS NULL) = (source_trade_id IS NULL));
CREATE UNIQUE INDEX gl_source_trade_once ON gl_journals(entity_id,source_trade_type,source_trade_id) WHERE source_trade_type IS NOT NULL;

-- Business facts and journal drafts remain linked, but journal posting still needs a second human.
-- Returns/partial shipments, multi-currency, per-lot traceability and tax computation are RC9+.

-- A stock movement is an append-only fact. Corrections need reversal documents (RC9+).
CREATE TRIGGER inventory_movements_append_only BEFORE UPDATE OR DELETE ON inventory_movements
  FOR EACH ROW EXECUTE FUNCTION forbid_audit_event_mutation();
