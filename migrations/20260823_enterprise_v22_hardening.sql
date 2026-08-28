-- Vehicle Inspection Management System Enterprise v2.2 hardening
-- Adds explicit transporter-to-user scoping for external portal accounts.

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "transporter_id" varchar(36);

DO $$
BEGIN
  ALTER TABLE "users"
    ADD CONSTRAINT "users_transporter_id_transporters_id_fk"
    FOREIGN KEY ("transporter_id") REFERENCES "transporters"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "user_transporter_idx"
  ON "users" ("transporter_id");
