-- Soft-delete support for messages
-- Allows users to delete their own messages while keeping a placeholder visible to both parties

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_messages_is_deleted
  ON public.messages(is_deleted);

-- Add reply_to_id support for message replies

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS reply_to_id TEXT DEFAULT '';
