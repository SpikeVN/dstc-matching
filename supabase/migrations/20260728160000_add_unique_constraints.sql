-- Add UNIQUE constraints to prevent race-condition duplicates.
-- swipe_actions: one swipe per (swiper, swiped) pair
-- matches: one match per unordered user pair (normalized to (min, max))

-- swipe_actions unique constraint
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'uq_swipe_actions_swiper_swiped'
          AND conrelid = 'public.swipe_actions'::regclass
    ) THEN
        ALTER TABLE public.swipe_actions
        ADD CONSTRAINT uq_swipe_actions_swiper_swiped
        UNIQUE (swiper_id, swiped_id);
    END IF;
END $$;

-- matches unique constraint on unordered user pair
-- Uses a conditional unique index on (LEAST, GREATEST) to prevent
-- duplicate matches regardless of which user is user1 vs user2.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'uq_matches_user_pair'
          AND conrelid = 'public.matches'::regclass
    ) THEN
        CREATE UNIQUE INDEX uq_matches_user_pair
        ON public.matches (LEAST(user1_id, user2_id), GREATEST(user1_id, user2_id));
    END IF;
END $$;
