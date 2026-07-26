-- User preferences table for admin roles and matching visibility
-- This table is designed to be extended for future privacy settings

CREATE TABLE public.user_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    -- Admin role settings
    admin_role TEXT NOT NULL DEFAULT 'user' CHECK (admin_role IN ('owner', 'mod', 'manager', 'user')),
    assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    assigned_date TIMESTAMPTZ,
    -- Matching visibility
    admin_visible BOOLEAN DEFAULT true,
    -- Info shown settings (visibility toggles for matching profiles — JSONB for extensibility)
    info_shown JSONB DEFAULT '{}'::jsonb,
    created_date TIMESTAMPTZ DEFAULT now(),
    updated_date TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_user_preferences_user ON public.user_preferences(user_id);
CREATE INDEX idx_user_preferences_admin_role ON public.user_preferences(admin_role);

-- Grant access
GRANT ALL ON public.user_preferences TO service_role;
GRANT ALL ON public.user_preferences TO postgres;

-- Sync contestant_profiles.display_name from auth.users.raw_user_meta_data
-- Whenever a user's name is updated in GoTrue (e.g., via OAuth provider or
-- profile update), the display_name on their contestant profile is updated
-- automatically.

CREATE OR REPLACE FUNCTION public.sync_display_name()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE contestant_profiles
    SET display_name = COALESCE(
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'name',
        NEW.email,
        'User'
    )
    WHERE created_by = NEW.id;
    RETURN NEW;
END;
$$;

-- Trigger: fires when raw_user_meta_data changes (INSERT or UPDATE)
CREATE TRIGGER on_auth_user_metadata_changed
    AFTER INSERT OR UPDATE OF raw_user_meta_data ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_display_name();

-- Backfill: sync any existing users whose display_name doesn't match
UPDATE contestant_profiles cp
SET display_name = COALESCE(
    u.raw_user_meta_data->>'full_name',
    u.raw_user_meta_data->>'name',
    u.email,
    'User'
)
FROM auth.users u
WHERE cp.created_by = u.id
  AND cp.display_name IS DISTINCT FROM COALESCE(
      u.raw_user_meta_data->>'full_name',
      u.raw_user_meta_data->>'name',
      u.email,
      'User'
  );

-- sync_display_name() only needs to be invoked by the trigger on auth.users.
-- It should NOT be callable via /rest/v1/rpc/sync_display_name.
-- Keeping SECURITY DEFINER is fine for the trigger, but we revoke EXECUTE
-- from anon/public so the anon key cannot call it directly.

REVOKE EXECUTE ON FUNCTION public.sync_display_name() FROM anon, public;