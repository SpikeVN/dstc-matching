-- Add social_links JSONB column to contestant_profiles
-- Stores platform → URL mappings, e.g. {"github": "https://github.com/...", "facebook": "..."}
ALTER TABLE public.contestant_profiles
  ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '{}'::jsonb;
