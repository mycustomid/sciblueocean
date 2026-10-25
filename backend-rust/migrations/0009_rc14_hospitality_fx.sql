-- RC14: bounded PMS reservation, property lease register, FX indicative quotation.
-- Reservations use a DB exclusion constraint to prevent overlapping active bookings.
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE TABLE rc14_properties (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), entity_id uuid NOT NULL REFERENCES legal_entities(id),
 code text NOT NULL CHECK(length(code) BETWEEN 2 AND 40), name text NOT NULL CHECK(length(name) BETWEEN 2 AND 180),
 city text NOT NULL CHECK(length(city) BETWEEN 2 AND 120),
 UNIQUE(id,entity_id),UNIQUE(entity_id,code)
);
CREATE TABLE rc14_rooms (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),entity_id uuid NOT NULL REFERENCES legal_entities(id),
 property_id uuid NOT NULL,code text NOT NULL CHECK(length(code) BETWEEN 1 AND 40),
 nightly_rate_xaf bigint NOT NULL CHECK(nightly_rate_xaf BETWEEN 1 AND 1000000000),
 condition text NOT NULL DEFAULT 'ready' CHECK(condition IN ('ready','out_of_service')),
 UNIQUE(id,entity_id),UNIQUE(property_id,code),
 FOREIGN KEY(property_id,entity_id) REFERENCES rc14_properties(id,entity_id)
);
CREATE TABLE rc14_reservations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),entity_id uuid NOT NULL REFERENCES legal_entities(id),
 room_id uuid NOT NULL, guest_name text NOT NULL CHECK(length(guest_name) BETWEEN 2 AND 240),
 arrival date NOT NULL,departure date NOT NULL CHECK(departure>arrival),
 total_xaf bigint NOT NULL CHECK(total_xaf BETWEEN 1 AND 9000000000000000),
 status text NOT NULL DEFAULT 'reserved' CHECK(status IN ('reserved','checked_in','checked_out','cancelled')),
 created_by uuid NOT NULL, updated_by uuid, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,entity_id),FOREIGN KEY(room_id,entity_id) REFERENCES rc14_rooms(id,entity_id),
 FOREIGN KEY(created_by,entity_id) REFERENCES entity_memberships(user_id,entity_id),
 FOREIGN KEY(updated_by,entity_id) REFERENCES entity_memberships(user_id,entity_id),
 EXCLUDE USING gist(entity_id WITH =,room_id WITH =,daterange(arrival,departure,'[)') WITH &&)
 WHERE (status IN ('reserved','checked_in'))
);
CREATE INDEX rc14_reservations_recent ON rc14_reservations(entity_id,arrival DESC);
CREATE TABLE rc14_leases (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), entity_id uuid NOT NULL REFERENCES legal_entities(id),
 unit_reference text NOT NULL CHECK(length(unit_reference) BETWEEN 3 AND 80),
 tenant text NOT NULL CHECK(length(tenant) BETWEEN 2 AND 240),
 starts_on date NOT NULL,ends_on date NOT NULL CHECK(ends_on>starts_on),
 rent_xaf bigint NOT NULL CHECK(rent_xaf BETWEEN 1 AND 9000000000000000),
 deposit_xaf bigint NOT NULL DEFAULT 0 CHECK(deposit_xaf>=0),
 created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,entity_id),FOREIGN KEY(created_by,entity_id) REFERENCES entity_memberships(user_id,entity_id),
 EXCLUDE USING gist(entity_id WITH =,unit_reference WITH =,daterange(starts_on,ends_on,'[)') WITH &&)
);
CREATE TABLE rc14_fx_quotes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),entity_id uuid NOT NULL REFERENCES legal_entities(id),
 currency text NOT NULL CHECK(currency IN ('USD','EUR','GBP','CNY')),
 foreign_units bigint NOT NULL CHECK(foreign_units BETWEEN 1 AND 1000000000),
 rate_xaf_per_1000 bigint NOT NULL CHECK(rate_xaf_per_1000 BETWEEN 1 AND 1000000000),
 indicated_xaf bigint NOT NULL CHECK(indicated_xaf BETWEEN 1 AND 9000000000000000),
 created_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL DEFAULT now()+interval '15 minutes',
 status text NOT NULL DEFAULT 'indicative_only' CHECK(status='indicative_only'),
 FOREIGN KEY(created_by,entity_id) REFERENCES entity_memberships(user_id,entity_id),
 UNIQUE(id,entity_id)
);
CREATE TRIGGER rc14_fx_no_mutation BEFORE UPDATE OR DELETE ON rc14_fx_quotes FOR EACH ROW EXECUTE FUNCTION forbid_audit_event_mutation();
CREATE TRIGGER rc14_leases_no_mutation BEFORE UPDATE OR DELETE ON rc14_leases FOR EACH ROW EXECUTE FUNCTION forbid_audit_event_mutation();
