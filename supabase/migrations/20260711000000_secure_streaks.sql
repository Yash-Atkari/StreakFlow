-- Create checks on insert to ensure streaks default to 0 and last_completed_date to NULL
CREATE OR REPLACE FUNCTION check_streak_insert_allowed()
RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.current_streak IS DISTINCT FROM 0 AND NEW.current_streak IS NOT NULL) OR 
     (NEW.last_completed_date IS NOT NULL) THEN
    RAISE EXCEPTION 'Cannot set current_streak or last_completed_date on insert. They default to 0 and NULL.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_check_streak_insert
BEFORE INSERT ON rituals
FOR EACH ROW
EXECUTE FUNCTION check_streak_insert_allowed();

-- Create checks on update to prevent direct manipulation of streak statistics
CREATE OR REPLACE FUNCTION check_streak_update_allowed()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if the special config is set to 'true' (indicating it's from our secure RPC)
  IF current_setting('app.allow_streak_update', true) = 'true' THEN
    RETURN NEW;
  END IF;

  -- If current_streak or last_completed_date is changing, raise an error
  IF (OLD.current_streak IS DISTINCT FROM NEW.current_streak) OR 
     (OLD.last_completed_date IS DISTINCT FROM NEW.last_completed_date) THEN
    RAISE EXCEPTION 'Direct updates to current_streak or last_completed_date are not allowed. Please use the RPC functions.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_check_streak_update
BEFORE UPDATE ON rituals
FOR EACH ROW
EXECUTE FUNCTION check_streak_update_allowed();

-- RPC to mark a ritual as complete
CREATE OR REPLACE FUNCTION complete_ritual(
  ritual_id_param uuid,
  client_timezone text
)
RETURNS jsonb AS $$
DECLARE
  v_ritual RECORD;
  v_local_now timestamp;
  v_local_date date;
  v_local_time time;
  v_last_completed_date date;
  v_created_date date;
  v_new_streak integer;
  v_is_required boolean;
  v_check_date date;
  v_streak_broken boolean := false;
  v_today_weekday integer;
BEGIN
  -- Get the ritual and check ownership
  SELECT * INTO v_ritual FROM rituals WHERE id = ritual_id_param;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ritual not found.';
  END IF;

  IF v_ritual.user_id != auth.uid() THEN
    RAISE EXCEPTION 'Access denied.';
  END IF;

  -- Determine local date and time using the provided timezone
  BEGIN
    v_local_now := now() AT TIME ZONE client_timezone;
  EXCEPTION WHEN OTHERS THEN
    v_local_now := now() AT TIME ZONE 'UTC';
  END;
  v_local_date := v_local_now::date;
  v_local_time := v_local_now::time;

  -- Check if already completed today
  IF v_ritual.last_completed_date IS NOT NULL THEN
    v_last_completed_date := (v_ritual.last_completed_date AT TIME ZONE client_timezone)::date;
    IF v_last_completed_date = v_local_date THEN
      RAISE EXCEPTION 'Ritual already completed today.';
    END IF;
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
    -- Check type of custom_days dynamically to handle both jsonb arrays and native pg arrays
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

  -- Calculate the new streak
  IF v_ritual.last_completed_date IS NULL THEN
    v_new_streak := 1;
  ELSE
    -- Check if streak was broken (missed required days between last_completed_date + 1 day and yesterday)
    v_check_date := v_last_completed_date + 1;
    WHILE v_check_date < v_local_date LOOP
      DECLARE
        v_check_weekday integer := extract(dow from v_check_date)::integer;
        v_check_required boolean := false;
      BEGIN
        IF v_ritual.repeat_type = 'daily' THEN
          v_check_required := true;
        ELSIF v_ritual.repeat_type = 'custom' THEN
          IF pg_typeof(v_ritual.custom_days)::text = 'jsonb' THEN
            IF v_ritual.custom_days @> jsonb_build_array(v_check_weekday) THEN
              v_check_required := true;
            END IF;
          ELSE
            IF v_ritual.custom_days IS NOT NULL AND v_check_weekday = ANY(v_ritual.custom_days::integer[]) THEN
              v_check_required := true;
            END IF;
          END IF;
        ELSIF v_ritual.repeat_type = 'weekly' OR v_ritual.repeat_type = 'biweekly' THEN
          IF extract(dow from v_created_date)::integer = v_check_weekday THEN
            IF v_ritual.repeat_type = 'weekly' THEN
              v_check_required := true;
            ELSE
              IF (abs(v_check_date - v_created_date) / 7) % 2 = 0 THEN
                v_check_required := true;
              END IF;
            END IF;
          END IF;
        END IF;

        IF v_check_required THEN
          v_streak_broken := true;
          EXIT;
        END IF;
      END;
      v_check_date := v_check_date + 1;
    END LOOP;

    IF v_streak_broken THEN
      v_new_streak := 1;
    ELSE
      v_new_streak := coalesce(v_ritual.current_streak, 0) + 1;
    END IF;
  END IF;

  -- Allow update for this transaction
  PERFORM set_config('app.allow_streak_update', 'true', true);

  -- Perform the update
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

-- RPC to undo a completion done today
CREATE OR REPLACE FUNCTION undo_ritual_completion(
  ritual_id_param uuid,
  client_timezone text
)
RETURNS jsonb AS $$
DECLARE
  v_ritual RECORD;
  v_local_now timestamp;
  v_local_date date;
  v_last_completed_date date;
  v_new_streak integer;
BEGIN
  -- Get the ritual and check ownership
  SELECT * INTO v_ritual FROM rituals WHERE id = ritual_id_param;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ritual not found.';
  END IF;

  IF v_ritual.user_id != auth.uid() THEN
    RAISE EXCEPTION 'Access denied.';
  END IF;

  -- Determine local date using the provided timezone
  BEGIN
    v_local_now := now() AT TIME ZONE client_timezone;
  EXCEPTION WHEN OTHERS THEN
    v_local_now := now() AT TIME ZONE 'UTC';
  END;
  v_local_date := v_local_now::date;

  -- Check if completed today
  IF v_ritual.last_completed_date IS NULL THEN
    RAISE EXCEPTION 'Ritual has not been completed today.';
  END IF;

  v_last_completed_date := (v_ritual.last_completed_date AT TIME ZONE client_timezone)::date;
  IF v_last_completed_date != v_local_date THEN
    RAISE EXCEPTION 'Ritual was not completed today. Cannot undo past completions.';
  END IF;

  -- Calculate the new streak
  v_new_streak := greatest((coalesce(v_ritual.current_streak, 1) - 1), 0);

  -- Allow update for this transaction
  PERFORM set_config('app.allow_streak_update', 'true', true);

  -- Perform the update
  UPDATE rituals
  SET 
    current_streak = v_new_streak,
    last_completed_date = NULL
  WHERE id = ritual_id_param;

  RETURN jsonb_build_object(
    'success', true,
    'new_streak', v_new_streak,
    'last_completed_date', NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC to reset missed streaks for all user's habits in batch
CREATE OR REPLACE FUNCTION reset_missed_streaks(
  client_timezone text
)
RETURNS void AS $$
DECLARE
  v_ritual RECORD;
  v_local_now timestamp;
  v_local_date date;
  v_last_completed_date date;
  v_created_date date;
  v_check_date date;
  v_streak_broken boolean;
BEGIN
  -- Determine local date
  BEGIN
    v_local_now := now() AT TIME ZONE client_timezone;
  EXCEPTION WHEN OTHERS THEN
    v_local_now := now() AT TIME ZONE 'UTC';
  END;
  v_local_date := v_local_now::date;

  -- Loop through all rituals for the authenticated user that have a non-zero streak
  FOR v_ritual IN 
    SELECT * FROM rituals 
    WHERE user_id = auth.uid() 
      AND current_streak > 0 
      AND last_completed_date IS NOT NULL
  LOOP
    v_last_completed_date := (v_ritual.last_completed_date AT TIME ZONE client_timezone)::date;
    v_streak_broken := false;
    v_created_date := (v_ritual.created_at AT TIME ZONE client_timezone)::date;

    -- Check if any required day between last_completed_date + 1 and yesterday was missed
    v_check_date := v_last_completed_date + 1;
    WHILE v_check_date < v_local_date LOOP
      DECLARE
        v_check_weekday integer := extract(dow from v_check_date)::integer;
        v_check_required boolean := false;
      BEGIN
        IF v_ritual.repeat_type = 'daily' THEN
          v_check_required := true;
        ELSIF v_ritual.repeat_type = 'custom' THEN
          IF pg_typeof(v_ritual.custom_days)::text = 'jsonb' THEN
            IF v_ritual.custom_days @> jsonb_build_array(v_check_weekday) THEN
              v_check_required := true;
            END IF;
          ELSE
            IF v_ritual.custom_days IS NOT NULL AND v_check_weekday = ANY(v_ritual.custom_days::integer[]) THEN
              v_check_required := true;
            END IF;
          END IF;
        ELSIF v_ritual.repeat_type = 'weekly' OR v_ritual.repeat_type = 'biweekly' THEN
          IF extract(dow from v_created_date)::integer = v_check_weekday THEN
            IF v_ritual.repeat_type = 'weekly' THEN
              v_check_required := true;
            ELSE
              IF (abs(v_check_date - v_created_date) / 7) % 2 = 0 THEN
                v_check_required := true;
              END IF;
            END IF;
          END IF;
        END IF;

        IF v_check_required THEN
          v_streak_broken := true;
          EXIT;
        END IF;
      END;
      v_check_date := v_check_date + 1;
    END LOOP;

    -- If streak is broken, update it to 0
    IF v_streak_broken THEN
      PERFORM set_config('app.allow_streak_update', 'true', true);
      
      UPDATE rituals
      SET current_streak = 0
      WHERE id = v_ritual.id;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
