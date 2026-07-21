-- Application tables for DSTC Matching
-- These tables are used by the FastAPI backend (not by Supabase internals).

-- Users table (synced from GoTrue on signup/login)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY,
    email TEXT NOT NULL,
    full_name TEXT DEFAULT '',
    role TEXT DEFAULT 'user',
    created_date TIMESTAMPTZ DEFAULT now(),
    updated_date TIMESTAMPTZ DEFAULT now()
);

-- Contestant profiles
CREATE TABLE IF NOT EXISTS public.contestant_profiles (
    id UUID PRIMARY KEY,
    created_by UUID REFERENCES public.users(id) ON DELETE CASCADE,
    created_date TIMESTAMPTZ DEFAULT now(),
    updated_date TIMESTAMPTZ DEFAULT now(),
    display_name TEXT DEFAULT '',
    username TEXT DEFAULT '',
    bio TEXT DEFAULT '',
    birth_year INTEGER,
    gender TEXT DEFAULT '',
    city TEXT DEFAULT '',
    school TEXT DEFAULT '',
    major TEXT DEFAULT '',
    profile_image TEXT DEFAULT '',
    technical_skills JSONB DEFAULT '[]'::jsonb,
    soft_skills JSONB DEFAULT '[]'::jsonb,
    experience TEXT DEFAULT '',
    goals JSONB DEFAULT '[]'::jsonb,
    role TEXT DEFAULT '',
    achievements TEXT DEFAULT '',
    achievements_other TEXT DEFAULT '',
    has_team BOOLEAN DEFAULT false,
    team_id TEXT DEFAULT '',
    profile_complete BOOLEAN DEFAULT false
);

-- Matches (created when two users swipe right on each other)
CREATE TABLE IF NOT EXISTS public.matches (
    id UUID PRIMARY KEY,
    created_date TIMESTAMPTZ DEFAULT now(),
    updated_date TIMESTAMPTZ DEFAULT now(),
    user1_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    user2_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'matched',
    user1_confirmed BOOLEAN DEFAULT false,
    user2_confirmed BOOLEAN DEFAULT false
);

-- Messages within a match conversation
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY,
    created_date TIMESTAMPTZ DEFAULT now(),
    updated_date TIMESTAMPTZ DEFAULT now(),
    match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    receiver_id TEXT DEFAULT '',
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false
);

-- Swipe actions (like/pass)
CREATE TABLE IF NOT EXISTS public.swipe_actions (
    id UUID PRIMARY KEY,
    created_date TIMESTAMPTZ DEFAULT now(),
    updated_date TIMESTAMPTZ DEFAULT now(),
    swiper_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    swiped_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    is_match BOOLEAN DEFAULT false
);

-- Teams
CREATE TABLE IF NOT EXISTS public.teams (
    id UUID PRIMARY KEY,
    created_date TIMESTAMPTZ DEFAULT now(),
    updated_date TIMESTAMPTZ DEFAULT now(),
    name TEXT NOT NULL,
    leader_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    member_ids JSONB DEFAULT '[]'::jsonb,
    max_members INTEGER DEFAULT 4,
    status TEXT DEFAULT 'forming'
);

-- Team invitations
CREATE TABLE IF NOT EXISTS public.team_invites (
    id UUID PRIMARY KEY,
    created_date TIMESTAMPTZ DEFAULT now(),
    updated_date TIMESTAMPTZ DEFAULT now(),
    team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    inviter_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    invitee_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending'
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_contestant_profiles_created_by ON public.contestant_profiles(created_by);
CREATE INDEX IF NOT EXISTS idx_matches_user1 ON public.matches(user1_id);
CREATE INDEX IF NOT EXISTS idx_matches_user2 ON public.matches(user2_id);
CREATE INDEX IF NOT EXISTS idx_messages_match ON public.messages(match_id);
CREATE INDEX IF NOT EXISTS idx_swipe_actions_swiper ON public.swipe_actions(swiper_id);
CREATE INDEX IF NOT EXISTS idx_swipe_actions_swiped ON public.swipe_actions(swiped_id);
CREATE INDEX IF NOT EXISTS idx_teams_leader ON public.teams(leader_id);
CREATE INDEX IF NOT EXISTS idx_team_invites_invitee ON public.team_invites(invitee_id);
CREATE INDEX IF NOT EXISTS idx_team_invites_team ON public.team_invites(team_id);

-- Grant access to Supabase roles
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;
