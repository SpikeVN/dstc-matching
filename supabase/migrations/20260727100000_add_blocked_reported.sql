-- Adds blocked_users and reports tables for Block/Report features

-- ══════════════════════════════════════════════════════════════════════
-- 1. blocked_users table
-- ══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.blocked_users (
    id UUID PRIMARY KEY,
    blocker_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    blocked_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_date TIMESTAMPTZ DEFAULT now(),
    UNIQUE(blocker_id, blocked_id)
);

CREATE INDEX IF NOT EXISTS idx_blocked_users_blocker ON public.blocked_users(blocker_id);
CREATE INDEX IF NOT EXISTS idx_blocked_users_blocked ON public.blocked_users(blocked_id);

-- ══════════════════════════════════════════════════════════════════════
-- 2. reports table
-- ══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.reports (
    id UUID PRIMARY KEY,
    reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    reported_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    match_id UUID REFERENCES public.matches(id) ON DELETE SET NULL,
    reason TEXT NOT NULL DEFAULT '',
    created_date TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reports_reporter ON public.reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_reports_reported ON public.reports(reported_id);

-- ══════════════════════════════════════════════════════════════════════
-- 3. Grants
-- ══════════════════════════════════════════════════════════════════════
GRANT SELECT ON public.blocked_users TO authenticated;
GRANT INSERT ON public.blocked_users TO authenticated;
GRANT DELETE ON public.blocked_users TO authenticated;
GRANT SELECT ON public.reports TO authenticated;
GRANT INSERT ON public.reports TO authenticated;
GRANT ALL ON public.blocked_users TO service_role;
GRANT ALL ON public.blocked_users TO postgres;
GRANT ALL ON public.reports TO service_role;
GRANT ALL ON public.reports TO postgres;

-- ══════════════════════════════════════════════════════════════════════
-- 4. RLS
-- ══════════════════════════════════════════════════════════════════════
ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- blocked_users: users can view/insert/delete their own blocks
CREATE POLICY "Users can view their own blocks"
  ON public.blocked_users FOR SELECT
  USING (blocker_id = auth.uid());
CREATE POLICY "Users can block others"
  ON public.blocked_users FOR INSERT
  WITH CHECK (blocker_id = auth.uid());
CREATE POLICY "Users can unblock"
  ON public.blocked_users FOR DELETE
  USING (blocker_id = auth.uid());

-- reports: users can create reports, and admins can view all
CREATE POLICY "Users can view their own reports"
  ON public.reports FOR SELECT
  USING (reporter_id = auth.uid());
CREATE POLICY "Users can report others"
  ON public.reports FOR INSERT
  WITH CHECK (reporter_id = auth.uid());