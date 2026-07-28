import { db, request } from '@/api/apiClient';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';

import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Message, MessageAvatar, MessageContent, MessageHeader, MessageFooter } from '@/components/ui/message';
import { Bubble, BubbleContent } from '@/components/ui/bubble';
import { MessageScrollerProvider, MessageScroller, MessageScrollerViewport, MessageScrollerContent, MessageScrollerItem, MessageScrollerButton, useMessageScroller } from '@/components/ui/message-scroller';
import { Send, ChevronLeft, ArrowDown, User, MessageCircle, Zap, Paperclip, FileText, Code, BookOpen, Archive, File, X, Download, MoreVertical, Users, Check, Loader2, Ban, UserMinus, Flag, Search, UserPlus, Reply, Trash2 } from 'lucide-react';
import { useOnlineContext } from '@/components/layout/AppLayout';
import { toast } from 'sonner';
import { formatDateTime, formatLastActive } from '@/lib/timeUtils';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem, ContextMenuSeparator } from '@/components/ui/context-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

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

function ConversationItem({ match, profile, currentUser, myProfile, profileMap, sentInvites, receivedInvites, isSelected, unreadCount, isOnline, onClick, onSendTeamInvite, onCancelTeamInvite, onAcceptTeamInvite }) {
  const otherEmail = match.user1_id === currentUser?.id ? match.user2_id : match.user1_id;
  const otherProfile = profileMap[otherEmail];
  const teammates = myProfile?.has_team && myProfile?.team_id && otherProfile?.team_id === myProfile?.team_id;
  const sentInvite = sentInvites.find(inv => inv.invitee_id === otherEmail);
  const receivedInvite = receivedInvites.find(inv => inv.inviter_id === otherEmail);
  const [cancelConfirmId, setCancelConfirmId] = useState(null);
  const [acceptDialog, setAcceptDialog] = useState(null);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <button
          onClick={onClick}
          className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all text-left relative group ${isSelected
            ? 'bg-primary/10 text-primary'
            : 'hover:bg-primary/5 hover:text-primary/80'
            }`}
        >
          <div className="relative flex-shrink-0">
            <div className={`w-11 h-11 rounded-xl overflow-hidden flex items-center justify-center bg-muted/60`}>
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
              {match.status === 'pending' && (
                <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded-full text-[8px] font-body font-medium bg-amber-500/15 text-amber-300">
                  Đang chờ
                </span>
              )}
              {match.status === 'unmatched' && (
                <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded-full text-[8px] font-body font-medium bg-neutral-500/15 text-neutral-400">
                  Đã hủy
                </span>
              )}
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
      </ContextMenuTrigger>
      <ContextMenuContent className="w-52">
        {teammates ? (
          <ContextMenuItem disabled className="text-primary">
            <Check className="w-4 h-4 mr-2" />
            Đồng đội ✓
          </ContextMenuItem>
        ) : sentInvite ? (
          <ContextMenuItem onClick={() => { setCancelConfirmId(sentInvite.id); }}>
            <Check className="w-4 h-4 mr-2" />
            <span>Đã gửi lời mời</span>
          </ContextMenuItem>
        ) : receivedInvite ? (
          <ContextMenuItem onClick={() => setAcceptDialog({ inviteId: receivedInvite.id, teamId: receivedInvite.team_id })}>
            <Users className="w-4 h-4 mr-2" />
            Đồng ý vào đội
          </ContextMenuItem>
        ) : (
          <ContextMenuItem onClick={() => {
            if (!myProfile?.has_team || !myProfile?.team_id) {
              toast.error('Bạn chưa có đội. Hãy vào phần Lập đội để tạo đội trước.');
              return;
            }
            if (!otherProfile?.email) {
              toast.error('Không thể gửi lời mời — thiếu thông tin email');
              return;
            }
            onSendTeamInvite(otherProfile.email);
          }}>
            <UserPlus className="w-4 h-4 mr-2" />
            Mời vào đội
          </ContextMenuItem>
        )}
        <ContextMenuSeparator />
        <ContextMenuItem onClick={onClick} className="text-foreground">
          <UserMinus className="w-4 h-4 mr-2" />
          {match.status === 'pending' ? 'Đang chờ kết nối' : 'Hủy kết nối'}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={onClick} className="text-red-400">
          <Ban className="w-4 h-4 mr-2" />
          Chặn
        </ContextMenuItem>
        <ContextMenuItem onClick={onClick} className="text-red-400">
          <Flag className="w-4 h-4 mr-2" />
          Báo cáo
        </ContextMenuItem>
      </ContextMenuContent>

      {/* Cancel invite confirmation dialog */}
      <AlertDialog open={!!cancelConfirmId} onOpenChange={() => setCancelConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hủy lời mời?</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc muốn hủy lời mời vào đội đã gửi đến người này?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Không</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (cancelConfirmId) onCancelTeamInvite(cancelConfirmId); setCancelConfirmId(null); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Hủy lời mời
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Accept invite disclaimer dialog */}
      <AlertDialog open={!!acceptDialog} onOpenChange={() => setAcceptDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Đồng ý vào đội?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>Sau khi vào đội, việc rời đội sẽ cần sự đồng ý của thành viên còn lại.</p>
              <p>Nếu có vấn đề phát sinh, bạn có thể báo cáo với ban tổ chức.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (acceptDialog) onAcceptTeamInvite(acceptDialog.inviteId, acceptDialog.teamId); setAcceptDialog(null); }} className="bg-primary text-background hover:bg-primary/90">
              Đồng ý
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ContextMenu>
  );
}

function ChatBubble({ msg, isMe, senderProfile, showHeader, showFooter, showAvatar, onDelete, onReply, messageMap }) {
  const hasAttachment = !!msg.attachment_url;
  const isImage = msg.attachment_category === 'image';
  const Icon = CATEGORY_ICONS[msg.attachment_category] || File;
  const { scrollToMessage } = useMessageScroller();

  const isFirstInGroup = showHeader;
  const isLastInGroup = showFooter;
  // Square off the connecting corners between merged bubbles.
  // For sender (right side): the right side connects → square right corners.
  // For recipient (left side): the left side connects → square left corners.
  const bubbleRadius = isMe
    ? isFirstInGroup && isLastInGroup
      ? 'rounded-2xl'
      : isFirstInGroup
        ? 'rounded-tl-2xl rounded-tr-2xl rounded-bl-2xl rounded-br-[6px]'
        : isLastInGroup
          ? 'rounded-tl-2xl rounded-tr-[6px] rounded-bl-2xl rounded-br-2xl'
          : 'rounded-tl-2xl rounded-tr-[6px] rounded-bl-2xl rounded-br-[6px]'
    : isFirstInGroup && isLastInGroup
      ? 'rounded-2xl'
      : isFirstInGroup
        ? 'rounded-tl-2xl rounded-bl-[6px] rounded-tr-2xl rounded-br-2xl'
        : isLastInGroup
          ? 'rounded-tl-[6px] rounded-bl-2xl rounded-tr-2xl rounded-br-2xl'
          : 'rounded-tl-[6px] rounded-bl-[6px] rounded-tr-2xl rounded-br-2xl';

  // ── Deleted message placeholder ──────────────────────────────────
  if (msg.is_deleted) {
    return (
      <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
        <Message align={isMe ? 'end' : 'start'}>
          {!isMe && showAvatar ? (
            <MessageAvatar>
              <Avatar className="w-7 h-7">
                {senderProfile?.profile_image
                  ? <AvatarImage src={senderProfile.profile_image} alt="" />
                  : <AvatarFallback className="bg-muted/50 text-primary/30"><User className="w-3 h-3" /></AvatarFallback>
                }
              </Avatar>
            </MessageAvatar>
          ) : !isMe ? (
            <div className="min-w-8 shrink-0" />
          ) : null}
          <MessageContent className="gap-1">
            <Bubble variant="ghost" align={isMe ? 'end' : 'start'}>
              <BubbleContent className={`rounded-2xl px-4 py-2.5 text-xs font-body italic text-muted-foreground/40 bg-transparent border border-dashed border-muted-foreground/15`}>
                Tin nhắn đã được gỡ
              </BubbleContent>
            </Bubble>
          </MessageContent>
        </Message>
        {showFooter && (
          <MessageFooter className={`text-[9px] text-muted-foreground/50 px-1 mt-0.5 ${isMe ? 'justify-end' : 'pl-11'}`}>
            {formatDateTime(msg.created_date, 'HH:mm')}
          </MessageFooter>
        )}
      </div>
    );
  }

  // ── Action buttons (appear on hover) ──────────────────────────────
  const actions = isMe ? (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="p-1 rounded-lg hover:bg-primary/10 text-muted-foreground/40 hover:text-muted-foreground transition-colors"
        >
          <MoreVertical className="w-3.5 h-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-32">
        <DropdownMenuItem onClick={() => onDelete?.(msg.id)} className="text-red-400 hover:text-red-300 hover:bg-red-500/10 text-xs">
          <Trash2 className="w-3.5 h-3.5 mr-2" />
          Xóa
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ) : (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onReply?.(msg); }}
      className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground/40 hover:text-primary transition-colors"
    >
      <Reply className="w-3.5 h-3.5" />
    </button>
  );

  return (
    <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
      <div className={`flex flex-col min-w-0 ${isMe ? 'self-end' : 'self-start'}`}>
        <Message align={isMe ? 'end' : 'start'}>
          {!isMe && showAvatar ? (
            <MessageAvatar>
              <Avatar className="w-7 h-7">
                {senderProfile?.profile_image
                  ? <AvatarImage src={senderProfile.profile_image} alt="" />
                  : <AvatarFallback className="bg-muted/50 text-primary/30"><User className="w-3 h-3" /></AvatarFallback>
                }
              </Avatar>
            </MessageAvatar>
          ) : !isMe ? (
            <div className="min-w-8 shrink-0" />
          ) : null}
          <MessageContent className="gap-1">
            {!isMe && showHeader && (
              <MessageHeader className="text-[10px] px-1 pb-0">
                {senderProfile?.display_name}
              </MessageHeader>
            )}

            {/* Reply context — click to scroll to replied message */}
            {msg.reply_to_id && messageMap?.[msg.reply_to_id] && (
              <button
                type="button"
                onClick={() => scrollToMessage?.(msg.reply_to_id, { behavior: 'smooth', align: 'start' })}
                className={`flex items-stretch gap-2 max-w-[280px] mb-0.5 ${isMe ? 'self-end flex-row-reverse text-right' : 'self-start text-left'}`}
              >
                <div className={`w-[3px] rounded-full flex-shrink-0 bg-primary/30`} />
                <div className="min-w-0 py-0.5">
                  <p className="text-[10px] font-body font-medium text-primary/60 truncate leading-tight">
                    {messageMap[msg.reply_to_id].sender_id === msg.sender_id ? 'Đã trả lời' : 'Trả lời'}
                  </p>
                  <p className="text-[10px] font-body text-muted-foreground/40 truncate leading-tight">
                    {messageMap[msg.reply_to_id].is_deleted
                      ? 'Tin nhắn đã được gỡ'
                      : (messageMap[msg.reply_to_id].content || (messageMap[msg.reply_to_id].attachment_url ? 'Hình ảnh' : ''))
                    }
                  </p>
                </div>
              </button>
            )}

            {/* Bubble content — wrapped as relative anchor for action buttons */}
            <div className={`relative ${isMe ? 'self-end' : 'self-start'}`}>
              {/* Text content */}
              {msg.content && (
                <Bubble variant="ghost" align={isMe ? 'end' : 'start'}>
                  <BubbleContent className={`px-4 py-2.5 ${bubbleRadius} text-sm font-body leading-relaxed ${isMe ? '!bg-[#1e391e] !border-[#1e391e]' : '!bg-[#0e1b12] !border-[#0e1b12]'}`}>
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

              {/* Action buttons — centered on bubble content only (outside header/reply context) */}
              {!msg.is_deleted && (
                <div className={`absolute top-1/2 -translate-y-1/2 opacity-0 group-hover/message:opacity-100 transition-opacity duration-150 z-10 ${isMe ? 'right-full mr-2' : 'left-full ml-2'}`}>
                  {isMe ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="p-1 rounded-lg hover:bg-primary/10 text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                        >
                          <MoreVertical className="w-3.5 h-3.5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align={isMe ? 'start' : 'end'} className="min-w-32">
                        <DropdownMenuItem onClick={() => onDelete?.(msg.id)} className="text-red-400 hover:text-red-300 hover:bg-red-500/10 text-xs">
                          <Trash2 className="w-3.5 h-3.5 mr-2" />
                          Xóa
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onReply?.(msg); }}
                      className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground/40 hover:text-primary transition-colors"
                    >
                      <Reply className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>
          </MessageContent>
        </Message>
      </div>
      {showFooter && (
        <MessageFooter className={`text-[9px] text-muted-foreground/50 px-1 mt-0.5 ${isMe ? 'justify-end' : 'pl-11'}`}>
          {formatDateTime(msg.created_date, 'HH:mm')}
          {isMe && (
            <span className={`ml-1.5 ${msg.read_at ? 'text-primary' : msg.delivered_at ? 'text-muted-foreground/50' : 'text-muted-foreground/30'}`}>
              {msg.read_at ? 'Đã xem' : msg.delivered_at ? 'Đã nhận' : 'Đã gửi'}
            </span>
          )}
        </MessageFooter>
      )}
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

function AutoScrollHandler({ messages, viewportRef }) {
  const { scrollToEnd } = useMessageScroller();
  const prevLenRef = useRef(messages.length);
  const initialLoadRef = useRef(true);

  const isNearBottom = useCallback(() => {
    const el = viewportRef?.current;
    if (!el) return true;
    const SCROLL_THRESHOLD = 200; // px from bottom
    return el.scrollHeight - el.scrollTop - el.clientHeight < SCROLL_THRESHOLD;
  }, [viewportRef]);

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
    // Subsequent new messages: only scroll if user is near bottom (within 200px)
    if (messages.length > prevLenRef.current && isNearBottom()) {
      scrollToEnd({ behavior: 'auto' });
    }
    prevLenRef.current = messages.length;
  }, [messages.length, isNearBottom]);

  return null;
}

function ChatArea({ match, currentUser, myProfile, profileMap, sentInvites, receivedInvites, isOnline, onBack, onSendTeamInvite, onCancelTeamInvite, onAcceptTeamInvite }) {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');
  const [pendingAttachment, setPendingAttachment] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [blockConfirmOpen, setBlockConfirmOpen] = useState(false);
  const [unmatchConfirmOpen, setUnmatchConfirmOpen] = useState(false);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportAttachment, setReportAttachment] = useState(null);
  const [reportUploading, setReportUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cancelInviteOpen, setCancelInviteOpen] = useState(false);
  const [acceptInviteDialogOpen, setAcceptInviteDialogOpen] = useState(false);
  const fileInputRef = useRef(null);
  const reportFileInputRef = useRef(null);
  const viewportRef = useRef(null);

  const otherEmail = match.user1_id === currentUser?.id ? match.user2_id : match.user1_id;
  const otherProfile = profileMap[otherEmail];
  const isPending = match.status === 'pending';
  const isUnmatched = match.status === 'unmatched';
  const isInitiator = match.user1_id === currentUser?.id;

  const { data: messages } = useQuery({
    queryKey: ['messages', match.id],
    queryFn: () => db.entities.Message.filter({ match_id: match.id }, 'created_date'),
    initialData: [],
    staleTime: 2000,
    refetchInterval: 3000,
  });

  const messageMap = useMemo(() => {
    const map = {};
    (messages || []).forEach(m => { map[m.id] = m; });
    return map;
  }, [messages]);

  const sentCount = useMemo(() => {
    if (!messages) return 0;
    return messages.filter(m => m.sender_id === currentUser?.id).length;
  }, [messages, currentUser?.id]);

  const teammates = myProfile?.has_team && myProfile?.team_id && otherProfile?.team_id === myProfile?.team_id;
  const sentInvite = sentInvites.find(inv => inv.invitee_id === otherEmail);
  const receivedInvite = receivedInvites.find(inv => inv.inviter_id === otherEmail);

  // Check if either user has blocked the other
  const { data: blockedUsers } = useQuery({
    queryKey: ['blockedUsers', currentUser?.id],
    queryFn: () => db.block.list(),
    initialData: [],
    enabled: !!currentUser?.id,
  });
  const isBlockedByMe = blockedUsers.some(b => b.blocked_id === otherEmail);

  const { data: blockedCheck } = useQuery({
    queryKey: ['blockedBy', otherEmail, currentUser?.id],
    queryFn: () => db.block.checkBlockedBy(otherEmail),
    enabled: !!otherEmail && !!currentUser?.id,
  });
  const isBlockedByThem = blockedCheck?.blocked === true;

  const handleBlock = async () => {
    try {
      await db.block.block(otherEmail);
      queryClient.invalidateQueries({ queryKey: ['matches'] });
      queryClient.invalidateQueries({ queryKey: ['blockedUsers'] });
      queryClient.invalidateQueries({ queryKey: ['blockedBy'] });
      queryClient.invalidateQueries({ queryKey: ['blockedUsers', currentUser?.id] });
      setBlockConfirmOpen(false);
      toast.success('Đã chặn người dùng');
    } catch (err) {
      toast.error('Lỗi: ' + (err?.message || 'Không xác định'));
    }
  };

  const handleUnblock = async () => {
    try {
      await db.block.unblock(otherEmail);
      queryClient.invalidateQueries({ queryKey: ['blockedUsers'] });
      toast.success('Đã bỏ chặn người dùng');
    } catch (err) {
      toast.error('Lỗi: ' + (err?.message || 'Không xác định'));
    }
  };

  const handleUnmatch = async () => {
    try {
      await db.entities.Match.delete(match.id);
      queryClient.invalidateQueries({ queryKey: ['matches'] });
      queryClient.invalidateQueries({ queryKey: ['match', match.id] });
      setUnmatchConfirmOpen(false);
      toast.success('Đã hủy kết nối');
    } catch (err) {
      toast.error('Lỗi: ' + (err?.message || 'Không xác định'));
    }
  };

  const handleReportAttachmentSelect = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (file.size > MAX_UPLOAD_SIZE) {
      toast.error(`Tệp quá lớn (${formatFileSize(file.size)}). Giới hạn tối đa 5 MB.`);
      return;
    }

    setReportUploading(true);
    try {
      const { file_url, file_category, error } = await db.integrations.Core.UploadFile({ file, bucket: 'uploads' });
      if (!file_url) {
        toast.error(error || 'Tải tệp thất bại');
        return;
      }
      setReportAttachment({ url: file_url, name: file.name, type: file.type, category: file_category });
    } catch (err) {
      toast.error('Tải tệp thất bại: ' + (err?.message || 'Lỗi kết nối'));
    } finally {
      setReportUploading(false);
    }
  };

  const handleReport = async () => {
    if (!reportReason.trim()) {
      toast.error('Vui lòng nhập lý do báo cáo');
      return;
    }
    setSubmitting(true);
    try {
      await db.report(otherEmail, match.id, reportReason.trim(), {
        url: reportAttachment?.url,
        name: reportAttachment?.name,
        type: reportAttachment?.type,
      });
      // Report auto-blocks on the backend, so refresh block status
      queryClient.invalidateQueries({ queryKey: ['blockedUsers'] });
      queryClient.invalidateQueries({ queryKey: ['blockedBy'] });
      queryClient.invalidateQueries({ queryKey: ['blockedUsers', currentUser?.id] });
      setReportDialogOpen(false);
      setReportReason('');
      setReportAttachment(null);
      toast.success('Đã gửi báo cáo! Cảm ơn bạn đã đóng góp.');
    } catch (err) {
      toast.error('Lỗi: ' + (err?.message || 'Không xác định'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleAcceptPending = async () => {
    try {
      await db.entities.Match.update(match.id, { status: 'matched' });
      queryClient.invalidateQueries({ queryKey: ['match', match.id] });
      queryClient.invalidateQueries({ queryKey: ['matches'] });
      toast.success('Đã kết nối thành công!');
    } catch (err) {
      toast.error('Lỗi: ' + (err?.message || 'Không xác định'));
    }
  };

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

  // ── Delete own message ──────────────────────────────────────────
  const deleteMessageMutation = useMutation({
    mutationFn: (messageId) => db.entities.Message.delete(messageId),
    onSuccess: (_, messageId) => {
      // Update cache locally — backend soft-deletes and clears content
      queryClient.setQueryData(['messages', match.id], (old = []) =>
        old.map(m => m.id === messageId
          ? { ...m, is_deleted: true, content: '', attachment_url: '', attachment_type: '', attachment_name: '', attachment_category: '' }
          : m
        )
      );
    },
    onError: (err) => toast.error('Không thể xóa tin nhắn: ' + (err?.message || 'Lỗi kết nối')),
  });

  const sendMutation = useMutation({
    mutationFn: ({ content, attachment, replyToId }) => db.entities.Message.create({
      match_id: match.id,
      sender_id: currentUser.id,
      receiver_id: otherEmail,
      content,
      attachment_url: attachment?.url || '',
      attachment_type: attachment?.type || '',
      attachment_name: attachment?.name || '',
      attachment_category: attachment?.category || '',
      reply_to_id: replyToId || '',
    }),
    onSuccess: (newMsg) => {
      // Push directly into cache — no polling, realtime handles the other side
      queryClient.setQueryData(['messages', match.id], (old = []) => {
        if (old.some(m => m.id === newMsg.id)) return old;
        return [...old, newMsg];
      });
      setMessage('');
      setPendingAttachment(null);
      setReplyingTo(null);
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
    sendMutation.mutate({ content: message.trim(), attachment: pendingAttachment, replyToId: replyingTo?.id || '' });
  };

  return (
    <div className="flex flex-col h-full bg-[hsl(150_20%_5%)]">
      {/* Chat header */}
      <div className="px-4 py-3 border-b border-primary/10 bg-background/40 flex items-center gap-3">
        {onBack && (
          <button type="button" onClick={onBack} className="flex-shrink-0 -ml-1 p-2 flex items-center justify-center rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors">
            <ChevronLeft className="w-5 h-5 pointer-events-none" />
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
          <p className="font-body text-[10px] text-muted-foreground mt-0.5">
            {isOnline ? 'Đang hoạt động' : formatLastActive(otherProfile?.last_active_at)}
          </p>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors">
              <MoreVertical className="w-4 h-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            {teammates ? (
              <DropdownMenuItem disabled className="text-primary">
                <Check className="w-4 h-4" />
                Đồng đội ✓
              </DropdownMenuItem>
            ) : sentInvite ? (
              <DropdownMenuItem onClick={() => setCancelInviteOpen(true)}>
                <Check className="w-4 h-4" />
                <span>Đã gửi lời mời</span>
              </DropdownMenuItem>
            ) : receivedInvite ? (
              <DropdownMenuItem onClick={() => setAcceptInviteDialogOpen(true)}>
                <Users className="w-4 h-4" />
                Đồng ý vào đội
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={() => {
                if (!myProfile?.has_team || !myProfile?.team_id) {
                  toast.error('Bạn chưa có đội. Hãy vào phần Lập đội để tạo đội trước.');
                  return;
                }
                if (!otherProfile?.email) {
                  toast.error('Không thể gửi lời mời — thiếu thông tin email');
                  return;
                }
                onSendTeamInvite(otherProfile.email);
              }}>
                <UserPlus className="w-4 h-4" />
                Mời vào đội
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setUnmatchConfirmOpen(true)} className="text-foreground">
              <UserMinus className="w-4 h-4" />
              {isPending ? 'Đang chờ kết nối' : 'Hủy kết nối'}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={isBlockedByMe ? handleUnblock : () => setBlockConfirmOpen(true)} className="text-red-400 hover:text-red-300 hover:bg-red-500/10">
              <Ban className="w-4 h-4" />
              {isBlockedByMe ? 'Bỏ chặn' : 'Chặn'}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setReportDialogOpen(true)} className="text-red-400 hover:text-red-300 hover:bg-red-500/10">
              <Flag className="w-4 h-4" />
              Báo cáo
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Pending match banner */}
      {isPending && (
        <div className="px-4 py-3 bg-amber-500/10 border-b border-amber-500/20">
          {isInitiator ? (
            <div className="text-center">
              <p className="font-body text-xs text-amber-300">
                Đã gửi {sentCount}/3 tin nhắn
              </p>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <p className="font-body text-xs text-amber-300">Người này muốn kết nối với bạn</p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs border-green-500/30 text-green-400 hover:bg-green-500/10"
                  onClick={handleAcceptPending}
                >
                  Kết nối
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs border-red-500/30 text-red-400 hover:bg-red-500/10"
                  onClick={() => setBlockConfirmOpen(true)}
                >
                  Chặn
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Team invite banner */}
      {receivedInvite && !isPending && !isUnmatched && !teammates && (
        <div className="px-4 py-3 bg-muted/30 border-b border-primary/10">
          <div className="flex items-center justify-between gap-3">
            <p className="font-body text-xs text-primary">{otherProfile?.display_name || 'Người này'} muốn mời bạn vào đội</p>
            <div className="flex gap-2">
              <Button
                size="sm"
                className="h-8 text-xs bg-primary text-background hover:bg-primary/90"
                onClick={() => setAcceptInviteDialogOpen(true)}
              >
                Đồng ý
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs border-primary/30 text-muted-foreground hover:bg-primary/10 hover:text-muted-foreground"
                onClick={() => { if (receivedInvite) onCancelTeamInvite(receivedInvite.id); }}
              >
                Từ chối
              </Button>
            </div>
          </div>
        </div>
      )}
      {sentInvite && !isPending && !isUnmatched && !teammates && (
        <div className="px-4 py-3 bg-muted/30 border-b border-primary/10">
          <div className="flex items-center justify-between gap-3">
            <p className="font-body text-xs text-muted-foreground">
              <Check className="w-3 h-3 inline mr-1 text-primary" />
              Đã gửi lời mời vào đội — đang chờ phản hồi
            </p>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[10px] border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => setCancelInviteOpen(true)}
            >
              Hủy
            </Button>
          </div>
        </div>
      )}

      {/* Messages with MessageScroller */}
      <MessageScrollerProvider defaultScrollPosition="end">
        <MessageScroller className="flex-1">
          <AutoScrollHandler messages={messages} viewportRef={viewportRef} />
          <MessageScrollerViewport ref={viewportRef}>
            <MessageScrollerContent className="px-4 py-4 !gap-0">
              {messages.length === 0 && (
                <div className="text-center py-12 space-y-2">
                  <Zap className="w-8 h-8 text-primary/15 mx-auto" />
                  <p className="font-body text-xs text-muted-foreground">
                    {isPending
                      ? isInitiator
                        ? 'Đã gửi lời mời kết nối! Hãy gửi tin nhắn để giới thiệu bản thân.'
                        : 'Người này muốn kết nối với bạn'
                      : 'Match thành công! Bắt đầu cuộc trò chuyện 👋'}
                  </p>
                </div>
              )}
              {messages.map((msg, i) => {
                const prevSender = i > 0 ? messages[i - 1].sender_id : null;
                const nextSender = i < messages.length - 1 ? messages[i + 1].sender_id : null;
                const isFirstInGroup = !prevSender || prevSender !== msg.sender_id;
                const isLastInGroup = !nextSender || nextSender !== msg.sender_id;
                return (
                  <MessageScrollerItem key={msg.id} messageId={msg.id}>
                    <div className={isFirstInGroup ? '' : 'mt-0.5'}>
                      <ChatBubble
                        msg={msg}
                        isMe={msg.sender_id === currentUser?.id}
                        senderProfile={profileMap[msg.sender_id]}
                        showHeader={isFirstInGroup}
                        showAvatar={isLastInGroup}
                        showFooter={isLastInGroup}
                        onDelete={(id) => deleteMessageMutation.mutate(id)}
                        onReply={(m) => setReplyingTo(m)}
                        messageMap={messageMap}
                      />
                    </div>
                  </MessageScrollerItem>
                );
              })}
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

      {/* Input — replaced with blocked notice or pending notice */}
      {isPending && !isInitiator ? (
        <div className="p-3 pb-safe border-t border-amber-500/20 bg-amber-500/5" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
          <div className="flex items-center justify-center gap-2 py-2">
            <p className="font-body text-sm text-amber-400">Kết nối để nhắn tin</p>
          </div>
        </div>
      ) : isPending && isInitiator && sentCount >= 3 ? (
        <div className="p-3 pb-safe border-t border-amber-500/20 bg-amber-500/5" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
          <div className="flex items-center justify-center gap-2 py-2">
            <p className="font-body text-sm text-amber-400">Đã hết lượt nhắn tin, chờ đối phương kết nối</p>
          </div>
        </div>
      ) : isBlockedByMe ? (
        <div className="p-3 pb-safe border-t border-red-500/20 bg-red-500/5" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
          <div className="flex items-center justify-center gap-2 py-2">
            <Ban className="w-4 h-4 text-red-400" />
            <p className="font-body text-sm text-red-400">Bạn đã chặn người dùng này</p>
          </div>
        </div>
      ) : isUnmatched && sentCount >= 3 ? (
        <div className="p-3 pb-safe border-t border-neutral-500/20 bg-neutral-500/5" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
          <div className="flex items-center justify-center gap-2 py-2">
            <p className="font-body text-sm text-neutral-400">Đã hủy kết nối — không thể gửi thêm tin nhắn</p>
          </div>
        </div>
      ) : isBlockedByThem ? (
        <div className="p-3 pb-safe border-t border-red-500/20 bg-red-500/5" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
          <div className="flex items-center justify-center gap-2 py-2">
            <Ban className="w-4 h-4 text-red-400" />
            <p className="font-body text-sm text-red-400">Người dùng này đã chặn bạn</p>
          </div>
        </div>
      ) : (
        <div className="relative z-10 p-3 pb-safe border-t border-white/10 bg-background/60 backdrop-blur-md md:pb-3" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
          {/* Reply preview */}
          {replyingTo && (
            <div className="flex items-center gap-3 mb-2 px-3 py-2 rounded-lg bg-neutral-800/60 border border-neutral-700/50">
              <div className="w-[3px] h-8 rounded-full bg-primary/40 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-body font-medium text-primary/60 truncate">
                  {replyingTo.sender_id === currentUser?.id ? 'Đang trả lời chính mình' : `Đang trả lời ${profileMap[replyingTo.sender_id]?.display_name || 'ai đó'}`}
                </p>
                <p className="text-[11px] font-body text-muted-foreground/50 truncate">
                  {replyingTo.is_deleted ? 'Tin nhắn đã được gỡ' : (replyingTo.content || (replyingTo.attachment_url ? 'Hình ảnh' : ''))}
                </p>
              </div>
              <button onClick={() => setReplyingTo(null)}
                className="p-1 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
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
              className="font-body text-sm bg-black/30 !border-white/10 focus:!border-white/30 focus-visible:!ring-white/20 text-foreground placeholder:text-muted-foreground rounded-xl h-10"
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
      )}

      {/* Block confirmation dialog */}
      <AlertDialog open={blockConfirmOpen} onOpenChange={setBlockConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Chặn người dùng này?</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn sẽ không thể nhắn tin với người này nữa. Bạn có thể bỏ chặn sau trong cài đặt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={handleBlock} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Chặn
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unmatch confirmation dialog */}
      <AlertDialog open={unmatchConfirmOpen} onOpenChange={setUnmatchConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hủy kết nối?</AlertDialogTitle>
            <AlertDialogDescription>
              Cuộc trò chuyện và kết nối sẽ bị xóa. Hành động này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={handleUnmatch} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Xác nhận
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel invite dialog */}
      <AlertDialog open={cancelInviteOpen} onOpenChange={setCancelInviteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hủy lời mời?</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc muốn hủy lời mời vào đội đã gửi đến người này?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Không</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (sentInvite) onCancelTeamInvite(sentInvite.id); setCancelInviteOpen(false); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Hủy lời mời
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Accept invite disclaimer dialog */}
      <AlertDialog open={acceptInviteDialogOpen} onOpenChange={setAcceptInviteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Đồng ý vào đội?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>Sau khi vào đội, việc rời đội sẽ cần sự đồng ý của thành viên còn lại.</p>
              <p>Nếu có vấn đề phát sinh, bạn có thể báo cáo với ban tổ chức.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (receivedInvite) onAcceptTeamInvite(receivedInvite.id, receivedInvite.team_id); setAcceptInviteDialogOpen(false); }} className="bg-primary text-background hover:bg-primary/90">
              Đồng ý
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Report dialog */}
      <Dialog open={reportDialogOpen} onOpenChange={(open) => { if (!open) { setReportReason(''); setReportAttachment(null); } setReportDialogOpen(open); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Báo cáo người dùng</DialogTitle>
            <DialogDescription>
              Mô tả lý do bạn báo cáo người dùng này. Báo cáo của bạn sẽ được xem xét bởi quản trị viên.
            </DialogDescription>
          </DialogHeader>
          <textarea
            value={reportReason}
            onChange={e => setReportReason(e.target.value)}
            placeholder="Nhập lý do báo cáo..."
            className="w-full min-h-[100px] p-3 rounded-lg border border-primary/20 bg-background/60 text-sm font-body text-foreground placeholder:text-muted-foreground/50 resize-none focus:outline-none focus:border-primary/40"
          />

          {/* File attachment area */}
          <input ref={reportFileInputRef} type="file" accept={FILE_ACCEPT} className="hidden" onChange={handleReportAttachmentSelect} />
          {reportAttachment ? (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/10 text-sm">
              <File className="w-4 h-4 text-primary/60 flex-shrink-0" />
              <span className="flex-1 truncate text-foreground">{reportAttachment.name}</span>
              <button
                onClick={() => setReportAttachment(null)}
                className="p-1 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => reportFileInputRef.current?.click()}
              disabled={reportUploading}
              className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors self-start"
            >
              {reportUploading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Paperclip className="w-4 h-4" />
              )}
              {reportUploading ? 'Đang tải...' : 'Đính kèm tệp'}
            </button>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => { setReportDialogOpen(false); setReportReason(''); setReportAttachment(null); }}>
              Hủy
            </Button>
            <Button onClick={handleReport} disabled={submitting || !reportReason.trim()}>
              {submitting ? 'Đang gửi...' : 'Gửi báo cáo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function Messages() {
  const [selectedMatchId, setSelectedMatchId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [addingStranger, setAddingStranger] = useState(false);
  const onlineUsers = useOnlineContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const selectMatch = (match) => {
    setSelectedMatchId(match?.id || null);
    if (match) {
      navigate(`/messages?match=${match.id}`, { replace: true });
    } else {
      navigate('/messages', { replace: true });
    }
  };

  const handleAddStranger = async (targetUser) => {
    setAddingStranger(true);
    try {
      const newMatch = await db.entities.Match.create({
        user1_id: currentUser.id,
        user2_id: targetUser.id,
        status: 'pending',
      });
      queryClient.invalidateQueries({ queryKey: ['matches'] });
      selectMatch(newMatch);
      setSearchQuery('');
      setSearchResults([]);
      toast.success('Đã gửi lời mời kết nối');
    } catch (err) {
      toast.error('Lỗi: ' + (err?.message || 'Không xác định'));
    } finally {
      setAddingStranger(false);
    }
  };

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
      // Filter out unmatched and blocked matches, then deduplicate
      // by user pair (keep the latest one) to handle any existing duplicates
      const all = [...m1, ...m2]
        .filter(m => m.status !== 'blocked' && m.status !== 'unmatched');
      // Deduplicate by user pair — keep the most recent match per pair
      const seen = new Set();
      const deduped = [];
      // Sort by updated_date descending so the latest match per pair wins
      all.sort((a, b) => new Date(b.updated_date || b.created_date) - new Date(a.updated_date || a.created_date));
      for (const m of all) {
        const pairKey = [m.user1_id, m.user2_id].sort().join(':');
        if (!seen.has(pairKey)) {
          seen.add(pairKey);
          deduped.push(m);
        }
      }
      return deduped;
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
    refetchInterval: 120000,
  });

  const { data: myProfiles } = useQuery({
    queryKey: ['myProfile'],
    queryFn: async () => {
      const me = await db.auth.me();
      return db.entities.ContestantProfile.filter({ created_by: me.id });
    },
    initialData: [],
    enabled: !!currentUser,
    refetchInterval: 120000,
  });
  const myProfile = myProfiles[0];

  const { data: sentInvites } = useQuery({
    queryKey: ['sentInvites', currentUser?.id],
    queryFn: async () => {
      const me = await db.auth.me();
      return db.entities.TeamInvite.filter({ inviter_id: me.id, status: 'pending' });
    },
    initialData: [],
    enabled: !!currentUser,
  });

  const { data: receivedInvites } = useQuery({
    queryKey: ['receivedInvites', currentUser?.id],
    queryFn: async () => {
      const me = await db.auth.me();
      return db.entities.TeamInvite.filter({ invitee_id: me.id, status: 'pending' });
    },
    initialData: [],
    enabled: !!currentUser,
  });

  const sendTeamInviteMutation = useMutation({
    mutationFn: async ({ inviteeEmail, teamId }) => {
      return request('POST', '/api/teams/invite-by-email', {
        team_id: teamId,
        invitee_email: inviteeEmail,
      });
    },
    onSuccess: () => {
      toast.success('Đã gửi lời mời!');
      queryClient.invalidateQueries({ queryKey: ['sentInvites', currentUser?.id] });
    },
    onError: (err) => toast.error(err?.message || 'Không thể gửi lời mời'),
  });

  const cancelTeamInviteMutation = useMutation({
    mutationFn: async (inviteId) => {
      await db.entities.TeamInvite.update(inviteId, { status: 'rejected' });
    },
    onSuccess: () => {
      toast.success('Đã hủy lời mời');
      queryClient.invalidateQueries({ queryKey: ['sentInvites', currentUser?.id] });
      queryClient.invalidateQueries({ queryKey: ['receivedInvites', currentUser?.id] });
    },
    onError: (err) => toast.error(err?.message || 'Không thể hủy lời mời'),
  });

  const acceptTeamInviteMutation = useMutation({
    mutationFn: async ({ inviteId, teamId }) => {
      await request('POST', `/api/teams/${teamId}/accept-invite`);
    },
    onSuccess: () => {
      toast.success('Đã vào đội!');
      queryClient.invalidateQueries();
    },
    onError: (err) => toast.error(err?.message || 'Không thể chấp nhận lời mời'),
  });

  const selectedMatch = useMemo(() => {
    if (!selectedMatchId || !matches) return null;
    return matches.find(m => m.id === selectedMatchId) || null;
  }, [selectedMatchId, matches]);

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
    if (matchId && matches.length > 0 && !selectedMatchId) {
      setSelectedMatchId(matchId);
    }
  }, [matches, selectedMatchId]);

  // Debounce search query
  useEffect(() => {
    if (!searchQuery || searchQuery.length < 3) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const results = await db.search.searchUsers(searchQuery);
        setSearchResults(results);
      } catch {
        setSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  return (
    <div className="flex w-full max-w-full" style={{ height: '100dvh' }}>
      {/* Sidebar */}
      <div className={`w-full lg:w-72 flex-col border-r border-primary/10 bg-[hsl(150_20%_5%)] ${selectedMatch ? 'hidden lg:flex' : 'flex'}`}>
        <div className="px-4 py-3 md:px-5 md:py-5 border-b border-primary/10">
          <h1 className="font-display font-bold text-sm tracking-wide text-primary">Tin nhắn</h1>
          <p className="font-body text-[10px] text-muted-foreground mt-0.5">
            {matches.length} kết nối — {unreadMessages.length} chưa đọc
          </p>
        </div>
        {/* Search bar */}
        <div className="px-3 py-2 border-b border-primary/5">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm bằng email..."
              className="font-body text-xs pl-9 bg-black/20 !border-primary/10 h-9 rounded-lg"
            />
          </div>
          {searchQuery.length >= 3 && searchResults.length > 0 && (
            <div className="mt-2 border border-primary/10 rounded-lg bg-background/95 backdrop-blur-sm overflow-hidden">
              {searchResults.map(user => (
                <div key={user.id} className="flex items-center gap-3 p-2.5 hover:bg-primary/5 transition-colors">
                  <div className="w-7 h-7 rounded-md overflow-hidden bg-muted/60 flex-shrink-0">
                    {user.profile_image
                      ? <img src={user.profile_image} alt="" className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center"><User className="w-3 h-3 text-primary/30" /></div>
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-body text-xs text-foreground truncate">{user.display_name}</p>
                    <p className="font-body text-[10px] text-muted-foreground truncate">{user.email}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[10px] px-2"
                    onClick={() => handleAddStranger(user)}
                    disabled={addingStranger}
                  >
                    Thêm
                  </Button>
                </div>
              ))}
            </div>
          )}
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
                currentUser={currentUser}
                myProfile={myProfile}
                profileMap={profileMap}
                sentInvites={sentInvites}
                receivedInvites={receivedInvites}
                isSelected={selectedMatch?.id === match.id}
                unreadCount={unreadByMatch[match.id] || 0}
                isOnline={onlineUsers.has(otherEmail)}
                onClick={() => selectMatch(match)}
                onSendTeamInvite={(email) => sendTeamInviteMutation.mutate({ inviteeEmail: email, teamId: myProfile?.team_id })}
                onCancelTeamInvite={(inviteId) => cancelTeamInviteMutation.mutate(inviteId)}
                onAcceptTeamInvite={(inviteId, teamId) => acceptTeamInviteMutation.mutate({ inviteId, teamId })}
              />
            );
          })}
        </div>
      </div>

      {/* Chat area */}
      <div className={`flex-1 flex flex-col bg-[hsl(150_20%_5%)] w-full max-w-full ${!selectedMatch ? 'hidden lg:flex' : 'flex'}`}>
        {selectedMatch ? (
          <ChatArea key={selectedMatch.id} match={selectedMatch} currentUser={currentUser} myProfile={myProfile} profileMap={profileMap} sentInvites={sentInvites} receivedInvites={receivedInvites} isOnline={onlineUsers.has(selectedMatch?.user1_id === currentUser?.id ? selectedMatch?.user2_id : selectedMatch?.user1_id)} onBack={() => selectMatch(null)} onSendTeamInvite={(email) => sendTeamInviteMutation.mutate({ inviteeEmail: email, teamId: myProfile?.team_id })} onCancelTeamInvite={(inviteId) => cancelTeamInviteMutation.mutate(inviteId)} onAcceptTeamInvite={(inviteId, teamId) => acceptTeamInviteMutation.mutate({ inviteId, teamId })} />
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
