-- Enable Row Level Security (RLS) on the rituals table
ALTER TABLE rituals ENABLE ROW LEVEL SECURITY;

-- RLS Policies for the rituals table

-- 1. SELECT Policy: Allow users to view only their own rituals
DROP POLICY IF EXISTS select_own_rituals ON rituals;
CREATE POLICY select_own_rituals ON rituals
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 2. INSERT Policy: Allow users to insert rituals with their own user_id
DROP POLICY IF EXISTS insert_own_rituals ON rituals;
CREATE POLICY insert_own_rituals ON rituals
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 3. UPDATE Policy: Allow users to update only their own rituals
DROP POLICY IF EXISTS update_own_rituals ON rituals;
CREATE POLICY update_own_rituals ON rituals
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4. DELETE Policy: Allow users to delete only their own rituals
DROP POLICY IF EXISTS delete_own_rituals ON rituals;
CREATE POLICY delete_own_rituals ON rituals
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);


-- Enable Row Level Security (RLS) on the fcm_tokens table
ALTER TABLE fcm_tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policies for the fcm_tokens table

-- 1. SELECT Policy: Allow users to view only their own device tokens
DROP POLICY IF EXISTS select_own_fcm_tokens ON fcm_tokens;
CREATE POLICY select_own_fcm_tokens ON fcm_tokens
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 2. INSERT Policy: Allow users to register only their own device tokens
DROP POLICY IF EXISTS insert_own_fcm_tokens ON fcm_tokens;
CREATE POLICY insert_own_fcm_tokens ON fcm_tokens
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 3. UPDATE Policy: Allow users to update only their own device tokens
DROP POLICY IF EXISTS update_own_fcm_tokens ON fcm_tokens;
CREATE POLICY update_own_fcm_tokens ON fcm_tokens
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4. DELETE Policy: Allow users to delete only their own device tokens
DROP POLICY IF EXISTS delete_own_fcm_tokens ON fcm_tokens;
CREATE POLICY delete_own_fcm_tokens ON fcm_tokens
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
