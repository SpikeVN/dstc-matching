-- Backfill user_preferences for existing users who don't have a row yet.
-- Gives all users default info_shown with all fields enabled.

INSERT INTO public.user_preferences (id, user_id, info_shown)
SELECT gen_random_uuid(), cp.created_by,
       '{"show_age": true, "show_gender": true, "show_location": true, "show_school": true, "show_major": true, "show_achievements": true}'::jsonb
FROM contestant_profiles cp
LEFT JOIN user_preferences up ON cp.created_by = up.user_id
WHERE up.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;
