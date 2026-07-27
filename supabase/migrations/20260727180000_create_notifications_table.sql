-- Create notifications table for unified in-app notification system
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY,
    created_date TIMESTAMPTZ DEFAULT now(),
    updated_date TIMESTAMPTZ DEFAULT now(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN (
        'new_message',
        'new_match',
        'team_invite',
        'team_invite_accepted',
        'team_invite_rejected',
        'disband_request',
        'disband_accepted',
        'disband_rejected'
    )),
    title TEXT NOT NULL,
    body TEXT DEFAULT '',
    data JSONB DEFAULT '{}'::jsonb,
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMPTZ
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.notifications(user_id, is_read) WHERE is_read = false;

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS policies: users can only see their own notifications
CREATE POLICY "Users can view their own notifications"
    ON public.notifications FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own notifications"
    ON public.notifications FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own notifications"
    ON public.notifications FOR UPDATE
    USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own notifications"
    ON public.notifications FOR DELETE
    USING (user_id = auth.uid());

-- Grant access
GRANT ALL ON public.notifications TO authenticated, service_role, postgres;

-- Add to Realtime publication (idempotent)
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;