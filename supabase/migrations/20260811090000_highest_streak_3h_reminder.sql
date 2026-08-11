-- Migration: Update get_active_reminders() to target the highest-streak uncompleted habit for today at a 2-hour interval
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
  WITH uncompleted_rituals AS (
    SELECT 
      r.id,
      r.user_id,
      r.title AS habit_title,
      r.current_streak,
      r.timezone,
      r.last_notified_at
    FROM rituals r
    WHERE 
      -- 1. Check if the habit has NOT been completed today in their timezone
      NOT EXISTS (
        SELECT 1 FROM habit_logs l
        WHERE l.ritual_id = r.id
          AND (l.completed_at AT TIME ZONE coalesce(r.timezone, 'UTC'))::date = (v_now AT TIME ZONE coalesce(r.timezone, 'UTC'))::date
      )
      -- 2. Check if today is a scheduled day for the ritual in their timezone
      AND (
        r.repeat_type = 'daily'
        OR (r.repeat_type = 'custom' AND (
          r.custom_days IS NOT NULL 
          AND extract(dow from (v_now AT TIME ZONE coalesce(r.timezone, 'UTC'))::date)::integer = ANY(r.custom_days)
        ))
        OR ((r.repeat_type = 'weekly' OR r.repeat_type = 'biweekly') AND (
          extract(dow from (r.created_at AT TIME ZONE coalesce(r.timezone, 'UTC'))::date)::integer = extract(dow from (v_now AT TIME ZONE coalesce(r.timezone, 'UTC'))::date)::integer
          AND (
            r.repeat_type = 'weekly'
            OR (abs((v_now AT TIME ZONE coalesce(r.timezone, 'UTC'))::date - (r.created_at AT TIME ZONE coalesce(r.timezone, 'UTC'))::date) / 7) % 2 = 0
          )
        ))
      )
  ),
  highest_streak_rituals AS (
    SELECT DISTINCT ON (user_id)
      id,
      user_id,
      habit_title,
      current_streak,
      timezone,
      last_notified_at
    FROM uncompleted_rituals
    ORDER BY user_id, current_streak DESC
  )
  SELECT 
    t.token AS token,
    h.id AS ritual_id,
    '🔥 StreakFlow Reminder'::text AS title,
    CASE 
      WHEN h.current_streak > 0 THEN
        ('Don''t lose your ' || h.current_streak || '-day streak! Time to complete your habit: "' || h.habit_title || '".')::text
      ELSE
        ('Time to start your new streak! Show up for your habit: "' || h.habit_title || '".')::text
    END AS body
  FROM fcm_tokens t
  JOIN highest_streak_rituals h ON t.user_id = h.user_id
  WHERE 
    -- 3. Check if we haven't already sent a notification in the last 2 hours
    (h.last_notified_at IS NULL OR h.last_notified_at < v_now - interval '2 hours')
    -- 4. Check if it's currently daytime (9:00 AM to 9:00 PM local time) to prevent late-night disturbances
    AND extract(hour from (v_now AT TIME ZONE coalesce(h.timezone, 'UTC')))::integer BETWEEN 9 AND 21;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
