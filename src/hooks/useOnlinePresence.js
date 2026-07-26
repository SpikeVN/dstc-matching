import { useEffect, useState } from 'react';
import { getSupabase, setRealtimeAuth } from '@/lib/supabase-client';

// Module-level store shared across all consumers
const onlineUsers = new Set();
const listeners = new Set();

function notifyListeners() {
  const snapshot = new Set(onlineUsers);
  listeners.forEach(fn => fn(snapshot));
}

/**
 * Subscribes to Supabase Realtime Presence on a global channel.
 * Tracks the current user and updates the shared onlineUsers store.
 * Call once from useRealtimeNotifications.
 */
export function usePresenceChannel(userId) {
  useEffect(() => {
    if (!userId) return;

    const supabase = getSupabase();
    if (!supabase) return;

    const token = localStorage.getItem('access_token');
    if (token) setRealtimeAuth(token);

    const channel = supabase.channel('presence-global');

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        onlineUsers.clear();
        for (const key in state) {
          const presences = state[key];
          presences.forEach(p => {
            if (p.user_id) onlineUsers.add(p.user_id);
          });
        }
        notifyListeners();
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        newPresences.forEach(p => {
          if (p.user_id) onlineUsers.add(p.user_id);
        });
        notifyListeners();
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        leftPresences.forEach(p => {
          if (p.user_id) onlineUsers.delete(p.user_id);
        });
        notifyListeners();
      })
      .subscribe();

    channel.track({ user_id: userId });

    return () => {
      channel.untrack();
      supabase.removeChannel(channel);
    };
  }, [userId]);
}

/**
 * Returns the current Set<string> of online user IDs.
 * Re-renders when the set changes.
 */
export function useOnlineUsers() {
  const [online, setOnline] = useState(() => new Set(onlineUsers));

  useEffect(() => {
    const handler = (snapshot) => setOnline(snapshot);
    listeners.add(handler);
    return () => listeners.delete(handler);
  }, []);

  return online;
}
