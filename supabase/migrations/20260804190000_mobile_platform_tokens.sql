-- Migration: Add platform and timestamp columns to fcm_tokens to track iOS vs Android native registrations
ALTER TABLE fcm_tokens ADD COLUMN IF NOT EXISTS platform text DEFAULT 'web';
ALTER TABLE fcm_tokens ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
