-- Add reward columns to rituals table for Habit Quests
ALTER TABLE rituals ADD COLUMN IF NOT EXISTS reward_title text;
ALTER TABLE rituals ADD COLUMN IF NOT EXISTS reward_target_streak integer;
