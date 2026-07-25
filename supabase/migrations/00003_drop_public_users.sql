-- Drop public.users and retarget all FKs to auth.users (GoTrue)
-- This makes auth.users the single source of truth. Deleting a GoTrue user
-- now cascades to contestant_profiles, matches, messages, etc.

-- Add email column to contestant_profiles for mailer notifications
ALTER TABLE public.contestant_profiles
  ADD COLUMN IF NOT EXISTS email TEXT DEFAULT '';

-- Backfill email from existing data (if any rows exist in public.users)
UPDATE public.contestant_profiles cp
SET email = u.email
FROM public.users u
WHERE cp.created_by = u.id AND cp.email = '';

-- ── Drop existing FK constraints ────────────────────────────────────────
ALTER TABLE public.contestant_profiles DROP CONSTRAINT IF EXISTS contestant_profiles_created_by_fkey;
ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS matches_user1_id_fkey;
ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS matches_user2_id_fkey;
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_sender_id_fkey;
ALTER TABLE public.swipe_actions DROP CONSTRAINT IF EXISTS swipe_actions_swiper_id_fkey;
ALTER TABLE public.swipe_actions DROP CONSTRAINT IF EXISTS swipe_actions_swiped_id_fkey;
ALTER TABLE public.teams DROP CONSTRAINT IF EXISTS teams_leader_id_fkey;
ALTER TABLE public.team_invites DROP CONSTRAINT IF EXISTS team_invites_inviter_id_fkey;
ALTER TABLE public.team_invites DROP CONSTRAINT IF EXISTS team_invites_invitee_id_fkey;

-- ── Clean up orphaned rows ──────────────────────────────────────────────
-- Some profiles/actions may reference user IDs that only existed in
-- public.users but not in auth.users. Delete them before retargeting FKs.

DELETE FROM public.messages
  WHERE sender_id NOT IN (SELECT id FROM auth.users);
DELETE FROM public.team_invites
  WHERE inviter_id NOT IN (SELECT id FROM auth.users)
     OR invitee_id NOT IN (SELECT id FROM auth.users);
DELETE FROM public.teams
  WHERE leader_id NOT IN (SELECT id FROM auth.users);
DELETE FROM public.swipe_actions
  WHERE swiper_id NOT IN (SELECT id FROM auth.users)
     OR swiped_id NOT IN (SELECT id FROM auth.users);
DELETE FROM public.matches
  WHERE user1_id NOT IN (SELECT id FROM auth.users)
     OR user2_id NOT IN (SELECT id FROM auth.users);
DELETE FROM public.contestant_profiles
  WHERE created_by NOT IN (SELECT id FROM auth.users);

-- ── Recreate FKs pointing to auth.users ─────────────────────────────────
ALTER TABLE public.contestant_profiles ADD CONSTRAINT contestant_profiles_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.matches ADD CONSTRAINT matches_user1_id_fkey
  FOREIGN KEY (user1_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.matches ADD CONSTRAINT matches_user2_id_fkey
  FOREIGN KEY (user2_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.messages ADD CONSTRAINT messages_sender_id_fkey
  FOREIGN KEY (sender_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.swipe_actions ADD CONSTRAINT swipe_actions_swiper_id_fkey
  FOREIGN KEY (swiper_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.swipe_actions ADD CONSTRAINT swipe_actions_swiped_id_fkey
  FOREIGN KEY (swiped_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.teams ADD CONSTRAINT teams_leader_id_fkey
  FOREIGN KEY (leader_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.team_invites ADD CONSTRAINT team_invites_inviter_id_fkey
  FOREIGN KEY (inviter_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.team_invites ADD CONSTRAINT team_invites_invitee_id_fkey
  FOREIGN KEY (invitee_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ── Drop the redundant public.users table ────────────────────────────────
DROP TABLE IF EXISTS public.users CASCADE;
