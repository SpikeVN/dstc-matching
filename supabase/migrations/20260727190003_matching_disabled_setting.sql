-- Seed matching_disabled setting (default: false — matching is enabled)
-- When true, all matching, team creation, team disbandment and related
-- requests are rejected with "Đã hết thời hạn thực hiện matching."

INSERT INTO public.system_settings (key, value, updated_date)
VALUES ('matching_disabled', 'false'::jsonb, now())
ON CONFLICT (key) DO NOTHING;
