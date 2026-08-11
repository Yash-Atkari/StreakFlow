-- Add last_notified_at column to track habit notification states and prevent duplicates
ALTER TABLE rituals ADD COLUMN IF NOT EXISTS last_notified_at timestamp with time zone;

-- RPC to retrieve active device tokens and target reminder messages
CREATE OR REPLACE FUNCTION get_active_reminders()
RETURNS TABLE (
  token text,
  ritual_id uuid,
  title text,
  body text
) AS $$
DECLARE
  v_now timestamp with time zone := now();
BEGIN
  RETURN QUERY
  SELECT 
    t.token,
    r.id AS ritual_id,
    '✨ Nivora Reminder'::text AS title,
    ('Don''t lose your streak! Time to complete your habit: ' || r.title)::text AS body
  FROM fcm_tokens t
  JOIN rituals r ON t.user_id = r.user_id
  WHERE 
    -- 1. Check if we haven't already sent a notification today in their timezone
    (r.last_notified_at IS NULL OR (r.last_notified_at AT TIME ZONE coalesce(r.timezone, 'UTC'))::date < (v_now AT TIME ZONE coalesce(r.timezone, 'UTC'))::date)
    
    -- 2. Check if the habit has NOT been completed today in their timezone
    AND NOT EXISTS (
      SELECT 1 FROM habit_logs l
      WHERE l.ritual_id = r.id
        AND (l.completed_at AT TIME ZONE coalesce(r.timezone, 'UTC'))::date = (v_now AT TIME ZONE coalesce(r.timezone, 'UTC'))::date
    )
    
    -- 3. Check if today is a scheduled day for the ritual in their timezone
    AND (
      -- Daily
      r.repeat_type = 'daily'
      -- Custom
      OR (r.repeat_type = 'custom' AND (
        CASE 
          WHEN pg_typeof(r.custom_days)::text = 'jsonb' THEN
            r.custom_days @> jsonb_build_array(extract(dow from (v_now AT TIME ZONE coalesce(r.timezone, 'UTC'))::date)::integer)
          ELSE
            r.custom_days IS NOT NULL AND extract(dow from (v_now AT TIME ZONE coalesce(r.timezone, 'UTC'))::date)::integer = ANY(r.custom_days::integer[])
        END
      ))
      -- Weekly / Biweekly
      OR ((r.repeat_type = 'weekly' OR r.repeat_type = 'biweekly') AND (
        extract(dow from (r.created_at AT TIME ZONE coalesce(r.timezone, 'UTC'))::date)::integer = extract(dow from (v_now AT TIME ZONE coalesce(r.timezone, 'UTC'))::date)::integer
        AND (
          r.repeat_type = 'weekly'
          OR (abs((v_now AT TIME ZONE coalesce(r.timezone, 'UTC'))::date - (r.created_at AT TIME ZONE coalesce(r.timezone, 'UTC'))::date) / 7) % 2 = 0
        )
      ))
    )
    
    -- 4. Check if it's the right local time to trigger the reminder
    AND (
      -- If submission window is active: trigger in the last hour of the window
      (r.submit_window = true AND 
        (v_now AT TIME ZONE coalesce(r.timezone, 'UTC'))::time >= (r.end_time::time - interval '1 hour')
        AND (v_now AT TIME ZONE coalesce(r.timezone, 'UTC'))::time <= r.end_time::time
      )
      -- If no submission window: trigger at default hour (e.g. 8:00 PM local time / 20:00)
      OR (r.submit_window = false AND 
        extract(hour from (v_now AT TIME ZONE coalesce(r.timezone, 'UTC')))::integer = 20
      )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC to mark rituals as notified in batch
CREATE OR REPLACE FUNCTION mark_rituals_notified(
  ritual_ids_param uuid[]
)
RETURNS void AS $$
BEGIN
  UPDATE rituals
  SET last_notified_at = now()
  WHERE id = ANY(ritual_ids_param);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
