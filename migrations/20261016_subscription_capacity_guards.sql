-- Enforce subscription capacity at the database boundary.
-- Application preflight checks provide friendly messages; these triggers
-- serialize concurrent writes and prevent forged/direct writes from exceeding
-- organization plan limits.

CREATE OR REPLACE FUNCTION vims_enforce_subscription_capacity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  resource text := TG_ARGV[0];
  limit_value integer;
  current_value integer;
  latest_status subscription_status;
  current_period_end timestamp;
  trial_ends_at timestamp;
  grace_ends_at timestamp;
  should_check boolean := true;
BEGIN
  IF NEW.organization_id IS NULL THEN
    RAISE EXCEPTION 'SUBSCRIPTION_LIMIT: organization context is required';
  END IF;

  IF resource = 'users' THEN
    IF NEW.is_active IS DISTINCT FROM true THEN
      RETURN NEW;
    END IF;
    IF TG_OP = 'UPDATE'
       AND OLD.organization_id = NEW.organization_id
       AND OLD.is_active = true THEN
      RETURN NEW;
    END IF;
  ELSIF resource = 'stations' THEN
    IF NEW.status = 'inactive' THEN
      RETURN NEW;
    END IF;
    IF TG_OP = 'UPDATE'
       AND OLD.organization_id = NEW.organization_id
       AND OLD.status <> 'inactive' THEN
      RETURN NEW;
    END IF;
  ELSIF resource = 'vehicles' THEN
    IF NEW.status = 'decommissioned' THEN
      RETURN NEW;
    END IF;
    IF TG_OP = 'UPDATE'
       AND OLD.organization_id = NEW.organization_id
       AND OLD.status <> 'decommissioned' THEN
      RETURN NEW;
    END IF;
  ELSIF resource = 'monthly_inspections' THEN
    IF TG_OP <> 'INSERT' THEN
      RETURN NEW;
    END IF;
  ELSE
    RAISE EXCEPTION 'Unknown subscription capacity resource: %', resource;
  END IF;

  -- Serialize capacity-sensitive writes for one organization/resource pair.
  PERFORM pg_advisory_xact_lock(
    hashtextextended(NEW.organization_id::text || ':' || resource, 0)
  );

  SELECT
    os.status,
    os.current_period_end,
    os.trial_ends_at,
    os.grace_ends_at,
    CASE resource
      WHEN 'users' THEN sp.max_users
      WHEN 'stations' THEN sp.max_stations
      WHEN 'vehicles' THEN sp.max_vehicles
      WHEN 'monthly_inspections' THEN sp.max_inspections_per_month
    END
  INTO
    latest_status,
    current_period_end,
    trial_ends_at,
    grace_ends_at,
    limit_value
  FROM organization_subscriptions os
  JOIN subscription_plans sp ON sp.id = os.plan_id
  WHERE os.organization_id = NEW.organization_id
  ORDER BY os.created_at DESC
  LIMIT 1;

  IF limit_value IS NULL THEN
    RAISE EXCEPTION 'SUBSCRIPTION_LIMIT: no subscription plan is assigned to this organization';
  END IF;

  IF latest_status NOT IN ('trialing', 'active', 'grace') THEN
    RAISE EXCEPTION 'SUBSCRIPTION_LIMIT: the organization subscription is not currently usable';
  END IF;

  IF latest_status = 'trialing' AND trial_ends_at IS NOT NULL AND trial_ends_at < now() THEN
    RAISE EXCEPTION 'SUBSCRIPTION_LIMIT: the organization trial has expired';
  END IF;
  IF latest_status = 'grace' AND grace_ends_at IS NOT NULL AND grace_ends_at < now() THEN
    RAISE EXCEPTION 'SUBSCRIPTION_LIMIT: the organization grace period has expired';
  END IF;
  IF latest_status = 'active' AND current_period_end IS NOT NULL AND current_period_end < now() THEN
    RAISE EXCEPTION 'SUBSCRIPTION_LIMIT: the organization subscription period has ended';
  END IF;

  IF resource = 'users' THEN
    SELECT count(*)::int
      INTO current_value
      FROM users
     WHERE organization_id = NEW.organization_id
       AND is_active = true;
  ELSIF resource = 'stations' THEN
    SELECT count(*)::int
      INTO current_value
      FROM locations
     WHERE organization_id = NEW.organization_id
       AND status <> 'inactive';
  ELSIF resource = 'vehicles' THEN
    SELECT count(*)::int
      INTO current_value
      FROM vehicles
     WHERE organization_id = NEW.organization_id
       AND status <> 'decommissioned';
  ELSE
    SELECT count(*)::int
      INTO current_value
      FROM inspections
     WHERE organization_id = NEW.organization_id
       AND inspection_date >= date_trunc('month', NEW.inspection_date)
       AND inspection_date < date_trunc('month', NEW.inspection_date) + interval '1 month';
  END IF;

  IF current_value >= limit_value THEN
    RAISE EXCEPTION 'SUBSCRIPTION_LIMIT: % capacity reached (% of % used)',
      replace(resource, '_', ' '),
      current_value,
      limit_value;
  END IF;

  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS users_subscription_capacity_guard ON users;
CREATE TRIGGER users_subscription_capacity_guard
BEFORE INSERT OR UPDATE OF organization_id, is_active
ON users
FOR EACH ROW
EXECUTE FUNCTION vims_enforce_subscription_capacity('users');

DROP TRIGGER IF EXISTS locations_subscription_capacity_guard ON locations;
CREATE TRIGGER locations_subscription_capacity_guard
BEFORE INSERT OR UPDATE OF organization_id, status
ON locations
FOR EACH ROW
EXECUTE FUNCTION vims_enforce_subscription_capacity('stations');

DROP TRIGGER IF EXISTS vehicles_subscription_capacity_guard ON vehicles;
CREATE TRIGGER vehicles_subscription_capacity_guard
BEFORE INSERT OR UPDATE OF organization_id, status
ON vehicles
FOR EACH ROW
EXECUTE FUNCTION vims_enforce_subscription_capacity('vehicles');

DROP TRIGGER IF EXISTS inspections_subscription_capacity_guard ON inspections;
CREATE TRIGGER inspections_subscription_capacity_guard
BEFORE INSERT OR UPDATE OF organization_id, inspection_date
ON inspections
FOR EACH ROW
EXECUTE FUNCTION vims_enforce_subscription_capacity('monthly_inspections');
