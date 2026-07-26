import { db } from '@/api/apiClient';

import React, { useState, useEffect, useRef, useMemo } from 'react';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Message, MessageAvatar, MessageContent, MessageHeader, MessageFooter } from '@/components/ui/message';
import { Bubble, BubbleContent } from '@/components/ui/bubble';
import { MessageScrollerProvider, MessageScroller, MessageScrollerViewport, MessageScrollerContent, MessageScrollerItem, MessageScrollerButton, useMessageScroller, useMessageScrollerScrollable } from '@/components/ui/message-scroller';
import { Send, ArrowLeft, ArrowDown, User, MessageCircle, Zap, Paperclip, FileText, Code, BookOpen, Archive, File, X, Download } from 'lucide-react';
import { useOnlineContext } from '@/components/layout/AppLayout';
import { toast } from 'sonner';
import { format, addHours } from 'date-fns';
import TeamConfirmBar from '@/components/messages/TeamConfirmBar';

const MAX_UPLOAD_SIZE = 5 * 1024 * 1024; // 5 MB

const FILE_ACCEPT = [
  'image/*',
  '.pdf', '.docx', '.odt', '.txt', '.md', '.rtf',
  '.py', '.js', '.ts', '.jsx', '.tsx', '.java', '.cpp', '.c', '.h',
  '.go', '.rs', '.rb', '.php', '.sql', '.sh', '.json', '.yaml', '.yml',
  '.toml', '.xml', '.html', '.css', '.scss', '.vue', '.svelte',
  '.ipynb',
  '.zip', '.tar', '.gz', '.tgz', '.bz2', '.xz', '.7z', '.rar',
  '.svg', '.bmp', '.tiff',
].join(',');

