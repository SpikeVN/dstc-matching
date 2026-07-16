const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState, useRef, useEffect } from 'react';
import { Bell, MessageCircle, Heart, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => db.auth.me(),
  });

  const { data: unreadMessages } = useQuery({
    queryKey: ['unreadMessages', currentUser?.email],
    queryFn: async () => {
      const me = await db.auth.me();
      return db.entities.Message.filter({ receiver_id: me.email, is_read: false });
    },
    initialData: [],
    enabled: !!currentUser,
    refetchInterval: 10000,
  });

  const { data: recentMatches } = useQuery({
    queryKey: ['recentMatchesNotif', currentUser?.email],
    queryFn: async () => {
      const me = await db.auth.me();
      const [m1, m2] = await Promise.all([
        db.entities.Match.filter({ user1_id: me.email }),
        db.entities.Match.filter({ user2_id: me.email }),
      ]);
      const all = [...m1, ...m2].sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
      return all.slice(0, 3);
    },
    initialData: [],
    enabled: !!currentUser,
  });

  const { data: allProfiles } = useQuery({
    queryKey: ['allProfilesForNotif'],
    queryFn: () => db.entities.ContestantProfile.list(),
    initialData: [],
  });
  const profileMap = {};
  allProfiles.forEach(p => { profileMap[p.created_by] = p; });

  const totalUnread = unreadMessages.length;

  // Close on outside click
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const notifications = [
    ...unreadMessages.slice(0, 5).map(msg => ({
      id: `msg-${msg.id}`,
      icon: MessageCircle,
      color: 'text-neon',
      bg: 'bg-neon/10',
      title: `Tin nhắn mới`,
      desc: msg.content?.slice(0, 40) + (msg.content?.length > 40 ? '...' : ''),
      time: msg.created_date,
      action: () => { navigate('/messages'); setOpen(false); },
    })),
    ...recentMatches.map(match => {
      const otherEmail = match.user1_id === currentUser?.email ? match.user2_id : match.user1_id;
      const profile = profileMap[otherEmail];
      return {
        id: `match-${match.id}`,
        icon: Heart,
        color: 'text-pink-400',
        bg: 'bg-pink-500/10',
        title: `Match mới với ${profile?.display_name || 'Unknown'}`,
        desc: [profile?.role, profile?.school].filter(Boolean).join(' — '),
        time: match.created_date,
        action: () => { navigate(`/messages?match=${match.id}`); setOpen(false); },
      };
    }),
  ].sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 8);

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const diff = Math.floor((new Date() - d) / 60000);
    if (diff < 1) return 'Vừa xong';
    if (diff < 60) return `${diff}p`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h`;
    const gmt7 = new Date(d.getTime() + 7 * 60 * 60 * 1000);
    return `${gmt7.getUTCDate().toString().padStart(2, '0')}/${(gmt7.getUTCMonth() + 1).toString().padStart(2, '0')}`;
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="relative w-9 h-9 rounded-lg flex items-center justify-center border border-neon/15 bg-neon/5 hover:bg-neon/10 hover:border-neon/30 transition-all duration-200"
      >
        <Bell className="w-4 h-4 text-neon/70" />
        {totalUnread > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-neon text-background text-[9px] font-display font-bold flex items-center justify-center">
            {totalUnread > 9 ? '9+' : totalUnread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-11 w-80 glass-card border border-neon/15 rounded-xl shadow-2xl z-50 overflow-hidden"
            style={{ boxShadow: '0 8px 40px rgba(0,0,0,0.5), 0 0 20px rgba(49,209,162,0.08)' }}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-neon/10">
              <h4 className="font-display text-sm font-semibold text-foreground">Thông báo</h4>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {notifications.length === 0 ? (
              <div className="py-8 text-center">
                <Bell className="w-8 h-8 text-neon/15 mx-auto mb-2" />
                <p className="text-xs font-body text-muted-foreground">Không có thông báo mới</p>
              </div>
            ) : (
              <div className="max-h-80 overflow-y-auto">
                {notifications.map(n => {
                  const Icon = n.icon;
                  return (
                    <button
                      key={n.id}
                      onClick={n.action}
                      className="w-full flex items-start gap-3 px-4 py-3 hover:bg-neon/5 transition-colors border-b border-neon/5 last:border-0 text-left"
                    >
                      <div className={`w-8 h-8 rounded-lg ${n.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                        <Icon className={`w-4 h-4 ${n.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-body text-foreground leading-tight">{n.title}</p>
                        <p className="text-xs font-body text-muted-foreground mt-0.5 truncate">{n.desc}</p>
                      </div>
                      <span className="text-[10px] font-body text-muted-foreground/60 flex-shrink-0 mt-0.5">
                        {formatTime(n.time)}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="px-4 py-2 border-t border-neon/10">
              <button
                onClick={() => { navigate('/messages'); setOpen(false); }}
                className="w-full text-center text-xs font-body text-neon/70 hover:text-neon transition-colors py-1"
              >
                Xem tất cả tin nhắn →
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}