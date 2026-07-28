import { db, request } from '@/api/apiClient';

import React, { useState, useEffect } from 'react';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Users, Plus, Check, X, User, UserPlus, Shield, Search, Pencil, LogOut, Loader2, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import PageFooter from '@/components/layout/PageFooter';

const ROLE_COLORS = {
  'Data': 'text-blue-300',
  'ML': 'text-primary',
  'Backend': 'text-purple-300',
  'All-rounder': 'text-yellow-300',
};

export default function TeamPage() {
  const queryClient = useQueryClient();
  const [teamName, setTeamName] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [confirmLeaveOpen, setConfirmLeaveOpen] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [matchedSearchQuery, setMatchedSearchQuery] = useState('');

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => db.auth.me(),
  });

  const { data: myProfiles } = useQuery({
    queryKey: ['myProfile'],
    queryFn: async () => {
      const me = await db.auth.me();
      return db.entities.ContestantProfile.filter({ created_by: me.id });
    },
    initialData: [],
    refetchInterval: 120000,
  });
  const myProfile = myProfiles[0];

  const { data: allTeamsAsLeader } = useQuery({
    queryKey: ['allTeamsForLeader'],
    queryFn: async () => {
      const me = await db.auth.me();
      return db.entities.Team.filter({ leader_id: me.id });
    },
    initialData: [],
    enabled: !!currentUser,
    refetchInterval: 120000,
  });

  const { data: teamById } = useQuery({
    queryKey: ['myTeam', myProfile?.team_id],
    queryFn: async () => {
      return db.entities.Team.filter({ id: myProfile.team_id });
    },
    initialData: [],
    enabled: !!myProfile?.team_id,
    refetchInterval: 120000,
  });

  const myTeam = allTeamsAsLeader[0] || teamById[0] || null;

  const { data: invites } = useQuery({
    queryKey: ['myInvites', currentUser?.id],
    queryFn: async () => {
      const me = await db.auth.me();
      return db.entities.TeamInvite.filter({ invitee_id: me.id, status: 'pending' });
    },
    initialData: [],
    enabled: !!currentUser,
  });

  const { data: sentInvites } = useQuery({
    queryKey: ['sentInvites', currentUser?.id],
    queryFn: async () => {
      const me = await db.auth.me();
      return db.entities.TeamInvite.filter({ inviter_id: me.id, status: 'pending' });
    },
    initialData: [],
    enabled: !!currentUser && !!myTeam,
  });

  const { data: allProfiles } = useQuery({
    queryKey: ['allProfilesForTeam'],
    queryFn: () => db.entities.ContestantProfile.list(),
    initialData: [],
  });
  const profileMap = {};
  allProfiles.forEach(p => { profileMap[p.created_by] = p; });

  // Fetch matched users for adding to team
  const { data: matchedUsers } = useQuery({
    queryKey: ['matchedUsers'],
    queryFn: () => request('GET', '/api/teams/matched-users'),
    initialData: [],
    enabled: !!myTeam && showAddMember,
  });

  const { data: allTeams } = useQuery({
    queryKey: ['allTeams'],
    queryFn: () => db.entities.Team.list(),
    initialData: [],
  });
  const teamMemberCount = {};
  allTeams.forEach(t => { teamMemberCount[t.id] = (t.member_ids || []).length; });

  const createTeamMutation = useMutation({
    mutationFn: async () => {
      const me = await db.auth.me();
      const team = await db.entities.Team.create({
        name: teamName, leader_id: me.id,
        member_ids: [me.id], max_members: 2, status: 'forming',
      });
      if (myProfile) {
        await db.entities.ContestantProfile.update(myProfile.id, { team_id: team.id, has_team: true });
      }
      return team;
    },
    onSuccess: () => { queryClient.invalidateQueries(); toast.success('Đã tạo đội!'); setTeamName(''); },
  });

  const respondInviteMutation = useMutation({
    mutationFn: async ({ invite, accept }) => {
      if (accept) {
        await request('POST', `/api/teams/${invite.team_id}/accept-invite`);
      } else {
        await db.entities.TeamInvite.update(invite.id, { status: 'rejected' });
      }
    },
    onSuccess: () => { queryClient.invalidateQueries(); toast.success('Đã xử lý lời mời!'); },
  });

  const sendInviteMutation = useMutation({
    mutationFn: async (inviteeEmail) => {
      if (!myTeam) { toast.error('Bạn chưa có đội'); return; }
      return request('POST', '/api/teams/invite-by-email', {
        team_id: myTeam.id,
        invitee_email: inviteeEmail,
      });
    },
    onSuccess: () => {
      toast.success('Đã gửi lời mời!');
      queryClient.invalidateQueries({ queryKey: ['sentInvites', currentUser?.id] });
      queryClient.invalidateQueries({ queryKey: ['matchedUsers'] });
    },
    onError: (error) => {
      const msg = error.message || 'Không thể gửi lời mời';
      toast.error(msg);
    },
  });

  const cancelInviteMutation = useMutation({
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

  const renameMutation = useMutation({
    mutationFn: async (newName) => {
      if (!myTeam) return;
      await db.entities.Team.update(myTeam.id, { name: newName });
    },
    onSuccess: () => { queryClient.invalidateQueries(); toast.success('Đã đổi tên đội!'); setIsRenaming(false); },
    onError: (err) => toast.error(err?.message || 'Không thể đổi tên đội'),
  });

  const leaveMutation = useMutation({
    mutationFn: async () => {
      if (!myTeam) return;
      return request('DELETE', `/api/teams/${myTeam.id}`);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries();
      if (data?.disband_pending) {
        toast.success('Đã yêu cầu rời đội — chờ thành viên xác nhận');
      } else {
        toast.success('Bạn đã rời khỏi đội');
        if (myProfile) {
          db.entities.ContestantProfile.update(myProfile.id, { team_id: null, has_team: false }).catch(() => { });
        }
      }
    },
    onError: (err) => toast.error(err?.message || 'Không thể rời đội'),
  });

  const disbandRespondMutation = useMutation({
    mutationFn: async ({ action }) => {
      if (!myTeam) return;
      return request('POST', `/api/teams/${myTeam.id}/disband-respond`, { action });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries();
      if (data?.success) toast.success(data.message || 'Đã xử lý');
    },
    onError: (err) => toast.error(err?.message || 'Không thể xử lý yêu cầu'),
  });

  const statusLabel = { forming: 'Đang thành lập', full: 'Đủ thành viên', locked: 'Đã khóa' };

  // Filter matched users — exclude current members and users on a team with >1 member
  const teamMemberIds = new Set(myTeam?.member_ids || []);
  if (myTeam?.leader_id) teamMemberIds.add(myTeam.leader_id);
  const availableMatches = matchedUsers.filter(u => {
    if (teamMemberIds.has(u.matched_user_id)) return false;
    // Allow users who have no team, or whose team only has themself (1 member)
    if (u.has_team && u.team_id) {
      const count = teamMemberCount[u.team_id] || 0;
      if (count > 1) return false;
    }
    if (matchedSearchQuery) {
      const q = matchedSearchQuery.toLowerCase();
      return (
        u.display_name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.school?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="min-h-screen flex flex-col p-4 md:p-8 grid-overlay">
      <div className="max-w-2xl mx-auto gap-5 w-full flex-1 flex flex-col">
        <div>
          <h1 className="font-display font-bold text-xl flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            <span className="text-primary">Đội của tôi</span>
          </h1>
        </div>

        {/* Pending Invites */}
        {invites.length > 0 && (
          <div className="glass-card rounded-xl border border-primary/25  overflow-hidden">
            <div className="px-4 py-3 border-b border-primary/15 flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-primary" />
              <h3 className="font-display text-sm font-semibold text-primary">Lời mời ({invites.length})</h3>
            </div>
            <div className="p-3 space-y-2">
              {invites.map(inv => (
                <div key={inv.id} className="flex items-center justify-between p-3 bg-primary/5 rounded-lg border border-primary/10">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {profileMap[inv.inviter_id]?.display_name || inv.inviter_id}
                    </p>
                    <p className="text-xs text-muted-foreground ">mời bạn vào đội</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" className="h-8 w-8 p-0 bg-primary text-background hover:bg-primary/90"
                      onClick={() => respondInviteMutation.mutate({ invite: inv, accept: true })}>
                      <Check className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 w-8 p-0 border-destructive/30 text-destructive hover:bg-destructive/10"
                      onClick={() => respondInviteMutation.mutate({ invite: inv, accept: false })}>
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* My Team */}
        {myTeam ? (
          <div className="glass-card rounded-xl border border-primary/15 overflow-hidden">
            <div className="px-4 py-3 border-b border-primary/10 flex items-center gap-2">
              {isRenaming ? (
                <div className="flex items-center gap-2 flex-1">
                  <Input
                    value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    className="text-sm h-8 bg-muted/50 border-primary/20 text-foreground flex-1"
                    onKeyDown={e => {
                      if (e.key === 'Enter' && renameValue.trim()) renameMutation.mutate(renameValue.trim());
                      if (e.key === 'Escape') { setIsRenaming(false); setRenameValue(myTeam.name); }
                    }}
                    onBlur={() => { setIsRenaming(false); setRenameValue(myTeam.name); }}
                    autoFocus
                  />
                  <Button size="sm" className="h-8 text-[10px] px-2 bg-primary text-background"
                    onClick={() => renameValue.trim() && renameMutation.mutate(renameValue.trim())}>
                    Lưu
                  </Button>
                </div>
              ) : (
                <>
                  <Users className="w-4 h-4 text-primary" />
                  <h3 className="font-display text-sm font-semibold text-primary flex-1">{myTeam.name}</h3>
                  <p className="text-[10px] text-primary/50 px-1">{statusLabel[myTeam.status]}</p>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => { setIsRenaming(true); setRenameValue(myTeam.name); }}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                      title="Đổi tên đội"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setConfirmLeaveOpen(true)}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      title="Rời đội"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </>
              )}
              <span className="text-[10px] text-muted-foreground px-2 py-0.5 rounded border border-primary/10">
                {(myTeam.member_ids || []).length}/{myTeam.max_members || 2}
              </span>
            </div>

            {/* Disband consent banner for other member */}
            {myTeam.disband_initiated_by && myTeam.disband_initiated_by !== currentUser?.id && (
              <div className="mx-3 mt-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <p className="text-xs font-medium text-destructive mb-2">
                  Thành viên kia đã yêu cầu rời đội
                </p>
                <div className="flex gap-2">
                  <Button size="sm" className="h-8 text-[10px] bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() => disbandRespondMutation.mutate({ action: 'accept' })}
                    disabled={disbandRespondMutation.isPending}>
                    {disbandRespondMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                    Đồng ý
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 text-[10px] border-primary/20"
                    onClick={() => disbandRespondMutation.mutate({ action: 'reject' })}
                    disabled={disbandRespondMutation.isPending}>
                    Từ chối
                  </Button>
                </div>
              </div>
            )}

            {/* Disband pending info for initiator */}
            {myTeam.disband_initiated_by === currentUser?.id && (
              <div className="mx-3 mt-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <p className="text-xs font-medium text-amber-400">
                  Đang chờ thành viên xác nhận rời đội
                </p>
              </div>
            )}

            {/* Sent invites banner */}
            {sentInvites.length > 0 && (
              <div className="mx-3 mt-3 p-3 rounded-lg bg-primary/5 border border-primary/10">
                <p className="text-xs font-medium text-primary mb-2">
                  Lời mời đã gửi ({sentInvites.length})
                </p>
                <div className="space-y-1.5">
                  {sentInvites.map(inv => {
                    const p = profileMap[inv.invitee_id];
                    return (
                      <div key={inv.id} className="flex items-center justify-between py-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-6 h-6 rounded-full bg-muted overflow-hidden border border-primary/10 flex-shrink-0">
                            {p?.profile_image ? (
                              <img src={p.profile_image} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <User className="w-2.5 h-2.5 text-primary/30" />
                              </div>
                            )}
                          </div>
                          <span className="text-xs text-foreground truncate">{p?.display_name || 'Unknown'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground flex-shrink-0">Đang chờ</span>
                          <button
                            onClick={() => cancelInviteMutation.mutate(inv.id)}
                            disabled={cancelInviteMutation.isPending}
                            className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                            title="Hủy lời mời"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="p-3 space-y-2">
              {(myTeam.member_ids || []).map(memberId => {
                const p = profileMap[memberId];
                return (
                  <div key={memberId} className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/10">
                    <div className="w-10 h-10 rounded-full bg-muted overflow-hidden border border-primary/15">
                      {p?.profile_image ? (
                        <img src={p.profile_image} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <User className="w-4 h-4 text-primary/30" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">{p?.display_name || memberId}</p>
                      {p?.role && <p className={`font-display text-[10px] ${ROLE_COLORS[p.role] || 'text-primary'}`}>{p.role}</p>}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Add member / Slot remaining */}
            {(myTeam.member_ids || []).length < (myTeam.max_members || 2) && (
              <div className="px-4 pb-4 space-y-3">
                <button
                  onClick={() => setShowAddMember(!showAddMember)}
                  className="w-full text-[10px] text-muted-foreground text-center py-3 border border-dashed border-primary/15 rounded-lg hover:border-primary/30 hover:text-primary transition-colors flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  + {(myTeam.max_members || 2) - (myTeam.member_ids || []).length} slot còn trống
                </button>

                {/* Matched users popup */}
                {showAddMember && (
                  <div className="border border-primary/10 rounded-lg bg-background/95 backdrop-blur-sm overflow-hidden">
                    <div className="p-2 border-b border-primary/10">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
                        <Input
                          value={matchedSearchQuery}
                          onChange={e => setMatchedSearchQuery(e.target.value)}
                          placeholder="Tìm kiếm người đã match..."
                          className="font-body text-xs pl-9 bg-black/20 !border-primary/10 h-8 rounded-lg"
                        />
                      </div>
                    </div>
                    <div className="max-h-60 overflow-y-auto">
                      {availableMatches.length === 0 ? (
                        <div className="p-4 text-center">
                          <MessageCircle className="w-6 h-6 text-muted-foreground/30 mx-auto mb-2" />
                          <p className="text-xs text-muted-foreground/50">
                            {matchedSearchQuery
                              ? 'Không tìm thấy kết quả'
                              : 'Chưa có người match nào. Hãy khám phá để tìm đồng đội!'}
                          </p>
                        </div>
                      ) : (
                        availableMatches.map(user => {
                          const isAlreadyInvited = sentInvites.some(inv =>
                            inv.invitee_id === user.matched_user_id && inv.team_id === myTeam?.id
                          );
                          return (
                            <div key={user.matched_user_id} className="flex items-center gap-3 p-2.5 hover:bg-primary/5 transition-colors">
                              <div className="w-8 h-8 rounded-md overflow-hidden bg-muted/60 flex-shrink-0">
                                {user.profile_image
                                  ? <img src={user.profile_image} alt="" className="w-full h-full object-cover" />
                                  : <div className="w-full h-full flex items-center justify-center"><User className="w-3 h-3 text-primary/30" /></div>
                                }
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-body text-xs text-foreground truncate">{user.display_name || 'Unknown'}</p>
                                <p className="font-body text-[10px] text-muted-foreground truncate">{user.email}</p>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-[10px] px-2"
                                onClick={() => {
                                  sendInviteMutation.mutate(user.email);
                                }}
                                disabled={sendInviteMutation.isPending || isAlreadyInvited}
                              >
                                {sendInviteMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : isAlreadyInvited ? 'Đã mời' : 'Mời'}
                              </Button>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Leave confirmation dialog */}
            {confirmLeaveOpen && (
              <div className="px-4 pb-4">
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <p className="text-xs font-medium text-destructive mb-2">
                    Bạn có chắc muốn rời đội?{myTeam.member_ids?.length > 1 ? ' Thành viên còn lại sẽ cần xác nhận.' : ''}
                  </p>
                  <div className="flex gap-2">
                    <Button size="sm" className="h-8 text-[10px] bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={() => { leaveMutation.mutate(); setConfirmLeaveOpen(false); }}
                      disabled={leaveMutation.isPending}>
                      {leaveMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                      Rời đội
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 text-[10px] border-primary/20"
                      onClick={() => setConfirmLeaveOpen(false)}>
                      Hủy
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="glass-card rounded-xl border border-primary/15 overflow-hidden">
            <div className="px-4 py-3 border-b border-primary/10 flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              <h3 className="font-display text-sm font-semibold text-primary">Tạo đội mới</h3>
            </div>
            <div className="p-4">
              <div className="flex gap-3">
                <Input
                  value={teamName}
                  onChange={e => setTeamName(e.target.value)}
                  placeholder="Nhập tên đội..."
                  className="text-sm bg-muted/50 border-primary/20 focus:border-primary/50 text-foreground placeholder:text-muted-foreground"
                  onKeyDown={e => e.key === 'Enter' && teamName.trim() && createTeamMutation.mutate()}
                />
                <Button
                  onClick={() => createTeamMutation.mutate()}
                  disabled={!teamName.trim()}
                  className="gap-1 font-display text-xs font-medium bg-primary text-background hover:bg-primary/90 flex-shrink-0"
                >
                  <Plus className="w-4 h-4" /> Tạo
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">
                Tối đa 2 thành viên / đội
              </p>
            </div>
          </div>
        )}
        <PageFooter />
      </div>
    </div>
  );
}