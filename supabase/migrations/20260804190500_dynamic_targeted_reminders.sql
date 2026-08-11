-- Migration: Update get_active_reminders() to support dynamic push messaging: daily reminders, streak-at-risk, and milestone celebrations
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
    -- Dynamic Title based on habit state
    CASE 
      WHEN r.current_streak > 0 AND (r.submit_window = true AND (v_now AT TIME ZONE coalesce(r.timezone, 'UTC'))::time >= (r.end_time::time - interval '2 hours')) THEN
        '⚠️ Streak at Risk!'::text
      WHEN r.current_streak >= 3 AND r.last_completed_date::date = v_now::date THEN
        '🏆 Milestone Achieved!'::text
      ELSE
        '⚡ Nivora Reminder'::text
    END AS title,
    -- Dynamic Body
    CASE 
      WHEN r.current_streak > 0 AND (r.submit_window = true AND (v_now AT TIME ZONE coalesce(r.timezone, 'UTC'))::time >= (r.end_time::time - interval '2 hours')) THEN
        ('Save your ' || r.current_streak || '-day streak on "' || r.title || '" before it expires!')::text
      WHEN r.current_streak >= 3 AND r.last_completed_date::date = v_now::date THEN
        ('Fantastic! You just reached a ' || r.current_streak || '-day streak on "' || r.title || '"! Keep rising.')::text
      ELSE
        ('Don''t lose your momentum! Time for your ritual: "' || r.title || '". Show up for yourself.')::text
    END AS body
  FROM fcm_tokens t
  JOIN rituals r ON t.user_id = r.user_id
  WHERE 
    -- 1. Check if we haven't already sent a notification today in their timezone
    (r.last_notified_at IS NULL OR (r.last_notified_at AT TIME ZONE coalesce(r.timezone, 'UTC'))::date < (v_now AT TIME ZONE coalesce(r.timezone, 'UTC'))::date)
    
    -- 2. Trigger reminders for uncompleted habits OR celebrations for completed habits
    AND (
      -- A: UNCOMPLETED reminder
      (NOT EXISTS (
        SELECT 1 FROM habit_logs l
        WHERE l.ritual_id = r.id
          AND (l.completed_at AT TIME ZONE coalesce(r.timezone, 'UTC'))::date = (v_now AT TIME ZONE coalesce(r.timezone, 'UTC'))::date
      )
      -- Check if today is a scheduled day for the ritual in their timezone
      AND (
        r.repeat_type = 'daily'
        OR (r.repeat_type = 'custom' AND (
          CASE 
            WHEN pg_typeof(r.custom_days)::text = 'jsonb' THEN
              r.custom_days @> jsonb_build_array(extract(dow from (v_now AT TIME ZONE coalesce(r.timezone, 'UTC'))::date)::integer)
            ELSE
              r.custom_days IS NOT NULL AND extract(dow from (v_now AT TIME ZONE coalesce(r.timezone, 'UTC'))::date)::integer = ANY(r.custom_days::integer[])
          END
        ))
        OR ((r.repeat_type = 'weekly' OR r.repeat_type = 'biweekly') AND (
          extract(dow from (r.created_at AT TIME ZONE coalesce(r.timezone, 'UTC'))::date)::integer = extract(dow from (v_now AT TIME ZONE coalesce(r.timezone, 'UTC'))::date)::integer
          AND (
            r.repeat_type = 'weekly'
            OR (abs((v_now AT TIME ZONE coalesce(r.timezone, 'UTC'))::date - (r.created_at AT TIME ZONE coalesce(r.timezone, 'UTC'))::date) / 7) % 2 = 0
          )
        ))
      )
      -- Check if it's the right local time to trigger the reminder
      AND (
        (r.submit_window = true AND 
          (v_now AT TIME ZONE coalesce(r.timezone, 'UTC'))::time >= (r.end_time::time - interval '2 hours')
          AND (v_now AT TIME ZONE coalesce(r.timezone, 'UTC'))::time <= r.end_time::time
        )
        OR (r.submit_window = false AND 
          extract(hour from (v_now AT TIME ZONE coalesce(r.timezone, 'UTC')))::integer = 20
        )
      ))
      
      -- B: COMPLETED celebration (trigger standard notification when milestone hit)
      OR (
        EXISTS (
          SELECT 1 FROM habit_logs l
          WHERE l.ritual_id = r.id
            AND (l.completed_at AT TIME ZONE coalesce(r.timezone, 'UTC'))::date = (v_now AT TIME ZONE coalesce(r.timezone, 'UTC'))::date
        )
        AND r.current_streak IN (3, 7, 15, 30, 50, 100)
        AND extract(hour from (v_now AT TIME ZONE coalesce(r.timezone, 'UTC')))::integer = 18 -- trigger celebration at 6 PM
      )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
