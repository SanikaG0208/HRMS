
BEGIN;

-- 1. Clean existing monitoring settings.
-- Keep only active employees in the monitoring list.
-- Does not modify the employees table.

UPDATE break_notification_settings AS settings
SET monitored_employee_ids = COALESCE(
    (
        SELECT jsonb_agg(monitored.employee_id)
        FROM jsonb_array_elements_text(
            COALESCE(settings.monitored_employee_ids, '[]'::jsonb)
        ) AS monitored(employee_id)
        INNER JOIN employees
            ON employees.employee_id = monitored.employee_id
        WHERE employees.is_active = true
    ),
    '[]'::jsonb
),
updated_at = now()
WHERE settings.id = 1;


-- 2. Validate and filter monitoring settings.
-- Only active employees can be added to the monitoring list.

CREATE OR REPLACE FUNCTION keep_only_active_break_monitors()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF jsonb_typeof(NEW.monitored_employee_ids) IS DISTINCT FROM 'array' THEN
        RAISE EXCEPTION 'monitored_employee_ids must be a JSON array';
    END IF;

    SELECT COALESCE(
        jsonb_agg(monitored.employee_id),
        '[]'::jsonb
    )
    INTO NEW.monitored_employee_ids
    FROM jsonb_array_elements_text(
        NEW.monitored_employee_ids
    ) AS monitored(employee_id)
    INNER JOIN employees
        ON employees.employee_id = monitored.employee_id
    WHERE employees.is_active = true;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS keep_only_active_break_monitors
ON break_notification_settings;

CREATE TRIGGER keep_only_active_break_monitors
BEFORE INSERT OR UPDATE OF monitored_employee_ids
ON break_notification_settings
FOR EACH ROW
EXECUTE FUNCTION keep_only_active_break_monitors();


-- 3. Remove deactivated employees from break monitoring.
-- Only updates break_notification_settings.
-- Does not modify employee details.

CREATE OR REPLACE FUNCTION remove_inactive_employee_from_break_monitors()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE break_notification_settings AS settings
    SET monitored_employee_ids = COALESCE(
        (
            SELECT jsonb_agg(monitored.employee_id)
            FROM jsonb_array_elements_text(
                COALESCE(settings.monitored_employee_ids, '[]'::jsonb)
            ) AS monitored(employee_id)
            WHERE monitored.employee_id <> NEW.employee_id
        ),
        '[]'::jsonb
    ),
    updated_at = now()
    WHERE settings.id = 1
      AND COALESCE(settings.monitored_employee_ids, '[]'::jsonb)
          @> jsonb_build_array(NEW.employee_id);

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS remove_inactive_employee_from_break_monitors
ON employees;

CREATE TRIGGER remove_inactive_employee_from_break_monitors
AFTER UPDATE OF is_active
ON employees
FOR EACH ROW
WHEN (
    OLD.is_active IS DISTINCT FROM NEW.is_active
    AND NEW.is_active = false
)
EXECUTE FUNCTION remove_inactive_employee_from_break_monitors();

COMMIT;
