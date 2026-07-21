import { db } from '@/api/apiClient';

import { useEffect, useRef } from 'react';

import { toast } from 'sonner';

const APP_URL = window.location.origin;

/**
 * Subscribes to real-time Message and Match events.
 * - Shows in-app toast immediately
 * - Sends email notification (once per event, deduped by id)
 */
export function useRealtimeNotifications({ currentUser, profileMap, navigate }) {
  const notifiedIds = useRef(new Set());

  useEffect(() => {
    if (!currentUser?.id) return;

    // ── Messages ──────────────────────────────────────────────────────────
    const unsubMessage = db.entities.Message.subscribe(async (event) => {
      if (event.type !== 'create') return;
      const msg = event.data;
      if (msg.receiver_id !== currentUser.id) return;
      if (notifiedIds.current.has(event.id)) return;
      notifiedIds.current.add(event.id);

      const senderProfile = profileMap?.[msg.sender_id];
      const senderName = senderProfile?.display_name || 'Ai đó';

      // In-app toast
      toast(`${senderName} vừa nhắn tin`, {
        description: msg.content?.slice(0, 60) + (msg.content?.length > 60 ? '...' : ''),
        duration: 5000,
        action: {
          label: 'Xem',
          onClick: () => navigate('/messages'),
        },
      });

      // Email notification
      try {
        await db.integrations.Core.SendEmail({
          from_name: 'DSTC Matching',
          to: currentUser.email,
          subject: `[DSTC Matching] ${senderName} vừa gửi cho bạn một tin nhắn`,
          body: `Xin chào ${currentUser.full_name || 'bạn'},

${senderName} vừa gửi cho bạn một tin nhắn trên DSTC Matching:

"${msg.content}"

${senderProfile?.role ? `Vai trò: ${senderProfile.role}` : ''}
${senderProfile?.school ? `Trường: ${senderProfile.school}` : ''}

Đăng nhập để trả lời: ${APP_URL}/messages

---
DSTC: VQC 2026 — CTE FTU
Trường Đại học Ngoại thương`,
        });
      } catch (_) {
        // Email is best-effort, silent fail
      }
    });

    // ── Matches ───────────────────────────────────────────────────────────
    const unsubMatch = db.entities.Match.subscribe(async (event) => {
      if (event.type !== 'create') return;
      const match = event.data;
      if (match.user1_id !== currentUser.id && match.user2_id !== currentUser.id) return;
      if (notifiedIds.current.has(event.id)) return;
      notifiedIds.current.add(event.id);

      const otherId = match.user1_id === currentUser.id ? match.user2_id : match.user1_id;
      const otherProfile = profileMap?.[otherId];
      const otherName = otherProfile?.display_name || 'Ai đó';

      // In-app toast
      toast(`Match mới với ${otherName}!`, {
        description: [otherProfile?.role, otherProfile?.school].filter(Boolean).join(' — '),
        duration: 6000,
        action: {
          label: 'Nhắn tin',
          onClick: () => navigate(`/messages?match=${match.id}`),
        },
      });

      // Email notification
      try {
        await db.integrations.Core.SendEmail({
          from_name: 'DSTC Matching',
          to: currentUser.email,
          subject: `[DSTC Matching] Bạn đã match với ${otherName}!`,
          body: `Xin chào ${currentUser.full_name || 'bạn'},

Chúc mừng! Bạn và ${otherName} đã match với nhau trên DSTC Matching.

${otherProfile?.role ? `Vai trò: ${otherProfile.role}` : ''}
${otherProfile?.school ? `Trường: ${otherProfile.school}` : ''}
${otherProfile?.bio ? `Giới thiệu: ${otherProfile.bio}` : ''}

Hãy gửi tin nhắn đầu tiên để bắt đầu kết nối:
${APP_URL}/messages?match=${match.id}

---
DSTC: VQC 2026 — CTE FTU
Trường Đại học Ngoại thương`,
        });
      } catch (_) {
        // Email is best-effort, silent fail
      }
    });

    return () => {
      unsubMessage();
      unsubMatch();
    };
  }, [currentUser?.id, profileMap, navigate]);
}