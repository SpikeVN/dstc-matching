-- Enable RLS on public.user_preferences
-- The backend accesses this table via asyncpg (service_role), which bypasses RLS.
-- No policies are needed — the GRANT SELECT TO authenticated from the squashed
-- migration is effectively overridden by RLS, keeping data confined to the API.

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;