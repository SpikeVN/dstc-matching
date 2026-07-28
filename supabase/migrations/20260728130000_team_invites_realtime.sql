-- Add team_invites to Realtime publication so invitations update instantly
ALTER PUBLICATION supabase_realtime ADD TABLE public.team_invites;
