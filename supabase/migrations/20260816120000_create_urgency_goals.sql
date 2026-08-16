-- Migration: Create urgency_goals table to track short-term time-critical goals

CREATE TABLE IF NOT EXISTS urgency_goals (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text,
  start_time timestamp with time zone NOT NULL,
  end_time timestamp with time zone NOT NULL,
  completed boolean DEFAULT false NOT NULL,
  completed_at timestamp with time zone,
  notified_50 boolean DEFAULT false NOT NULL,
  notified_75 boolean DEFAULT false NOT NULL,
  notified_deadline boolean DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE urgency_goals ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view their own urgency goals
DROP POLICY IF EXISTS select_own_urgency ON urgency_goals;
CREATE POLICY select_own_urgency ON urgency_goals
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Allow authenticated users to insert their own urgency goals
DROP POLICY IF EXISTS insert_own_urgency ON urgency_goals;
CREATE POLICY insert_own_urgency ON urgency_goals
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Allow authenticated users to update their own urgency goals
DROP POLICY IF EXISTS update_own_urgency ON urgency_goals;
CREATE POLICY update_own_urgency ON urgency_goals
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Allow authenticated users to delete their own urgency goals
DROP POLICY IF EXISTS delete_own_urgency ON urgency_goals;
CREATE POLICY delete_own_urgency ON urgency_goals
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