const CATEGORY_ICONS = {
  image: null, // rendered as <img> instead
  document: FileText,
  code: Code,
  notebook: BookOpen,
  archive: Archive,
  file: File,
};

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Render content with clickable links */
function LinkifiedText({ text }) {
  if (!text) return null;
  const urlRegex = /(https?:\/\/[^\s<]+)/g;
  const parts = text.split(urlRegex);
  const isUrl = (s) => { urlRegex.lastIndex = 0; return urlRegex.test(s); };
  return (
    <>
      {parts.map((part, i) =>
        isUrl(part) ? (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer"
            className="text-primary/80 hover:text-primary underline underline-offset-2 break-all">
            {part}
          </a>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

const ROLE_COLORS = {
  'Data': 'text-blue-300',
  'ML': 'text-primary',
  'Backend': 'text-purple-300',
  'All-rounder': 'text-yellow-300',
};

function ConversationItem({ match, profile, isSelected, unreadCount, isOnline, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all text-left relative group ${isSelected
        ? 'bg-primary/10 border border-primary/40'
        : 'border border-transparent hover:border-primary/20 hover:bg-primary/5'
        }`}
    >
      <div className="relative flex-shrink-0">
        <div className={`w-11 h-11 rounded-xl overflow-hidden flex items-center justify-center bg-muted/60 border ${isSelected ? 'border-primary/50' : 'border-primary/15'}`}>
          {profile?.profile_image
            ? <img src={profile.profile_image} alt="" className="w-full h-full object-cover" />
            : <User className="w-5 h-5 text-primary/40" />
          }
        </div>
        {isOnline && (
          <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-background" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`font-display font-bold text-sm truncate ${isSelected ? 'text-primary' : 'text-foreground'}`}>
          {profile?.display_name || 'Unknown'}
        </p>
        <p className={`text-[10px] font-body truncate mt-0.5 ${ROLE_COLORS[profile?.role] || 'text-muted-foreground'}`}>
          {profile?.role}{profile?.school ? ` — ${profile.school}` : ''}
        </p>
      </div>
      {unreadCount > 0 && (
        <span className="w-5 h-5 rounded-full bg-primary text-background text-[10px] font-display font-bold flex items-center justify-center flex-shrink-0">
          {unreadCount}
        </span>
      )}
    </button>
  );
}

function ChatBubble({ msg, isMe, senderProfile }) {
  const hasAttachment = !!msg.attachment_url;
  const isImage = msg.attachment_category === 'image';
  const Icon = CATEGORY_ICONS[msg.attachment_category] || File;

  return (
    <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
      <Message align={isMe ? 'end' : 'start'}>
        {!isMe && (
          <MessageAvatar>
            <Avatar className="w-7 h-7">
              {senderProfile?.profile_image
                ? <AvatarImage src={senderProfile.profile_image} alt="" />
                : <AvatarFallback className="bg-muted/50 text-primary/30"><User className="w-3 h-3" /></AvatarFallback>
              }
            </Avatar>
          </MessageAvatar>
        )}
        <MessageContent>
          {!isMe && (
            <MessageHeader className="text-[10px] px-1">
              {senderProfile?.display_name}
            </MessageHeader>
          )}

          {/* Text content */}
          {msg.content && (
            <Bubble variant="ghost" align={isMe ? 'end' : 'start'}>
              <BubbleContent className={`px-4 py-2.5 rounded-2xl text-sm font-body leading-relaxed ${isMe ? '!bg-[#1e391e] !border-[#1e391e]' : '!bg-[#0e1b12] !border-[#0e1b12]'}`}>
                <LinkifiedText text={msg.content} />
              </BubbleContent>
            </Bubble>
          )}

          {/* Attachment */}
          {hasAttachment && isImage && (
            <a href={msg.attachment_url} target="_blank" rel="noopener noreferrer"
              className={`block overflow-hidden rounded-xl border border-primary/15 max-w-[280px] ${isMe ? 'self-end' : 'self-start'}`}>
              <img src={msg.attachment_url} alt={msg.attachment_name || 'Image'}
                className="max-w-full max-h-[200px] object-cover" loading="lazy" />
            </a>
          )}
          {hasAttachment && !isImage && (
            <a href={msg.attachment_url} target="_blank" rel="noopener noreferrer"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors max-w-[280px] ${isMe
                ? 'bg-[#1e391e] border-[#1e391e] hover:bg-[#244524] self-end'
                : 'bg-[#0e1b12] border-[#0e1b12] hover:bg-[#132218]'
              }`}
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${isMe ? 'bg-primary/20' : 'bg-white/10'}`}>
                <Icon className={`w-4 h-4 ${isMe ? 'text-primary' : 'text-primary/70'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-body text-xs text-foreground truncate">{msg.attachment_name || 'File'}</p>
              </div>
              <Download className={`w-3.5 h-3.5 flex-shrink-0 ${isMe ? 'text-primary/60' : 'text-muted-foreground/60'}`} />
            </a>
          )}
        </MessageContent>
      </Message>
      <MessageFooter className={`text-[9px] text-muted-foreground/50 px-1 ${isMe ? 'justify-end' : 'pl-11'}`}>
        {format(addHours(new Date(msg.created_date), 7), 'HH:mm dd/MM')}
        {isMe && (
          <span className={`ml-1.5 ${msg.read_at ? 'text-primary' : msg.delivered_at ? 'text-muted-foreground/50' : 'text-muted-foreground/30'}`}>
            {msg.read_at ? 'Đã xem' : msg.delivered_at ? 'Đã nhận' : 'Đã gửi'}
          </span>
        )}
      </MessageFooter>
    </div>
  );
}

function ScrollToBottomButton() {
  return (
    <MessageScrollerButton
      direction="end"
      size="default"
      behavior="smooth"
      className="left-1/2 -translate-x-1/2 gap-2 px-4 py-2 rounded-full shadow-lg shadow-black/20 bg-background/95 backdrop-blur-sm"
    >
      <ArrowDown className="w-4 h-4" />
      <span className="font-body text-xs">Xuống tin nhắn mới nhất</span>
    </MessageScrollerButton>
  );
}

function AutoScrollHandler({ messages }) {
  const { scrollToEnd } = useMessageScroller();
  const { end: isAtBottom } = useMessageScrollerScrollable();
  const prevLenRef = useRef(messages.length);
  const initialLoadRef = useRef(true);

  useEffect(() => {
    // First time messages arrive (empty → populated): always scroll to bottom
    if (initialLoadRef.current && messages.length > 0) {
      initialLoadRef.current = false;
      // Wait for DOM to lay out the messages before scrolling
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          scrollToEnd({ behavior: 'auto' });
        });
      });
      return;
    }
    // Subsequent new messages: only scroll if user is at bottom
    if (messages.length > prevLenRef.current && isAtBottom) {
      scrollToEnd({ behavior: 'auto' });
    }
    prevLenRef.current = messages.length;
  }, [messages.length, isAtBottom]);

  return null;
}

