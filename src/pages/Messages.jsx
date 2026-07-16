import { db } from '@/api/base44Client';

import React, { useState, useEffect, useRef } from 'react';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send, ArrowLeft, User, MessageCircle, Zap, Smile } from 'lucide-react';
import { format, addHours } from 'date-fns';
import TeamConfirmBar from '@/components/messages/TeamConfirmBar';

const ROLE_COLORS = {
  'Data': 'text-blue-300',
  'ML': 'text-neon',
  'Backend': 'text-purple-300',
  'All-rounder': 'text-yellow-300',
};

function ConversationItem({ match, profile, isSelected, unreadCount, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all text-left relative group ${
        isSelected
          ? 'bg-neon/10 border border-neon/40'
          : 'border border-transparent hover:border-neon/20 hover:bg-neon/5'
      }`}
    >
      <div className="relative flex-shrink-0">
        <div className={`w-11 h-11 rounded-xl overflow-hidden flex items-center justify-center bg-muted/60 border ${isSelected ? 'border-neon/50' : 'border-neon/15'}`}>
          {profile?.profile_image
            ? <img src={profile.profile_image} alt="" className="w-full h-full object-cover" />
            : <User className="w-5 h-5 text-neon/40" />
          }
        </div>
        <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-neon border-2 border-background" />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`font-display font-bold text-sm truncate ${isSelected ? 'text-neon' : 'text-foreground'}`}>
          {profile?.display_name || 'Unknown'}
        </p>
        <p className={`text-[10px] font-body truncate mt-0.5 ${ROLE_COLORS[profile?.role] || 'text-muted-foreground'}`}>
          {profile?.role}{profile?.school ? ` — ${profile.school}` : ''}
        </p>
      </div>
      {unreadCount > 0 && (
        <span className="w-5 h-5 rounded-full bg-neon text-background text-[10px] font-display font-bold flex items-center justify-center flex-shrink-0">
          {unreadCount}
        </span>
      )}
    </button>
  );
}

function ChatBubble({ msg, isMe, senderProfile }) {
  return (
    <div className={`flex gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
      {!isMe && (
        <div className="w-7 h-7 rounded-lg overflow-hidden border border-neon/15 bg-muted/50 flex-shrink-0 mt-1">
          {senderProfile?.profile_image
            ? <img src={senderProfile.profile_image} alt="" className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center"><User className="w-3 h-3 text-neon/30" /></div>
          }
        </div>
      )}
      <div className={`max-w-[70%] ${isMe ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
        {!isMe && <p className="font-body text-[10px] text-muted-foreground px-1">{senderProfile?.display_name}</p>}
        <div className={`px-4 py-2.5 rounded-2xl text-sm font-body leading-relaxed ${
          isMe
            ? 'bg-neon/15 border border-neon/30 rounded-tr-sm text-foreground'
            : 'bg-white/6 border border-white/10 rounded-tl-sm text-foreground'
        }`}
          style={isMe ? { boxShadow: '0 0 12px rgba(49,209,162,0.08)' } : {}}
        >
          {msg.content}
        </div>
        <p className="font-body text-[9px] text-muted-foreground/50 px-1">
          {format(addHours(new Date(msg.created_date), 7), 'HH:mm dd/MM')}
        </p>
      </div>
    </div>
  );
}

function ChatArea({ match, currentUser, profileMap, onBack }) {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');
  const messagesEndRef = useRef(null);

  const otherEmail = match.user1_id === currentUser?.email ? match.user2_id : match.user1_id;
  const otherProfile = profileMap[otherEmail];

  const { data: messages } = useQuery({
    queryKey: ['messages', match.id],
    queryFn: () => db.entities.Message.filter({ match_id: match.id }, 'created_date'),
    initialData: [],
    refetchInterval: 3000,
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Mark received messages as read when viewing
  useEffect(() => {
    const markRead = async () => {
      const unread = messages.filter(m => m.receiver_id === currentUser?.email && !m.is_read);
      if (unread.length > 0) {
        await db.entities.Message.updateMany(
          { match_id: match.id, receiver_id: currentUser.email, is_read: false },
          { $set: { is_read: true } }
        );
        queryClient.invalidateQueries({ queryKey: ['unreadMessages'] });
        queryClient.invalidateQueries({ queryKey: ['messages', match.id] });
      }
    };
    markRead();
  }, [messages, match.id, currentUser?.email, queryClient]);

  const sendMutation = useMutation({
    mutationFn: (content) => db.entities.Message.create({
      match_id: match.id,
      sender_id: currentUser.email,
      receiver_id: otherEmail,
      content,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', match.id] });
      queryClient.invalidateQueries({ queryKey: ['unreadMessages'] });
      queryClient.invalidateQueries({ queryKey: ['unreadForDash'] });
      setMessage('');
    },
  });

  const handleSend = () => {
    if (!message.trim()) return;
    sendMutation.mutate(message.trim());
  };

  // Group messages by date
  const grouped = messages.reduce((acc, msg) => {
    const date = format(addHours(new Date(msg.created_date), 7), 'dd/MM/yyyy');
    if (!acc[date]) acc[date] = [];
    acc[date].push(msg);
    return acc;
  }, {});

  return (
    <div className="flex flex-col h-full">
      {/* Chat header */}
      <div className="px-4 py-3 border-b border-neon/10 bg-background/40 flex items-center gap-3">
        {onBack && (
          <button onClick={onBack} className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-neon/10 text-muted-foreground hover:text-neon transition-colors lg:hidden">
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}
        <div className="w-9 h-9 rounded-lg overflow-hidden border border-neon/25 bg-muted/50 flex-shrink-0">
          {otherProfile?.profile_image
            ? <img src={otherProfile.profile_image} alt="" className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center"><User className="w-4 h-4 text-neon/30" /></div>
          }
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-display font-bold text-sm text-foreground truncate">{otherProfile?.display_name}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <div className="w-1.5 h-1.5 rounded-full bg-neon animate-pulse" />
            <span className={`font-body text-[10px] ${ROLE_COLORS[otherProfile?.role] || 'text-muted-foreground'}`}>
              {otherProfile?.role}
            </span>
            {otherProfile?.school && (
              <span className="font-body text-[10px] text-muted-foreground">— {otherProfile.school}</span>
            )}
          </div>
        </div>
      </div>

      {/* Team confirmation bar */}
      <TeamConfirmBar match={match} currentUser={currentUser} otherProfile={otherProfile} />

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-12 space-y-2">
            <Zap className="w-8 h-8 text-neon/15 mx-auto" />
            <p className="font-body text-xs text-muted-foreground">Match thành công! Bắt đầu cuộc trò chuyện 👋</p>
          </div>
        )}
        {Object.entries(grouped).map(([date, msgs]) => (
          <div key={date} className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-neon/8" />
              <span className="font-body text-[10px] text-muted-foreground/50">{date}</span>
              <div className="flex-1 h-px bg-neon/8" />
            </div>
            {msgs.map(msg => (
              <ChatBubble
                key={msg.id}
                msg={msg}
                isMe={msg.sender_id === currentUser?.email}
                senderProfile={profileMap[msg.sender_id]}
              />
            ))}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 pb-safe border-t border-neon/10 bg-background/60 backdrop-blur-md md:pb-3" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
        <div className="flex gap-2 items-center">
          <Input
            value={message}
            onChange={e => setMessage(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Nhập tin nhắn..."
            className="font-body text-sm bg-black/30 border-neon/15 focus:border-neon/50 text-foreground placeholder:text-muted-foreground rounded-xl h-10"
          />
          <Button
            onClick={handleSend}
            disabled={!message.trim() || sendMutation.isPending}
            size="icon"
            className="flex-shrink-0 w-10 h-10 bg-neon text-background hover:bg-neon/90 disabled:opacity-30 rounded-xl"
            style={{ boxShadow: '0 0 12px rgba(49,209,162,0.35)' }}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function Messages() {
  const [selectedMatch, setSelectedMatch] = useState(null);

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => db.auth.me(),
  });

  const { data: matches } = useQuery({
    queryKey: ['matches', currentUser?.email],
    queryFn: async () => {
      const me = await db.auth.me();
      const [m1, m2] = await Promise.all([
        db.entities.Match.filter({ user1_id: me.email }),
        db.entities.Match.filter({ user2_id: me.email }),
      ]);
      return [...m1, ...m2];
    },
    initialData: [],
    enabled: !!currentUser,
  });

  const { data: unreadMessages } = useQuery({
    queryKey: ['unreadMessages', currentUser?.email],
    queryFn: async () => {
      const me = await db.auth.me();
      return db.entities.Message.filter({ receiver_id: me.email, is_read: false });
    },
    initialData: [],
    enabled: !!currentUser,
    refetchInterval: 5000,
  });

  const { data: allProfiles } = useQuery({
    queryKey: ['allProfilesForMatch'],
    queryFn: () => db.entities.ContestantProfile.list(),
    initialData: [],
  });

  const profileMap = {};
  allProfiles.forEach(p => { profileMap[p.created_by] = p; });

  const unreadByMatch = {};
  unreadMessages.forEach(msg => {
    unreadByMatch[msg.match_id] = (unreadByMatch[msg.match_id] || 0) + 1;
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const matchId = params.get('match');
    if (matchId && matches.length > 0) {
      const found = matches.find(m => m.id === matchId);
      if (found) setSelectedMatch(found);
    }
  }, [matches]);

  return (
    <div className="flex" style={{ height: 'calc(100dvh - 57px)' }}>
      {/* Sidebar */}
      <div className={`w-full lg:w-72 flex-col border-r border-neon/10 bg-background/20 ${selectedMatch ? 'hidden lg:flex' : 'flex'}`}>
        <div className="px-4 py-3 border-b border-neon/10">
          <h1 className="font-display font-bold text-sm tracking-wide neon-text">Tin nhắn</h1>
          <p className="font-body text-[10px] text-muted-foreground mt-0.5">
            {matches.length} kết nối — {unreadMessages.length} chưa đọc
          </p>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {matches.length === 0 && (
            <div className="text-center py-12 px-4">
              <MessageCircle className="w-10 h-10 text-neon/15 mx-auto mb-3" />
              <p className="font-body text-xs text-muted-foreground">Chưa có kết nối nào</p>
            </div>
          )}
          {matches.map(match => {
            const otherEmail = match.user1_id === currentUser?.email ? match.user2_id : match.user1_id;
            return (
              <ConversationItem
                key={match.id}
                match={match}
                profile={profileMap[otherEmail]}
                isSelected={selectedMatch?.id === match.id}
                unreadCount={unreadByMatch[match.id] || 0}
                onClick={() => setSelectedMatch(match)}
              />
            );
          })}
        </div>
      </div>

      {/* Chat area */}
      <div className={`flex-1 flex flex-col ${!selectedMatch ? 'hidden lg:flex' : 'flex'}`}>
        {selectedMatch ? (
          <ChatArea match={selectedMatch} currentUser={currentUser} profileMap={profileMap} onBack={() => setSelectedMatch(null)} />
        ) : (
          <div className="flex-1 flex items-center justify-center text-center p-8">
            <div>
              <MessageCircle className="w-12 h-12 text-neon/10 mx-auto mb-3" />
              <p className="font-display text-sm text-muted-foreground">Chọn cuộc trò chuyện</p>
              <p className="font-body text-xs text-muted-foreground/50 mt-1">hoặc bắt đầu từ trang Matches</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}