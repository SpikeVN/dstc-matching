-- Seed default signup method settings
-- All signup methods enabled by default

INSERT INTO public.system_settings (key, value, updated_date)
VALUES
    ('signup_email_enabled', 'true'::jsonb, now()),
    ('signup_google_enabled', 'true'::jsonb, now()),
    ('signup_github_enabled', 'true'::jsonb, now())
ON CONFLICT (key) DO NOTHING;
