-- Add contestant_profiles and teams to Realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.contestant_profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.teams;
