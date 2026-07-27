import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { getSupabase, setRealtimeAuth } from '@/lib/supabase-client';
import { usePresenceChannel } from './useOnlinePresence';

/**
 * Subscribes to Supabase Realtime postgres_changes on the `messages`,
 * `matches`, and `notifications` tables.
 * Invalidates React Query caches and shows toasts.
 */
export function useRealtimeNotifications({ currentUser, profileMap, navigate }) {
  const queryClient = useQueryClient();
  const notifiedIds = useRef(new Set());
  const location = useLocation();
  const isMessagesPage = location.pathname === '/messages';

  useEffect(() => {
    if (!currentUser?.id) return;

    const supabase = getSupabase();
    if (!supabase) return;

    // Authenticate the realtime connection with the user's JWT
    const token = localStorage.getItem('access_token');
    if (token) setRealtimeAuth(token);

    // ── Messages (INSERT) ────────────────────────────────────────────
    const messagesChannel = supabase
      .channel('messages-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const msg = payload.new;

          // Push message directly into the query cache (no polling needed)
          queryClient.setQueryData(['messages', msg.match_id], (old = []) => {
            if (old.some(m => m.id === msg.id)) return old; // deduplicate
            return [...old, msg];
          });

          // Update unread count cache for the dashboard
          if (msg.receiver_id === currentUser.id && !msg.is_read) {
            queryClient.setQueryData(['unreadMessages', currentUser.id], (old = []) => {
              if (old.some(m => m.id === msg.id)) return old;
              return [...old, msg];
            });
            queryClient.setQueryData(['unreadForDash', currentUser.id], (old = []) => {
              if (old.some(m => m.id === msg.id)) return old;
              return [...old, msg];
            });

            // Toast for messages sent TO the current user (skip if already on messages page)
            if (!notifiedIds.current.has(msg.id) && !isMessagesPage) {
              notifiedIds.current.add(msg.id);
              const senderProfile = profileMap?.[msg.sender_id];
              const senderName = senderProfile?.display_name || 'Ai đó';

              toast(`${senderName} vừa nhắn tin`, {
                description: msg.content?.slice(0, 60) + (msg.content?.length > 60 ? '...' : ''),
                duration: 5000,
                action: {
                  label: 'Xem',
                  onClick: () => navigate('/messages'),
                },
              });
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages' },
        (payload) => {
          const msg = payload.new;
          // Update the message in the match cache (syncs read/delivered status to the sender)
          queryClient.setQueryData(['messages', msg.match_id], (old = []) => {
            if (!old) return old;
            return old.map(m => m.id === msg.id
              ? { ...m, is_read: msg.is_read, read_at: msg.read_at, delivered_at: msg.delivered_at, updated_date: msg.updated_date }
              : m
            );
          });
        }
      )
      .subscribe((status) => {
        console.log('[realtime] messages channel:', status);
      });

    // ── Matches (INSERT + UPDATE) ────────────────────────────────────
    const matchesChannel = supabase
      .channel('matches-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'matches' },
        (payload) => {
          const match = payload.new;

          // Only care about matches involving the current user
          if (match.user1_id !== currentUser.id && match.user2_id !== currentUser.id) return;

          queryClient.invalidateQueries({ queryKey: ['matches'] });

          if (!notifiedIds.current.has(match.id)) {
            notifiedIds.current.add(match.id);
            const otherId = match.user1_id === currentUser.id ? match.user2_id : match.user1_id;
            const otherProfile = profileMap?.[otherId];
            const otherName = otherProfile?.display_name || 'Ai đó';

            toast(`Match mới với ${otherName}!`, {
              description: [otherProfile?.role, otherProfile?.school].filter(Boolean).join(' — '),
              duration: 6000,
              action: {
                label: 'Nhắn tin',
                onClick: () => navigate(`/messages?match=${match.id}`),
              },
            });
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'matches' },
        (payload) => {
          const match = payload.new;

          // Invalidate both the single match and the matches list
          queryClient.invalidateQueries({ queryKey: ['match', match.id] });
          queryClient.invalidateQueries({ queryKey: ['matches'] });
        }
      )
      .subscribe((status) => {
        console.log('[realtime] matches channel:', status);
      });

    // ── Notifications (INSERT) ───────────────────────────────────────
    const notificationsChannel = supabase
      .channel('notifications-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        (payload) => {
          const notif = payload.new;

          // Only handle notifications for the current user
          if (notif.user_id !== currentUser.id) return;

          // Invalidate notification queries so the UI refreshes
          queryClient.invalidateQueries({ queryKey: ['notifications', currentUser.id] });
          queryClient.invalidateQueries({ queryKey: ['notificationsUnread', currentUser.id] });

          // Show a toast for certain notification types
          if (!notifiedIds.current.has(notif.id)) {
            notifiedIds.current.add(notif.id);

            // Determine the toast appearance and action based on type
            let actionLabel = 'Xem';
            let actionPath = null;

            switch (notif.type) {
              case 'team_invite':
                actionLabel = 'Xem đội';
                actionPath = '/team';
                break;
              case 'team_invite_accepted':
                actionLabel = 'Xem đội';
                actionPath = '/team';
                break;
              case 'disband_request':
                actionLabel = 'Xem đội';
                actionPath = '/team';
                break;
              case 'disband_accepted':
                actionLabel = 'Xem đội';
                actionPath = '/team';
                break;
              case 'disband_rejected':
                actionLabel = 'Xem đội';
                actionPath = '/team';
                break;
              case 'new_message':
                actionLabel = 'Xem';
                actionPath = '/messages';
                break;
              case 'new_match':
                actionLabel = 'Nhắn tin';
                const matchId = notif.data?.match_id;
                actionPath = matchId ? `/messages?match=${matchId}` : '/messages';
                break;
            }

            toast(notif.title, {
              description: notif.body?.slice(0, 60) || '',
              duration: 5000,
              action: actionPath ? {
                label: actionLabel,
                onClick: () => navigate(actionPath),
              } : undefined,
            });
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notifications' },
        (payload) => {
          const notif = payload.new;
          if (notif.user_id !== currentUser.id) return;
          // Refresh notification data when read status changes
          queryClient.invalidateQueries({ queryKey: ['notifications', currentUser.id] });
          queryClient.invalidateQueries({ queryKey: ['notificationsUnread', currentUser.id] });
        }
      )
      .subscribe((status) => {
        console.log('[realtime] notifications channel:', status);
      });

    return () => {
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(matchesChannel);
      supabase.removeChannel(notificationsChannel);
    };
  }, [currentUser?.id, profileMap, navigate, queryClient]);

  // ── Presence (online status) ───────────────────────────────────────
  usePresenceChannel(currentUser?.id);
}