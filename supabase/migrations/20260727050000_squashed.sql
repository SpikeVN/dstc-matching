-- Squashed migration: everything from 20260726181502 onwards
-- Combines: admin_preferences_trigger, backfill_user_preferences,
--           message_attachments, create_storage_buckets,
--           message_status, enable_realtime_for_app_tables, seed_owner

-- ══════════════════════════════════════════════════════════════════════
-- 1. User preferences table + sync trigger (was 20260726181502)
-- ══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.user_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    admin_role TEXT NOT NULL DEFAULT 'user' CHECK (admin_role IN ('owner', 'mod', 'manager', 'user')),
    assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    assigned_date TIMESTAMPTZ,
    admin_visible BOOLEAN DEFAULT true,
    info_shown JSONB DEFAULT '{}'::jsonb,
    created_date TIMESTAMPTZ DEFAULT now(),
    updated_date TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_preferences_user ON public.user_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_user_preferences_admin_role ON public.user_preferences(admin_role);

GRANT ALL ON public.user_preferences TO service_role;
GRANT ALL ON public.user_preferences TO postgres;

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

CREATE TRIGGER on_auth_user_metadata_changed
    AFTER INSERT OR UPDATE OF raw_user_meta_data ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_display_name();

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

REVOKE EXECUTE ON FUNCTION public.sync_display_name() FROM anon, public;

-- ══════════════════════════════════════════════════════════════════════
-- 2. Backfill user_preferences (was 20260726190000)
-- ══════════════════════════════════════════════════════════════════════
INSERT INTO public.user_preferences (id, user_id, info_shown)
SELECT gen_random_uuid(), cp.created_by,
       '{"show_age": true, "show_gender": true, "show_location": true, "show_school": true, "show_major": true, "show_achievements": true}'::jsonb
FROM contestant_profiles cp
LEFT JOIN user_preferences up ON cp.created_by = up.user_id
WHERE up.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;

-- ══════════════════════════════════════════════════════════════════════
-- 3. Message attachment columns (was 20260727010000)
-- ══════════════════════════════════════════════════════════════════════
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS attachment_url TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS attachment_type TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS attachment_name TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS attachment_category TEXT DEFAULT '';

-- ══════════════════════════════════════════════════════════════════════
-- 4. Message delivery status columns (was 20260727030000)
-- ══════════════════════════════════════════════════════════════════════
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_messages_receiver_delivered
  ON public.messages(receiver_id, match_id)
  WHERE delivered_at IS NULL;

-- ══════════════════════════════════════════════════════════════════════
-- 5. Storage buckets (was 20260727010001)
-- ══════════════════════════════════════════════════════════════════════
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('uploads', 'uploads', true, 5242880)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('profile_pictures', 'profile_pictures', true, 5242880)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('cv', 'cv', true, 5242880)
ON CONFLICT (id) DO NOTHING;

-- ══════════════════════════════════════════════════════════════════════
-- 6. Seed owner account (was 20260727020000)
-- ══════════════════════════════════════════════════════════════════════
INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    raw_user_meta_data, raw_app_meta_data
)
VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(), 'authenticated', 'authenticated',
    'admin@cteftu.id.vn',
    crypt('changeme', gen_salt('bf', 10)),
    now(), now(), now(), '', '', '', '',
    '{"full_name": "CLB Khoa học Công nghệ trong Kinh tế và Kinh doanh", "name": "CLB Khoa học công nghệ trong Kinh tế và Kinh doanh"}'::jsonb,
    '{"role": "owner"}'::jsonb
)
ON CONFLICT (email) DO NOTHING;

INSERT INTO public.user_preferences (user_id, admin_role, admin_visible, info_shown, assigned_date)
SELECT id, 'owner', true, '{"show_age": true, "show_gender": true, "show_location": true, "show_school": true, "show_major": true, "show_achievements": true}'::jsonb, now()
FROM auth.users
WHERE email = 'admin@cteftu.id.vn'
ON CONFLICT (user_id) DO UPDATE SET admin_role = 'owner';