function ChatArea({ match, currentUser, profileMap, isOnline, onBack }) {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');
  const [pendingAttachment, setPendingAttachment] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const otherEmail = match.user1_id === currentUser?.id ? match.user2_id : match.user1_id;
  const otherProfile = profileMap[otherEmail];

  const { data: messages } = useQuery({
    queryKey: ['messages', match.id],
    queryFn: () => db.entities.Message.filter({ match_id: match.id }, 'created_date'),
    initialData: [],
  });

  // Mark received messages as delivered and read when viewing
  useEffect(() => {
    const authHeaders = {
      'Content-Type': 'application/json',
      ...(localStorage.getItem('access_token') ? { Authorization: `Bearer ${localStorage.getItem('access_token')}` } : {}),
    };

    const markDelivered = async () => {
      const undelivered = messages.filter(m => m.receiver_id === currentUser?.id && !m.delivered_at);
      if (undelivered.length > 0) {
        try {
          await fetch(`${import.meta.env.VITE_API_BASE ?? ''}/api/messages/mark-delivered`, {
            method: 'POST', headers: authHeaders,
            body: JSON.stringify({ match_id: match.id }),
          });
          const now = new Date().toISOString();
          queryClient.setQueryData(['messages', match.id], (old = []) =>
            old.map(m => m.receiver_id === currentUser?.id && !m.delivered_at ? { ...m, delivered_at: now } : m)
          );
        } catch { /* ignore */ }
      }
    };

    const markRead = async () => {
      const unread = messages.filter(m => m.receiver_id === currentUser?.id && !m.is_read);
      if (unread.length > 0) {
        try {
          await fetch(`${import.meta.env.VITE_API_BASE ?? ''}/api/messages/mark-read`, {
            method: 'POST', headers: authHeaders,
            body: JSON.stringify({ match_id: match.id }),
          });
          const now = new Date().toISOString();
          queryClient.setQueryData(['messages', match.id], (old = []) =>
            old.map(m => m.receiver_id === currentUser?.id && !m.is_read ? { ...m, is_read: true, read_at: now, delivered_at: m.delivered_at || now } : m)
          );
          queryClient.setQueryData(['unreadMessages', currentUser?.id], (old = []) =>
            old.filter(m => m.match_id !== match.id)
          );
          queryClient.setQueryData(['unreadForDash', currentUser?.id], (old = []) =>
            old.filter(m => m.match_id !== match.id)
          );
        } catch { /* ignore */ }
      }
    };

    markDelivered();
    markRead();
  }, [messages, match.id, currentUser?.id, queryClient]);

  const sendMutation = useMutation({
    mutationFn: ({ content, attachment }) => db.entities.Message.create({
      match_id: match.id,
      sender_id: currentUser.id,
      receiver_id: otherEmail,
      content,
      attachment_url: attachment?.url || '',
      attachment_type: attachment?.type || '',
      attachment_name: attachment?.name || '',
      attachment_category: attachment?.category || '',
    }),
    onSuccess: (newMsg) => {
      // Push directly into cache — no polling, realtime handles the other side
      queryClient.setQueryData(['messages', match.id], (old = []) => {
        if (old.some(m => m.id === newMsg.id)) return old;
        return [...old, newMsg];
      });
      setMessage('');
      setPendingAttachment(null);
    },
  });

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (file.size > MAX_UPLOAD_SIZE) {
      toast.error(`Tệp quá lớn (${formatFileSize(file.size)}). Giới hạn tối đa 5 MB.`);
      return;
    }

    setUploading(true);
    try {
      const { file_url, file_category, error } = await db.integrations.Core.UploadFile({ file, bucket: 'uploads' });
      if (!file_url) {
        toast.error(error || 'Tải tệp thất bại');
        return;
      }
      setPendingAttachment({ url: file_url, type: file.type, name: file.name, category: file_category });
    } catch (err) {
      toast.error('Tải tệp thất bại: ' + (err?.message || 'Lỗi kết nối'));
    } finally {
      setUploading(false);
    }
  };

  const handlePaste = async (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) return;
        if (file.size > MAX_UPLOAD_SIZE) {
          toast.error(`Ảnh quá lớn (${formatFileSize(file.size)}). Giới hạn tối đa 5 MB.`);
          return;
        }
        setUploading(true);
        try {
          const { file_url, file_category, error } = await db.integrations.Core.UploadFile({ file, bucket: 'uploads' });
          if (!file_url) {
            toast.error(error || 'Tải ảnh thất bại');
            return;
          }
          setPendingAttachment({ url: file_url, type: file.type, name: file.name || 'pasted-image.png', category: file_category });
        } catch (err) {
          toast.error('Tải ảnh thất bại: ' + (err?.message || 'Lỗi kết nối'));
        } finally {
          setUploading(false);
        }
        return;
      }
    }
  };

  const handleSend = () => {
    const hasText = message.trim();
    const hasFile = pendingAttachment;
    if (!hasText && !hasFile) return;
    sendMutation.mutate({ content: message.trim(), attachment: pendingAttachment });
  };

  // Group messages by date
  const grouped = messages.reduce((acc, msg) => {
    const date = format(addHours(new Date(msg.created_date), 7), 'dd/MM/yyyy');
    if (!acc[date]) acc[date] = [];
    acc[date].push(msg);
    return acc;
  }, {});

  return (
    <div className="flex flex-col h-full bg-[hsl(150_20%_5%)]">
      {/* Chat header */}
      <div className="px-4 py-3 border-b border-primary/10 bg-background/40 flex items-center gap-3">
        {onBack && (
          <button onClick={onBack} className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors lg:hidden">
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}
        <div className="w-9 h-9 rounded-lg overflow-hidden border border-primary/25 bg-muted/50 flex-shrink-0">
          {otherProfile?.profile_image
            ? <img src={otherProfile.profile_image} alt="" className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center"><User className="w-4 h-4 text-primary/30" /></div>
          }
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-display font-bold text-sm text-foreground truncate">{otherProfile?.display_name}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <div className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-muted-foreground/30'}`} />
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

      {/* Messages with MessageScroller */}
      <MessageScrollerProvider defaultScrollPosition="end">
        <MessageScroller className="flex-1">
          <AutoScrollHandler messages={messages} />
          <MessageScrollerViewport>
            <MessageScrollerContent className="px-4 py-4 gap-8">
              {messages.length === 0 && (
                <div className="text-center py-12 space-y-2">
                  <Zap className="w-8 h-8 text-primary/15 mx-auto" />
                  <p className="font-body text-xs text-muted-foreground">Match thành công! Bắt đầu cuộc trò chuyện 👋</p>
                </div>
              )}
              {Object.entries(grouped).map(([date, msgs]) => (
                <div key={date} className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-primary/8" />
                    <span className="font-body text-[10px] text-muted-foreground/50">{date}</span>
                    <div className="flex-1 h-px bg-primary/8" />
                  </div>
                  {msgs.map(msg => (
                    <MessageScrollerItem key={msg.id} messageId={msg.id}>
                      <ChatBubble
                        msg={msg}
                        isMe={msg.sender_id === currentUser?.id}
                        senderProfile={profileMap[msg.sender_id]}
                      />
                    </MessageScrollerItem>
                  ))}
                </div>
              ))}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <ScrollToBottomButton />
        </MessageScroller>
      </MessageScrollerProvider>

      {/* Pending attachment preview */}
      {pendingAttachment && (
        <div className="px-4 py-2 border-t border-neutral-700 bg-background/40">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-neutral-800/50 border border-neutral-700">
            {pendingAttachment.category === 'image' ? (
              <img src={pendingAttachment.url} alt="" className="w-10 h-10 rounded object-cover flex-shrink-0" />
            ) : (
              <div className="w-10 h-10 rounded bg-primary/10 flex items-center justify-center flex-shrink-0">
                {(() => { const I = CATEGORY_ICONS[pendingAttachment.category] || File; return <I className="w-4 h-4 text-primary/60" />; })()}
              </div>
            )}
            <span className="text-xs font-body text-foreground truncate flex-1">{pendingAttachment.name}</span>
            <button onClick={() => setPendingAttachment(null)}
              className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="relative z-10 p-3 pb-safe border-t border-white/10 bg-background/60 backdrop-blur-md md:pb-3" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
        <div className="flex gap-2 items-center">
          <input ref={fileInputRef} type="file" accept={FILE_ACCEPT} className="hidden" onChange={handleFileSelect} />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex-shrink-0 w-10 h-10 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-neutral-800 rounded-xl disabled:opacity-50"
          >
            {uploading ? (
              <div className="w-4 h-4 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
            ) : (
              <Paperclip className="w-4 h-4" />
            )}
          </button>
          <Input
            value={message}
            onChange={e => setMessage(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
            onPaste={handlePaste}
            placeholder="Nhập tin nhắn..."
            className="font-body text-sm bg-black/30 !border-neutral-700 focus:!border-neutral-500 focus-visible:!ring-neutral-500/30 text-foreground placeholder:text-muted-foreground rounded-xl h-10"
          />
          <Button
            onClick={handleSend}
            disabled={(!message.trim() && !pendingAttachment) || sendMutation.isPending || uploading}
            size="icon"
            className="flex-shrink-0 w-10 h-10 bg-primary text-background hover:bg-primary/90 disabled:opacity-30 rounded-xl"
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
  const onlineUsers = useOnlineContext();

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => db.auth.me(),
  });

  const { data: matches } = useQuery({
    queryKey: ['matches', currentUser?.id],
    queryFn: async () => {
      const me = await db.auth.me();
      const [m1, m2] = await Promise.all([
        db.entities.Match.filter({ user1_id: me.id }),
        db.entities.Match.filter({ user2_id: me.id }),
      ]);
      return [...m1, ...m2];
    },
    initialData: [],
    enabled: !!currentUser,
  });

  const { data: unreadMessages } = useQuery({
    queryKey: ['unreadMessages', currentUser?.id],
    queryFn: async () => {
      const me = await db.auth.me();
      return db.entities.Message.filter({ receiver_id: me.id, is_read: false });
    },
    initialData: [],
    enabled: !!currentUser,
  });

  const { data: allProfiles } = useQuery({
    queryKey: ['allProfilesForMatch'],
    queryFn: () => db.entities.ContestantProfile.list(),
    initialData: [],
  });

  const profileMap = useMemo(() => {
    const map = {};
    allProfiles.forEach(p => { map[p.created_by] = p; });
    return map;
  }, [allProfiles]);

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
    <div className="flex" style={{ height: '100dvh' }}>
      {/* Sidebar */}
      <div className={`w-full lg:w-72 flex-col border-r border-primary/10 bg-[hsl(150_20%_5%)] ${selectedMatch ? 'hidden lg:flex' : 'flex'}`}>
        <div className="p-5 border-b border-primary/10">
          <h1 className="font-display font-bold text-sm tracking-wide text-primary">Tin nhắn</h1>
          <p className="font-body text-[10px] text-muted-foreground mt-0.5">
            {matches.length} kết nối — {unreadMessages.length} chưa đọc
          </p>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {matches.length === 0 && (
            <div className="text-center py-12 px-4">
              <MessageCircle className="w-10 h-10 text-primary/15 mx-auto mb-3" />
              <p className="font-body text-xs text-muted-foreground">Chưa có kết nối nào</p>
            </div>
          )}
          {matches.map(match => {
            const otherEmail = match.user1_id === currentUser?.id ? match.user2_id : match.user1_id;
            return (
              <ConversationItem
                key={match.id}
                match={match}
                profile={profileMap[otherEmail]}
                isSelected={selectedMatch?.id === match.id}
                unreadCount={unreadByMatch[match.id] || 0}
                isOnline={onlineUsers.has(otherEmail)}
                onClick={() => setSelectedMatch(match)}
              />
            );
          })}
        </div>
      </div>

      {/* Chat area */}
      <div className={`flex-1 flex flex-col bg-[hsl(150_20%_5%)] ${!selectedMatch ? 'hidden lg:flex' : 'flex'}`}>
        {selectedMatch ? (
          <ChatArea key={selectedMatch.id} match={selectedMatch} currentUser={currentUser} profileMap={profileMap} isOnline={onlineUsers.has(selectedMatch?.user1_id === currentUser?.id ? selectedMatch?.user2_id : selectedMatch?.user1_id)} onBack={() => setSelectedMatch(null)} />
        ) : (
          <div className="flex-1 flex items-center justify-center text-center p-8">
            <div>
              <MessageCircle className="w-12 h-12 text-primary/10 mx-auto mb-3" />
              <p className="font-display text-sm text-muted-foreground">Chọn cuộc trò chuyện</p>
              <p className="font-body text-xs text-muted-foreground/50 mt-1">hoặc bắt đầu từ trang Matches</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
