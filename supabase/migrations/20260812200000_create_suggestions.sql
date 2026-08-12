-- Migration: Create suggestions table to collect user suggestions and improvements

CREATE TABLE IF NOT EXISTS suggestions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  improvement text NOT NULL,
  how_it_helps text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE suggestions ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to submit suggestions
DROP POLICY IF EXISTS insert_own_suggestion ON suggestions;
CREATE POLICY insert_own_suggestion ON suggestions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Allow authenticated users to view their own suggestions
DROP POLICY IF EXISTS select_own_suggestions ON suggestions;
CREATE POLICY select_own_suggestions ON suggestions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
