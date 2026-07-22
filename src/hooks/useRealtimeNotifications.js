import { db } from '@/api/apiClient';

import { useEffect, useRef } from 'react';

import { toast } from 'sonner';

/**
 * Subscribes to real-time Message and Match events (via polling fallback).
 * Shows in-app toasts. Email notifications are sent server-side.
 */
export function useRealtimeNotifications({ currentUser, profileMap, navigate }) {
  const notifiedIds = useRef(new Set());

  useEffect(() => {
    if (!currentUser?.id) return;

    // ── Messages ──────────────────────────────────────────────────────────
    const unsubMessage = db.entities.Message.subscribe((event) => {
      if (event.type !== 'create') return;
      const msg = event.data;
      if (msg.receiver_id !== currentUser.id) return;
      if (notifiedIds.current.has(event.id)) return;
      notifiedIds.current.add(event.id);

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
    });

    // ── Matches ───────────────────────────────────────────────────────────
    const unsubMatch = db.entities.Match.subscribe((event) => {
      if (event.type !== 'create') return;
      const match = event.data;
      if (match.user1_id !== currentUser.id && match.user2_id !== currentUser.id) return;
      if (notifiedIds.current.has(event.id)) return;
      notifiedIds.current.add(event.id);

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
    });

    return () => {
      unsubMessage();
      unsubMatch();
    };
  }, [currentUser?.id, profileMap, navigate]);
}
