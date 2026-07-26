-- Add last_active_at column to contestant_profiles for heartbeat-based online tracking
-- Used by the backend to decide whether to send email notifications for new messages.
ALTER TABLE public.contestant_profiles
  ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;