-- Create user_subscriptions table
CREATE TABLE IF NOT EXISTS user_subscriptions (
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  is_premium boolean DEFAULT false,
  streak_shields integer DEFAULT 0,
  subscription_expiry timestamp with time zone,
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on user_subscriptions
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_subscriptions table
DROP POLICY IF EXISTS select_own_subscription ON user_subscriptions;
CREATE POLICY select_own_subscription ON user_subscriptions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS insert_own_subscription ON user_subscriptions;
CREATE POLICY insert_own_subscription ON user_subscriptions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS update_own_subscription ON user_subscriptions;
CREATE POLICY update_own_subscription ON user_subscriptions
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- RPC to apply a streak shield pass
CREATE OR REPLACE FUNCTION apply_streak_shield(
  ritual_id_param uuid
)
RETURNS jsonb AS $$
DECLARE
  v_ritual RECORD;
  v_subscription RECORD;
  v_yesterday date;
  v_local_now timestamp;
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

  -- Get user subscription
  SELECT * INTO v_subscription FROM user_subscriptions WHERE user_id = auth.uid();
  IF NOT FOUND OR NOT v_subscription.is_premium OR v_subscription.streak_shields <= 0 THEN
    RAISE EXCEPTION 'No active shields available or premium subscription missing.';
  END IF;

  -- Load timezone from ritual record
  client_timezone := coalesce(v_ritual.timezone, 'UTC');

  -- Determine local date
  BEGIN
    v_local_now := now() AT TIME ZONE client_timezone;
  EXCEPTION WHEN OTHERS THEN
    v_local_now := now() AT TIME ZONE 'UTC';
  END;
  v_yesterday := (v_local_now - interval '1 day')::date;

  -- Check if log already exists for yesterday
  IF EXISTS (
    SELECT 1 FROM habit_logs 
    WHERE ritual_id = ritual_id_param 
      AND (completed_at AT TIME ZONE client_timezone)::date = v_yesterday
  ) THEN
    RAISE EXCEPTION 'Shield cannot be applied: Yesterday was already completed.';
  END IF;

  -- Insert yesterday's log
  INSERT INTO habit_logs (ritual_id, user_id, completed_at)
  VALUES (ritual_id_param, auth.uid(), now() - interval '1 day');

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

  -- Decrease shield count
  UPDATE user_subscriptions
  SET streak_shields = streak_shields - 1
  WHERE user_id = auth.uid();

  RETURN jsonb_build_object(
    'success', true,
    'new_streak', v_new_streak,
    'last_completed_date', v_last_log_time,
    'remaining_shields', v_subscription.streak_shields - 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
