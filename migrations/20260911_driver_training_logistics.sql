BEGIN;

CREATE TABLE IF NOT EXISTS training_resources (
  id varchar(36) PRIMARY KEY,
  resource_code varchar(40) NOT NULL,
  name varchar(220) NOT NULL,
  resource_type varchar(30) NOT NULL,
  status varchar(24) NOT NULL DEFAULT 'available',
  location_id varchar(36) REFERENCES locations(id) ON DELETE SET NULL,
  identifier varchar(140),
  is_exclusive boolean NOT NULL DEFAULT true,
  available_quantity integer NOT NULL DEFAULT 1,
  capacity integer NOT NULL DEFAULT 1,
  service_due_date date,
  inspection_due_date date,
  notes text,
  created_by varchar(36) REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT training_resource_type_chk CHECK (resource_type IN ('vehicle', 'simulator', 'classroom', 'training_equipment', 'safety_equipment', 'materials', 'audiovisual', 'other')),
  CONSTRAINT training_resource_status_chk CHECK (status IN ('available', 'maintenance', 'out_of_service', 'retired')),
  CONSTRAINT training_resource_code_chk CHECK (resource_code ~ '^[A-Z0-9][A-Z0-9._-]{2,39}$'),
  CONSTRAINT training_resource_quantity_chk CHECK (available_quantity BETWEEN 1 AND 100000),
  CONSTRAINT training_resource_capacity_chk CHECK (capacity BETWEEN 1 AND 10000),
  CONSTRAINT training_resource_exclusive_quantity_chk CHECK (NOT is_exclusive OR available_quantity = 1)
);

CREATE TABLE IF NOT EXISTS training_resource_allocations (
  id varchar(36) PRIMARY KEY,
  resource_id varchar(36) NOT NULL REFERENCES training_resources(id) ON DELETE RESTRICT,
  session_id varchar(36) NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 1,
  status varchar(24) NOT NULL DEFAULT 'reserved',
  notes text,
  allocated_by varchar(36) REFERENCES users(id) ON DELETE SET NULL,
  allocated_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT training_resource_allocation_quantity_chk CHECK (quantity BETWEEN 1 AND 100000),
  CONSTRAINT training_resource_allocation_status_chk CHECK (status IN ('reserved', 'confirmed', 'released', 'cancelled'))
);

CREATE UNIQUE INDEX IF NOT EXISTS training_resource_code_uidx ON training_resources(resource_code);
CREATE INDEX IF NOT EXISTS training_resource_type_status_idx ON training_resources(resource_type, status);
CREATE INDEX IF NOT EXISTS training_resource_location_idx ON training_resources(location_id);
CREATE INDEX IF NOT EXISTS training_resource_service_due_idx ON training_resources(service_due_date);
CREATE INDEX IF NOT EXISTS training_resource_inspection_due_idx ON training_resources(inspection_due_date);
CREATE UNIQUE INDEX IF NOT EXISTS training_resource_allocation_resource_session_uidx ON training_resource_allocations(resource_id, session_id);
CREATE INDEX IF NOT EXISTS training_resource_allocation_resource_status_idx ON training_resource_allocations(resource_id, status);
CREATE INDEX IF NOT EXISTS training_resource_allocation_session_status_idx ON training_resource_allocations(session_id, status);

COMMIT;
