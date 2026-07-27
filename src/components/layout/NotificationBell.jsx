import { db } from '@/api/apiClient';

import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Bell, MessageCircle, Heart, X, Users, Trash2, UserPlus, UserMinus, LogOut } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

const NOTIF_ICONS = {
  new_message: MessageCircle,
  new_match: Heart,
  team_invite: UserPlus,
  team_invite_accepted: UserPlus,
  team_invite_rejected: UserMinus,
  disband_request: LogOut,
  disband_accepted: Users,
  disband_rejected: X,
};

const NOTIF_COLORS = {
  new_message: 'text-blue-400',
  new_match: 'text-pink-400',
  team_invite: 'text-primary',
  team_invite_accepted: 'text-primary',
  team_invite_rejected: 'text-orange-400',
  disband_request: 'text-red-400',
  disband_accepted: 'text-red-400',
  disband_rejected: 'text-muted-foreground',
};

const NOTIF_BG = {
  new_message: 'bg-blue-500/10',
  new_match: 'bg-pink-500/10',
  team_invite: 'bg-primary/10',
  team_invite_accepted: 'bg-primary/10',
  team_invite_rejected: 'bg-orange-500/10',
  disband_request: 'bg-red-500/10',
  disband_accepted: 'bg-red-500/10',
  disband_rejected: 'bg-muted/20',
};

export default function NotificationBell({ compact }) {
  const [open, setOpen] = useState(false);
  const [popupPos, setPopupPos] = useState(null);
  const ref = useRef(null);
  const buttonRef = useRef(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => db.auth.me(),
  });

  const { data: notifications } = useQuery({
    queryKey: ['notifications', currentUser?.id],
    queryFn: () => db.notifications.list(),
    initialData: [],
    enabled: !!currentUser,
  });

  const { data: unreadCount } = useQuery({
    queryKey: ['notificationsUnread', currentUser?.id],
    queryFn: () => db.notifications.unreadCount(),
    enabled: !!currentUser,
    refetchInterval: 30000,
  });

  const totalUnread = unreadCount?.count ?? 0;

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (buttonRef.current?.contains(e.target) || ref.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleClearAll = async () => {
    await db.notifications.clearAll();
    queryClient.invalidateQueries({ queryKey: ['notifications', currentUser?.id] });
    queryClient.invalidateQueries({ queryKey: ['notificationsUnread', currentUser?.id] });
  };

  const handleItemClick = (notif) => {
    setOpen(false);

    // Mark as read
    db.notifications.markRead([notif.id]).then(() => {
      queryClient.invalidateQueries({ queryKey: ['notifications', currentUser?.id] });
      queryClient.invalidateQueries({ queryKey: ['notificationsUnread', currentUser?.id] });
    });

    // Navigate based on type
    switch (notif.type) {
      case 'new_message':
        navigate('/messages');
        break;
      case 'new_match':
        navigate(notif.data?.match_id ? `/messages?match=${notif.data.match_id}` : '/messages');
        break;
      case 'team_invite':
      case 'team_invite_accepted':
      case 'team_invite_rejected':
      case 'disband_request':
      case 'disband_accepted':
      case 'disband_rejected':
        navigate('/team');
        break;
      default:
        navigate('/messages');
    }
  };

  const handleToggle = () => {
    if (open) {
      setOpen(false);
      return;
    }
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPopupPos({
        top: rect.bottom + 4,
        left: rect.left,
      });
    }
    setOpen(true);
  };

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
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={handleToggle}
        className={`transition-all duration-200 ${
          compact
            ? 'relative w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-primary/10 hover:text-primary/80'
            : 'flex items-center gap-3 px-4 py-3 rounded-lg text-sm w-full text-muted-foreground hover:bg-primary/5 hover:text-primary/80'
        }`}
      >
        <Bell className={`${compact ? 'w-4 h-4' : 'w-4 h-4'} ${compact && totalUnread > 0 ? 'text-primary' : ''}`} />
        {!compact && 'Thông báo'}
        {totalUnread > 0 && (
          <span className={`rounded-full bg-primary text-background text-[9px] font-display font-bold flex items-center justify-center ${
            compact ? 'absolute -top-0.5 -right-0.5 w-4 h-4' : 'ml-auto w-4 h-4'
          }`}>
            {totalUnread > 9 ? '9+' : totalUnread}
          </span>
        )}
      </button>
      {ReactDOM.createPortal(
        <AnimatePresence>
          {open && popupPos && (
            <motion.div
              key="notification-popup"
              initial={{ opacity: 0, y: -8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              transition={{ duration: 0.15 }}
              className="fixed w-80 glass-card border border-primary/15 rounded-xl shadow-2xl z-[200] overflow-hidden"
              style={{ top: popupPos.top, left: popupPos.left, boxShadow: '0 8px 40px rgba(0,0,0,0.5)' }}
              ref={ref}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-primary/10">
                <h4 className="font-display text-sm font-semibold text-foreground">Thông báo</h4>
                <div className="flex items-center gap-2">
                  {totalUnread > 0 && (
                    <button
                      onClick={handleClearAll}
                      className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded hover:bg-primary/10"
                      title="Đánh dấu tất cả đã đọc"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {notifications.length === 0 ? (
                <div className="py-8 text-center">
                  <Bell className="w-8 h-8 text-primary/15 mx-auto mb-2" />
                  <p className="text-xs font-body text-muted-foreground">Không có thông báo mới</p>
                </div>
              ) : (
                <div className="max-h-80 overflow-y-auto">
                  {notifications.slice(0, 20).map((n) => {
                    const Icon = NOTIF_ICONS[n.type] || Bell;
                    const color = NOTIF_COLORS[n.type] || 'text-primary';
                    const bg = NOTIF_BG[n.type] || 'bg-primary/10';
                    return (
                      <button
                        key={n.id}
                        onClick={() => handleItemClick(n)}
                        className={`w-full flex items-start gap-3 px-4 py-3 hover:bg-primary/5 transition-colors border-b border-primary/5 last:border-0 text-left ${!n.is_read ? 'bg-primary/[0.02]' : ''}`}
                      >
                        <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                          <Icon className={`w-4 h-4 ${color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-body leading-tight ${n.is_read ? 'text-muted-foreground' : 'text-foreground font-medium'}`}>
                            {n.title}
                          </p>
                          <p className="text-xs font-body text-muted-foreground mt-0.5 truncate">{n.body}</p>
                        </div>
                        <span className="text-[10px] font-body text-muted-foreground/60 flex-shrink-0 mt-0.5">
                          {formatTime(n.created_date)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="px-4 py-2 border-t border-primary/10">
                <button
                  onClick={() => { navigate('/settings?tab=notifications'); setOpen(false); }}
                  className="w-full text-center text-xs font-body text-primary/70 hover:text-primary transition-colors py-1"
                >
                  Xem tất cả thông báo →
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}