ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS terms_accepted BOOLEAN DEFAULT false;
