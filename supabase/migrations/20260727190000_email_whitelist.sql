-- Create email whitelist table for controlling signup access
CREATE TABLE IF NOT EXISTS public.email_whitelist (
    id UUID PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    added_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_date TIMESTAMPTZ DEFAULT now()
);

-- Index for fast lookups (used on every signup)
CREATE INDEX IF NOT EXISTS idx_email_whitelist_email ON public.email_whitelist(email);

-- RLS enabled — service_role bypasses RLS, so backend access works fine.
-- No policies = no access for anon/authenticated keys (exactly what we want).
ALTER TABLE public.email_whitelist ENABLE ROW LEVEL SECURITY;

-- Grant access (only service_role and postgres can manage this table)
GRANT ALL ON public.email_whitelist TO service_role;
GRANT ALL ON public.email_whitelist TO postgres;

-- Add to Realtime publication (idempotent) so admins see live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.email_whitelist;
