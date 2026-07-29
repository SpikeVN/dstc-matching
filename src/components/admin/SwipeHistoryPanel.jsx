import React, { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Search, Heart, X, User, ThumbsUp, ThumbsDown,
  ArrowUpDown, Loader2, Trash2,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '@/api/apiClient';
import { formatDateTime } from '@/lib/timeUtils';
import { toast } from 'sonner';

export default function SwipeHistoryPanel({ userId, userName, open, onClose }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [confirmClearPasses, setConfirmClearPasses] = useState(false);

  const { data: swipes, isLoading } = useQuery({
    queryKey: ['adminUserSwipes', userId, search, actionFilter],
    queryFn: () => db.admin.getUserSwipes(userId, {
      search: search || undefined,
      action: actionFilter || undefined,
      limit: 1000,
    }),
    initialData: [],
    enabled: open,
  });

  const clearPassesMutation = useMutation({
    mutationFn: () => db.admin.clearUserPasses(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminUserSwipes', userId] });
      toast.success('Đã xóa tất cả lượt Pass');
      setConfirmClearPasses(false);
    },
    onError: (err) => toast.error(err.message || 'Không thể xóa lượt Pass'),
  });

  const deleteSwipeMutation = useMutation({
    mutationFn: (swipeId) => db.admin.deleteUserSwipe(userId, swipeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminUserSwipes', userId] });
      toast.success('Đã xóa lượt vuốt');
    },
    onError: (err) => toast.error(err.message || 'Không thể xóa lượt vuốt'),
  });

  const passCount = swipes.filter(s => s.action === 'pass').length;

  return (
    <Dialog open={open} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Heart className="w-4 h-4 text-pink-400" />
            Lịch sử vuốt — {userName}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3 flex-1 min-h-0">
          {/* Search and filters */}
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/60 z-10" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Tìm theo tên, email..."
                className="pl-9 h-9 text-sm bg-[rgba(10,18,11,0.75)] backdrop-blur-md border-primary/15 focus:border-primary/40 font-body"
              />
            </div>
            <Select value={actionFilter} onValueChange={v => setActionFilter(v === 'all' ? '' : v)}>
              <SelectTrigger className="w-[130px] h-9 text-xs bg-[rgba(10,18,11,0.75)] backdrop-blur-md border-primary/15 text-foreground">
                <SelectValue placeholder="Hành động" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                <SelectItem value="like">Like</SelectItem>
                <SelectItem value="pass">Pass</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Info badge + clear passes button */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-xs text-muted-foreground">
              {isLoading ? 'Đang tải...' : `${swipes.length} lượt vuốt`}
            </p>
            {passCount > 0 && !confirmClearPasses && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-[11px] text-destructive border-destructive/30 hover:bg-destructive/10"
                onClick={() => setConfirmClearPasses(true)}
                disabled={clearPassesMutation.isPending}
              >
                <Trash2 className="w-3 h-3 mr-1" />
                Xóa {passCount} lượt Pass
              </Button>
            )}
            {passCount > 0 && confirmClearPasses && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-destructive font-medium">Xóa tất cả Pass?</span>
                <Button
                  size="sm"
                  className="h-7 text-[11px] bg-destructive text-background hover:bg-destructive/80"
                  onClick={() => clearPassesMutation.mutate()}
                  disabled={clearPassesMutation.isPending}
                >
                  {clearPassesMutation.isPending ? 'Đang xóa...' : 'Xác nhận'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-[11px]"
                  onClick={() => setConfirmClearPasses(false)}
                >
                  Hủy
                </Button>
              </div>
            )}
          </div>

          {/* Swipe table */}
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            </div>
          ) : swipes.length === 0 ? (
            <div className="text-center py-16">
              <Heart className="w-10 h-10 text-primary/10 mx-auto mb-3" />
              <p className="font-body text-sm text-muted-foreground">Người dùng này chưa có lượt vuốt nào</p>
            </div>
          ) : (
            <div className="glass-card rounded-xl border border-primary/10 overflow-hidden flex-1">
              <div className="overflow-y-auto max-h-[400px]">
                <table className="w-full text-xs font-body">
                  <thead className="sticky top-0 bg-card z-10">
                    <tr className="border-b border-primary/10 bg-muted/20">
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-[11px] uppercase tracking-wider">Hướng</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-[11px] uppercase tracking-wider">Người dùng</th>
                      <th className="text-center px-4 py-3 font-semibold text-muted-foreground text-[11px] uppercase tracking-wider">Hành động</th>
                      <th className="text-center px-4 py-3 font-semibold text-muted-foreground text-[11px] uppercase tracking-wider hidden sm:table-cell">Match</th>
                      <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-[11px] uppercase tracking-wider">Thời gian</th>
                      <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-[11px] uppercase tracking-wider w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-primary/8">
                    {swipes.map(swipe => {
                      const isOutgoing = swipe.swiper_id === userId;
                      const otherUser = isOutgoing
                        ? { name: swipe.swiped_name, image: swipe.swiped_image, email: swipe.swiped_email, id: swipe.swiped_id }
                        : { name: swipe.swiper_name, image: swipe.swiper_image, email: swipe.swiper_email, id: swipe.swiper_id };

                      return (
                        <tr key={swipe.id} className="hover:bg-primary/5 transition-colors">
                          <td className="px-4 py-3">
                            <span className={`flex items-center gap-1 text-[11px] font-medium ${
                              isOutgoing ? 'text-primary' : 'text-orange-400'
                            }`}>
                              <ArrowUpDown className="w-3 h-3" />
                              {isOutgoing ? 'Đi' : 'Đến'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-lg overflow-hidden border border-primary/20 bg-muted/50 flex-shrink-0">
                                {otherUser.image
                                  ? <img src={otherUser.image} alt="" className="w-full h-full object-cover" />
                                  : <div className="w-full h-full flex items-center justify-center"><User className="w-3.5 h-3.5 text-primary/30" /></div>
                                }
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-foreground truncate max-w-[180px]">
                                  {otherUser.name || otherUser.id.slice(0, 8)}
                                </p>
                                {otherUser.email && (
                                  <p className="text-[11px] text-muted-foreground truncate max-w-[180px]">
                                    {otherUser.email}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md font-medium ${
                              swipe.action === 'like'
                                ? 'text-pink-400 bg-pink-400/10'
                                : 'text-muted-foreground bg-muted/50'
                            }`}>
                              {swipe.action === 'like' ? (
                                <><ThumbsUp className="w-3 h-3" /> Like</>
                              ) : (
                                <><ThumbsDown className="w-3 h-3" /> Pass</>
                              )}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center hidden sm:table-cell">
                            {swipe.is_match ? (
                              <span className="text-xs text-primary font-medium">✓</span>
                            ) : (
                              <span className="text-xs text-muted-foreground/40">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right text-xs text-muted-foreground/50 whitespace-nowrap">
                            {formatDateTime(swipe.created_date, 'dd/MM/yy HH:mm')}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {!swipe.is_match && (
                              <button
                                onClick={() => deleteSwipeMutation.mutate(swipe.id)}
                                className="p-1.5 rounded-md text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors"
                                title="Xóa lượt vuốt"
                                disabled={deleteSwipeMutation.isPending}
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
