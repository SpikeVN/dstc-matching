-- Adds attachment columns to reports table for file attachments on reports

ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS attachment_url TEXT;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS attachment_name TEXT;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS attachment_type TEXT;
