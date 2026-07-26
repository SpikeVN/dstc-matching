/**
 * Supabase client for Realtime subscriptions.
 * Uses the self-hosted Supabase (Kong gateway) directly.
 */

import { createClient } from '@supabase/supabase-js';

let _supabase = null;

function getClient() {
  if (_supabase) return _supabase;

  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.warn('[supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY — realtime disabled');
    return null;
  }

  _supabase = createClient(url, key, {
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  });
  return _supabase;
}

/** Get the Supabase client, or null if env vars are missing. */
export function getSupabase() {
  return getClient();
}

/**
 * Set the auth token for Realtime subscriptions.
 * Call this after login and on token refresh.
 */
export function setRealtimeAuth(token) {
  const client = getClient();
  if (client && token) {
    client.realtime.setAuth(token);
  }
}
