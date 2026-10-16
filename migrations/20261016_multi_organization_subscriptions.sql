ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'organization_owner';

-- VIMS multi-organization subscription control plane.
-- Existing production records are assigned to the legacy RSL organization.
-- New subscriber organizations remain operationally locked until tenant data
-- isolation is explicitly provisioned and verified.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'organization_status') THEN
    CREATE TYPE organization_status AS ENUM ('pending','provisioning','active','suspended','cancelled');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_status') THEN
    CREATE TYPE subscription_status AS ENUM ('trialing','active','past_due','grace','suspended','cancelled','expired');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'billing_cycle') THEN
    CREATE TYPE billing_cycle AS ENUM ('monthly','annual','custom');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'onboarding_request_status') THEN
    CREATE TYPE onboarding_request_status AS ENUM ('pending','reviewing','approved','rejected','converted');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS organizations (
  id varchar(36) PRIMARY KEY,
  name varchar(255) NOT NULL,
  slug varchar(100) NOT NULL UNIQUE,
  legal_name varchar(255),
  registration_number varchar(100),
  tax_id varchar(100),
  industry varchar(120),
  country varchar(100) NOT NULL DEFAULT 'Ghana',
  region varchar(100),
  city varchar(100),
  address text,
  phone varchar(50),
  email varchar(200),
  website varchar(200),
  logo_data_url text,
  logo_url text,
  theme_color varchar(20) NOT NULL DEFAULT '#039703',
  accent_color varchar(20) NOT NULL DEFAULT '#026b02',
  enabled_modules jsonb NOT NULL DEFAULT '["vehicle_inspection","driver_training","reports"]'::jsonb,
  status organization_status NOT NULL DEFAULT 'pending',
  onboarding_stage varchar(50) NOT NULL DEFAULT 'company_profile',
  operational_access_enabled boolean NOT NULL DEFAULT false,
  data_isolation_verified_at timestamp,
  created_by varchar(36),
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS organization_slug_idx ON organizations(slug);
CREATE INDEX IF NOT EXISTS organization_status_idx ON organizations(status);
CREATE INDEX IF NOT EXISTS organization_created_idx ON organizations(created_at);

CREATE TABLE IF NOT EXISTS subscription_plans (
  id varchar(36) PRIMARY KEY,
  code varchar(50) NOT NULL UNIQUE,
  name varchar(120) NOT NULL,
  description text,
  billing_cycle billing_cycle NOT NULL DEFAULT 'monthly',
  price numeric(12,2) NOT NULL DEFAULT 0,
  currency varchar(3) NOT NULL DEFAULT 'GHS',
  trial_days integer NOT NULL DEFAULT 14,
  max_users integer NOT NULL DEFAULT 10,
  max_stations integer NOT NULL DEFAULT 2,
  max_vehicles integer NOT NULL DEFAULT 500,
  max_inspections_per_month integer NOT NULL DEFAULT 1000,
  modules jsonb NOT NULL DEFAULT '["vehicle_inspection","reports"]'::jsonb,
  features jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS subscription_plan_code_idx ON subscription_plans(code);
CREATE INDEX IF NOT EXISTS subscription_plan_active_order_idx ON subscription_plans(is_active, sort_order);

CREATE TABLE IF NOT EXISTS organization_subscriptions (
  id varchar(36) PRIMARY KEY,
  organization_id varchar(36) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  plan_id varchar(36) NOT NULL REFERENCES subscription_plans(id) ON DELETE RESTRICT,
  status subscription_status NOT NULL DEFAULT 'trialing',
  provider varchar(40) NOT NULL DEFAULT 'manual',
  provider_customer_id varchar(150),
  provider_subscription_id varchar(150),
  amount numeric(12,2) NOT NULL DEFAULT 0,
  currency varchar(3) NOT NULL DEFAULT 'GHS',
  current_period_start timestamp NOT NULL DEFAULT now(),
  current_period_end timestamp,
  trial_ends_at timestamp,
  grace_ends_at timestamp,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  seats integer NOT NULL DEFAULT 1,
  notes text,
  created_by varchar(36),
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS organization_subscription_org_idx ON organization_subscriptions(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS organization_subscription_status_idx ON organization_subscriptions(status);
CREATE INDEX IF NOT EXISTS organization_subscription_provider_idx ON organization_subscriptions(provider, provider_subscription_id);

CREATE TABLE IF NOT EXISTS organization_invitations (
  id varchar(36) PRIMARY KEY,
  organization_id varchar(36) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email varchar(200) NOT NULL,
  name varchar(200),
  role user_role NOT NULL DEFAULT 'viewer',
  token_hash varchar(64) NOT NULL UNIQUE,
  expires_at timestamp NOT NULL,
  accepted_at timestamp,
  revoked_at timestamp,
  created_by varchar(36),
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS organization_invitation_org_idx ON organization_invitations(organization_id);
CREATE INDEX IF NOT EXISTS organization_invitation_email_idx ON organization_invitations(email);
CREATE INDEX IF NOT EXISTS organization_invitation_expiry_idx ON organization_invitations(expires_at);

CREATE TABLE IF NOT EXISTS organization_onboarding_requests (
  id varchar(36) PRIMARY KEY,
  company_name varchar(255) NOT NULL,
  contact_name varchar(200) NOT NULL,
  contact_email varchar(200) NOT NULL,
  contact_phone varchar(50),
  country varchar(100) NOT NULL DEFAULT 'Ghana',
  industry varchar(120),
  estimated_users integer,
  estimated_vehicles integer,
  desired_plan_code varchar(50),
  requested_modules jsonb NOT NULL DEFAULT '["vehicle_inspection"]'::jsonb,
  notes text,
  status onboarding_request_status NOT NULL DEFAULT 'pending',
  review_notes text,
  reviewed_by varchar(36),
  reviewed_at timestamp,
  source_ip_hash varchar(64),
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS organization_onboarding_status_idx ON organization_onboarding_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS organization_onboarding_email_idx ON organization_onboarding_requests(contact_email);

ALTER TABLE users ADD COLUMN IF NOT EXISTS organization_id varchar(36);
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS organization_id varchar(36);

INSERT INTO organizations (
  id, name, slug, legal_name, country, theme_color, accent_color,
  enabled_modules, status, onboarding_stage, operational_access_enabled,
  data_isolation_verified_at, created_at, updated_at
)
VALUES (
  '00000000-0000-4000-8000-000000000101',
  'Road Safety Limited',
  'rsl',
  'Road Safety Limited',
  'Ghana',
  '#039703',
  '#026b02',
  '["vehicle_inspection","driver_training","reports","api"]'::jsonb,
  'active',
  'complete',
  true,
  now(),
  now(),
  now()
)
ON CONFLICT (id) DO UPDATE SET
  operational_access_enabled = true,
  data_isolation_verified_at = COALESCE(organizations.data_isolation_verified_at, now()),
  updated_at = now();

INSERT INTO subscription_plans (
  id, code, name, description, billing_cycle, price, currency, trial_days,
  max_users, max_stations, max_vehicles, max_inspections_per_month,
  modules, features, is_active, sort_order
)
VALUES
  (
    '00000000-0000-4000-8000-000000000201',
    'starter',
    'Starter',
    'Core vehicle inspection workspace for smaller organizations.',
    'custom',
    0,
    'GHS',
    14,
    10,
    2,
    500,
    1000,
    '["vehicle_inspection","reports"]'::jsonb,
    '{"custom_branding":true,"api_access":false,"driver_training":false}'::jsonb,
    true,
    10
  ),
  (
    '00000000-0000-4000-8000-000000000202',
    'professional',
    'Professional',
    'Expanded operations with Driver Training & Assessment and larger capacity.',
    'custom',
    0,
    'GHS',
    14,
    50,
    10,
    5000,
    10000,
    '["vehicle_inspection","driver_training","reports"]'::jsonb,
    '{"custom_branding":true,"api_access":true,"driver_training":true}'::jsonb,
    true,
    20
  ),
  (
    '00000000-0000-4000-8000-000000000203',
    'enterprise',
    'Enterprise',
    'High-capacity multi-site operations with all VIMS modules.',
    'custom',
    0,
    'GHS',
    30,
    500,
    100,
    1000000,
    1000000,
    '["vehicle_inspection","driver_training","reports","api"]'::jsonb,
    '{"custom_branding":true,"api_access":true,"driver_training":true,"priority_support":true}'::jsonb,
    true,
    30
  )
ON CONFLICT (code) DO NOTHING;

INSERT INTO organization_subscriptions (
  id, organization_id, plan_id, status, provider, amount, currency,
  current_period_start, seats, notes
)
VALUES (
  '00000000-0000-4000-8000-000000000301',
  '00000000-0000-4000-8000-000000000101',
  '00000000-0000-4000-8000-000000000203',
  'active',
  'manual',
  0,
  'GHS',
  now(),
  500,
  'Legacy RSL production workspace'
)
ON CONFLICT (id) DO NOTHING;

UPDATE users
   SET organization_id = '00000000-0000-4000-8000-000000000101'
 WHERE organization_id IS NULL;

UPDATE system_settings
   SET organization_id = '00000000-0000-4000-8000-000000000101'
 WHERE organization_id IS NULL;

ALTER TABLE users ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE system_settings ALTER COLUMN organization_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_organization_id_fkey'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_organization_id_fkey
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'system_settings_organization_id_fkey'
  ) THEN
    ALTER TABLE system_settings
      ADD CONSTRAINT system_settings_organization_id_fkey
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS user_organization_idx ON users(organization_id);
CREATE INDEX IF NOT EXISTS user_organization_role_idx ON users(organization_id, role);
CREATE UNIQUE INDEX IF NOT EXISTS system_settings_organization_uidx ON system_settings(organization_id);


-- Organization Owners manage subscription/account administration only and are
-- intentionally excluded from both operational domains.
ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_single_operational_domain_chk;

ALTER TABLE users
  ADD CONSTRAINT users_single_operational_domain_chk
  CHECK (
    role = 'super_admin'
    OR (
      role = 'organization_owner'
      AND NOT COALESCE((permissions->>'*')::boolean, false)
      AND COALESCE((permissions->>'vehicle_inspection')::boolean, false) = false
      AND COALESCE((permissions->>'training')::boolean, false) = false
    )
    OR (
      role <> 'organization_owner'
      AND NOT COALESCE((permissions->>'*')::boolean, false)
      AND COALESCE((permissions->>'vehicle_inspection')::boolean, true)
          <> COALESCE((permissions->>'training')::boolean, false)
    )
  );