INSERT INTO public.contestant_profiles (id, created_by, display_name, username, profile_image, profile_complete, visited_profile)
SELECT gen_random_uuid(), id,
    'CLB Khoa học Công nghệ trong Kinh tế và Kinh doanh', 'admin',
    'https://cdn.jsdelivr.net/gh/SpikeVN/dstc-matching@main/public/cte-logo-white.png',
    true, true
FROM auth.users
WHERE email = 'admin@cteftu.id.vn'
ON CONFLICT (created_by) DO NOTHING;

-- ══════════════════════════════════════════════════════════════════════
-- 7. Realtime grants + RLS policies (was 20260727040000)
-- ══════════════════════════════════════════════════════════════════════

-- SELECT grants (required for Supabase Realtime event delivery)
GRANT SELECT ON public.messages TO authenticated;
GRANT SELECT ON public.matches TO authenticated;
GRANT SELECT ON public.contestant_profiles TO authenticated;
GRANT SELECT ON public.swipe_actions TO authenticated;
GRANT SELECT ON public.teams TO authenticated;
GRANT SELECT ON public.team_invites TO authenticated;
GRANT SELECT ON public.user_preferences TO authenticated;
GRANT SELECT ON public.contestant_profiles TO anon;

-- Enable RLS
ALTER TABLE public.messages            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contestant_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.swipe_actions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_invites        ENABLE ROW LEVEL SECURITY;

-- Messages
CREATE POLICY "Users can view messages in their matches"
  ON public.messages FOR SELECT
  USING (match_id IN (SELECT id FROM public.matches WHERE user1_id = auth.uid() OR user2_id = auth.uid()));
CREATE POLICY "Users can send messages as themselves"
  ON public.messages FOR INSERT
  WITH CHECK (sender_id = auth.uid());
CREATE POLICY "Users can update messages in their matches"
  ON public.messages FOR UPDATE
  USING (match_id IN (SELECT id FROM public.matches WHERE user1_id = auth.uid() OR user2_id = auth.uid()));
CREATE POLICY "Users can delete messages in their matches"
  ON public.messages FOR DELETE
  USING (match_id IN (SELECT id FROM public.matches WHERE user1_id = auth.uid() OR user2_id = auth.uid()));

-- Matches
CREATE POLICY "Users can view their own matches"
  ON public.matches FOR SELECT
  USING (user1_id = auth.uid() OR user2_id = auth.uid());
CREATE POLICY "Users can create matches"
  ON public.matches FOR INSERT
  WITH CHECK (user1_id = auth.uid() OR user2_id = auth.uid());
CREATE POLICY "Users can update their matches"
  ON public.matches FOR UPDATE
  USING (user1_id = auth.uid() OR user2_id = auth.uid());

-- Contestant profiles
CREATE POLICY "Authenticated users can view profiles"
  ON public.contestant_profiles FOR SELECT
  USING (auth.role() = 'authenticated');
CREATE POLICY "Users can update their own profile"
  ON public.contestant_profiles FOR UPDATE
  USING (created_by = auth.uid());
CREATE POLICY "Users can create their own profile"
  ON public.contestant_profiles FOR INSERT
  WITH CHECK (created_by = auth.uid());

-- Swipe actions
CREATE POLICY "Users can view their swipes"
  ON public.swipe_actions FOR SELECT
  USING (swiper_id = auth.uid() OR swiped_id = auth.uid());
CREATE POLICY "Users can create swipes"
  ON public.swipe_actions FOR INSERT
  WITH CHECK (swiper_id = auth.uid());

-- Teams
CREATE POLICY "Authenticated users can view teams"
  ON public.teams FOR SELECT
  USING (auth.role() = 'authenticated');
CREATE POLICY "Leader can update their team"
  ON public.teams FOR UPDATE
  USING (leader_id = auth.uid());
CREATE POLICY "Leader can delete their team"
  ON public.teams FOR DELETE
  USING (leader_id = auth.uid());

-- Team invites
CREATE POLICY "Users can view their team invites"
  ON public.team_invites FOR SELECT
  USING (inviter_id = auth.uid() OR invitee_id = auth.uid());
CREATE POLICY "Users can create invites as themselves"
  ON public.team_invites FOR INSERT
  WITH CHECK (inviter_id = auth.uid());
CREATE POLICY "Invitee can update invite status"
  ON public.team_invites FOR UPDATE
  USING (invitee_id = auth.uid());
