-- Add timezone column to rituals table
ALTER TABLE rituals ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'UTC';

-- Refactored RPC to complete a ritual (reads timezone from table)
CREATE OR REPLACE FUNCTION complete_ritual(
  ritual_id_param uuid
)
RETURNS jsonb AS $$
DECLARE
  v_ritual RECORD;
  v_local_now timestamp;
  v_local_date date;
  v_local_time time;
  v_is_required boolean;
  v_today_weekday integer;
  v_new_streak integer;
  v_created_date date;
  client_timezone text;
BEGIN
  -- Get the ritual and check ownership
  SELECT * INTO v_ritual FROM rituals WHERE id = ritual_id_param;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ritual not found.';
  END IF;

  IF v_ritual.user_id != auth.uid() THEN
    RAISE EXCEPTION 'Access denied.';
  END IF;

  -- Load timezone from ritual record
  client_timezone := coalesce(v_ritual.timezone, 'UTC');

  -- Determine local date and time using the timezone
  BEGIN
    v_local_now := now() AT TIME ZONE client_timezone;
  EXCEPTION WHEN OTHERS THEN
    v_local_now := now() AT TIME ZONE 'UTC';
  END;
  v_local_date := v_local_now::date;
  v_local_time := v_local_now::time;

  -- Check if already completed today
  IF EXISTS (
    SELECT 1 FROM habit_logs 
    WHERE ritual_id = ritual_id_param 
      AND (completed_at AT TIME ZONE client_timezone)::date = v_local_date
  ) THEN
    RAISE EXCEPTION 'Ritual already completed today.';
  END IF;

  -- Check submission window
  IF v_ritual.submit_window THEN
    IF v_local_time < v_ritual.start_time::time OR v_local_time > v_ritual.end_time::time THEN
      RAISE EXCEPTION 'Outside of the submission time window.';
    END IF;
  END IF;

  -- Check if ritual is required today
  v_is_required := false;
  v_today_weekday := extract(dow from v_local_date)::integer;

  IF v_ritual.repeat_type = 'daily' THEN
    v_is_required := true;
  ELSIF v_ritual.repeat_type = 'custom' THEN
    IF pg_typeof(v_ritual.custom_days)::text = 'jsonb' THEN
      IF v_ritual.custom_days @> jsonb_build_array(v_today_weekday) THEN
        v_is_required := true;
      END IF;
    ELSE
      IF v_ritual.custom_days IS NOT NULL AND v_today_weekday = ANY(v_ritual.custom_days::integer[]) THEN
        v_is_required := true;
      END IF;
    END IF;
  ELSIF v_ritual.repeat_type = 'weekly' OR v_ritual.repeat_type = 'biweekly' THEN
    v_created_date := (v_ritual.created_at AT TIME ZONE client_timezone)::date;
    IF extract(dow from v_created_date)::integer = v_today_weekday THEN
      IF v_ritual.repeat_type = 'weekly' THEN
        v_is_required := true;
      ELSE
        IF (abs(v_local_date - v_created_date) / 7) % 2 = 0 THEN
          v_is_required := true;
        END IF;
      END IF;
    END IF;
  END IF;

  IF NOT v_is_required THEN
    RAISE EXCEPTION 'Ritual is not scheduled for today.';
  END IF;

  -- Insert entry into habit_logs
  INSERT INTO habit_logs (ritual_id, user_id, completed_at)
  VALUES (ritual_id_param, auth.uid(), now());

  -- Calculate the new streak from logs
  v_new_streak := calculate_ritual_streak(ritual_id_param, client_timezone);

  -- Allow update to cached fields on rituals
  PERFORM set_config('app.allow_streak_update', 'true', true);

  -- Perform the update of cached fields on rituals
  UPDATE rituals
  SET 
    current_streak = v_new_streak,
    last_completed_date = now()
  WHERE id = ritual_id_param;

  RETURN jsonb_build_object(
    'success', true,
    'new_streak', v_new_streak,
    'last_completed_date', now()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Refactored RPC to undo a completion (reads timezone from table)
CREATE OR REPLACE FUNCTION undo_ritual_completion(
  ritual_id_param uuid
)
RETURNS jsonb AS $$
DECLARE
  v_ritual RECORD;
  v_local_now timestamp;
  v_local_date date;
  v_new_streak integer;
  v_last_log_time timestamp with time zone;
  client_timezone text;
BEGIN
  -- Get the ritual and check ownership
  SELECT * INTO v_ritual FROM rituals WHERE id = ritual_id_param;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ritual not found.';
  END IF;

  IF v_ritual.user_id != auth.uid() THEN
    RAISE EXCEPTION 'Access denied.';
  END IF;

  -- Load timezone from ritual record
  client_timezone := coalesce(v_ritual.timezone, 'UTC');

  -- Determine local date
  BEGIN
    v_local_now := now() AT TIME ZONE client_timezone;
  EXCEPTION WHEN OTHERS THEN
    v_local_now := now() AT TIME ZONE 'UTC';
  END;
  v_local_date := v_local_now::date;

  -- Verify log exists for today
  IF NOT EXISTS (
    SELECT 1 FROM habit_logs 
    WHERE ritual_id = ritual_id_param 
      AND (completed_at AT TIME ZONE client_timezone)::date = v_local_date
  ) THEN
    RAISE EXCEPTION 'Ritual has not been completed today.';
  END IF;

  -- Delete log for today
  DELETE FROM habit_logs
  WHERE ritual_id = ritual_id_param 
    AND (completed_at AT TIME ZONE client_timezone)::date = v_local_date;

  -- Recalculate streak
  v_new_streak := calculate_ritual_streak(ritual_id_param, client_timezone);

  -- Find the new last completed date from remaining logs
  SELECT max(completed_at) INTO v_last_log_time
  FROM habit_logs
  WHERE ritual_id = ritual_id_param;

  -- Allow update to cached fields
  PERFORM set_config('app.allow_streak_update', 'true', true);

  -- Update cached fields on rituals
  UPDATE rituals
  SET 
    current_streak = v_new_streak,
    last_completed_date = v_last_log_time
  WHERE id = ritual_id_param;

  RETURN jsonb_build_object(
    'success', true,
    'new_streak', v_new_streak,
    'last_completed_date', v_last_log_time
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Refactored RPC to batch reset missed streaks dynamically using logs (reads timezone from table)
CREATE OR REPLACE FUNCTION reset_missed_streaks()
RETURNS void AS $$
DECLARE
  v_ritual RECORD;
  v_calculated_streak integer;
  client_timezone text;
BEGIN
  -- Loop through all rituals for the authenticated user that have a cached streak > 0
  FOR v_ritual IN 
    SELECT * FROM rituals 
    WHERE user_id = auth.uid() 
      AND current_streak > 0
  LOOP
    client_timezone := coalesce(v_ritual.timezone, 'UTC');

    -- Calculate actual streak dynamically from logs using the habit's timezone
    v_calculated_streak := calculate_ritual_streak(v_ritual.id, client_timezone);

    IF v_calculated_streak != v_ritual.current_streak THEN
      PERFORM set_config('app.allow_streak_update', 'true', true);
      
      UPDATE rituals
      SET current_streak = v_calculated_streak
      WHERE id = v_ritual.id;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
