-- Add disband_initiated_by to teams for two-phase disband consent flow
-- When set, the other member must approve before the team is deleted
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS disband_initiated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Create system_settings table for global admin toggles
CREATE TABLE IF NOT EXISTS public.system_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL DEFAULT 'false'::jsonb,
    updated_date TIMESTAMPTZ DEFAULT now()
);

-- Seed default settings
INSERT INTO public.system_settings (key, value) VALUES ('require_disband_consent', 'true')
ON CONFLICT (key) DO NOTHING;

-- Grant read access to authenticated users (backend writes via service_role)
GRANT SELECT ON public.system_settings TO authenticated;