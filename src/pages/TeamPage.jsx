const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState, useEffect } from 'react';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Users, Plus, Check, X, User, Crown, UserPlus, Shield } from 'lucide-react';
import { toast } from 'sonner';

const ROLE_COLORS = {
  'Data': 'text-blue-300',
  'ML': 'text-neon',
  'Backend': 'text-purple-300',
  'All-rounder': 'text-yellow-300',
};

export default function TeamPage() {
  const queryClient = useQueryClient();
  const [teamName, setTeamName] = useState('');

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => db.auth.me(),
  });

  const { data: myProfiles } = useQuery({
    queryKey: ['myProfile'],
    queryFn: async () => {
      const me = await db.auth.me();
      return db.entities.ContestantProfile.filter({ created_by: me.email });
    },
    initialData: [],
  });
  const myProfile = myProfiles[0];

  const { data: allTeamsAsLeader } = useQuery({
    queryKey: ['allTeamsForLeader'],
    queryFn: async () => {
      const me = await db.auth.me();
      return db.entities.Team.filter({ leader_id: me.email });
    },
    initialData: [],
    enabled: !!currentUser,
  });

  const { data: teamById } = useQuery({
    queryKey: ['myTeam', myProfile?.team_id],
    queryFn: async () => {
      return db.entities.Team.filter({ id: myProfile.team_id });
    },
    initialData: [],
    enabled: !!myProfile?.team_id,
  });

  const leaderTeam = allTeamsAsLeader[0] || teamById[0] || null;

  const { data: invites } = useQuery({
    queryKey: ['myInvites'],
    queryFn: async () => {
      const me = await db.auth.me();
      return db.entities.TeamInvite.filter({ invitee_id: me.email, status: 'pending' });
    },
    initialData: [],
    enabled: !!currentUser,
  });

  const { data: allProfiles } = useQuery({
    queryKey: ['allProfilesForTeam'],
    queryFn: () => db.entities.ContestantProfile.list(),
    initialData: [],
  });
  const profileMap = {};
  allProfiles.forEach(p => { profileMap[p.created_by] = p; });

  const createTeamMutation = useMutation({
    mutationFn: async () => {
      const me = await db.auth.me();
      const team = await db.entities.Team.create({
        name: teamName, leader_id: me.email,
        member_ids: [me.email], max_members: 4, status: 'forming',
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
      await db.entities.TeamInvite.update(invite.id, { status: accept ? 'accepted' : 'rejected' });
      if (accept) {
        const teamList = await db.entities.Team.filter({ id: invite.team_id });
        const team = teamList[0];
        if (team) {
          const newMembers = [...(team.member_ids || []), currentUser.email];
          await db.entities.Team.update(team.id, {
            member_ids: newMembers,
            status: newMembers.length >= (team.max_members || 4) ? 'full' : 'forming',
          });
          if (myProfile) {
            await db.entities.ContestantProfile.update(myProfile.id, { team_id: team.id, has_team: true });
          }
        }
      }
    },
    onSuccess: () => { queryClient.invalidateQueries(); toast.success('Đã xử lý lời mời!'); },
  });

  const sendInviteMutation = useMutation({
    mutationFn: async (inviteeEmail) => {
      if (!leaderTeam) { toast.error('Bạn chưa có đội'); return; }
      await db.entities.TeamInvite.create({
        team_id: leaderTeam.id, inviter_id: currentUser.email,
        invitee_id: inviteeEmail, status: 'pending',
      });
    },
    onSuccess: () => toast.success('Đã gửi lời mời!'),
  });

  useEffect(() => {
    const inviteParam = new URLSearchParams(window.location.search).get('invite');
    if (inviteParam && leaderTeam) {
      sendInviteMutation.mutate(inviteParam);
      window.history.replaceState({}, '', '/team');
    }
  }, [leaderTeam]);

  const statusLabel = { forming: '🔵 Đang thành lập', full: '🟢 Đủ thành viên', locked: '🔒 Đã khóa' };

  return (
    <div className="min-h-screen p-4 md:p-8 grid-overlay">
      <div className="max-w-2xl mx-auto space-y-5">
        <div>
          <h1 className="font-display font-bold text-xl tracking-widest uppercase flex items-center gap-2">
            <Users className="w-5 h-5 text-neon" />
            <span className="neon-text">Đội của tôi</span>
          </h1>
        </div>

        {/* Pending Invites */}
        {invites.length > 0 && (
          <div className="glass-card rounded-xl border border-neon/25 neon-glow overflow-hidden">
            <div className="px-4 py-3 border-b border-neon/15 flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-neon" />
              <h3 className="font-display text-xs tracking-widest uppercase neon-text">Lời mời ({invites.length})</h3>
            </div>
            <div className="p-3 space-y-2">
              {invites.map(inv => (
                <div key={inv.id} className="flex items-center justify-between p-3 bg-neon/5 rounded-lg border border-neon/10">
                  <div>
                    <p className="font-mono text-sm font-medium text-foreground">
                      {profileMap[inv.inviter_id]?.display_name || inv.inviter_id}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono">mời bạn vào đội</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" className="h-8 w-8 p-0 bg-neon text-background hover:bg-neon/90"
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
        {leaderTeam ? (
          <div className="glass-card rounded-xl border border-neon/15 overflow-hidden">
            <div className="px-4 py-3 border-b border-neon/10 flex items-center gap-2">
              <Crown className="w-4 h-4 text-neon" />
              <h3 className="font-display text-xs tracking-widest uppercase neon-text flex-1">{leaderTeam.name}</h3>
              <span className="font-mono text-[10px] text-muted-foreground px-2 py-0.5 rounded border border-neon/10">
                {(leaderTeam.member_ids || []).length}/{leaderTeam.max_members || 4}
              </span>
            </div>

            <div className="p-3 space-y-2">
              <p className="font-mono text-[10px] text-neon/50 px-1">{statusLabel[leaderTeam.status]}</p>
              {(leaderTeam.member_ids || []).map(email => {
                const p = profileMap[email];
                const isLeader = email === leaderTeam.leader_id;
                return (
                  <div key={email} className="flex items-center gap-3 p-3 rounded-lg bg-neon/5 border border-neon/10">
                    <div className="w-10 h-10 rounded-full bg-muted overflow-hidden border border-neon/15">
                      {p?.profile_image ? (
                        <img src={p.profile_image} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <User className="w-4 h-4 text-neon/30" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-mono text-sm font-medium text-foreground">{p?.display_name || email}</p>
                      {p?.role && <p className={`font-display text-[10px] tracking-widest ${ROLE_COLORS[p.role] || 'text-neon'}`}>{p.role}</p>}
                    </div>
                    {isLeader && <Crown className="w-4 h-4 text-neon" />}
                  </div>
                );
              })}
            </div>

            {/* Slots remaining */}
            {(leaderTeam.member_ids || []).length < (leaderTeam.max_members || 4) && (
              <div className="px-4 pb-4">
                <p className="font-mono text-[10px] text-muted-foreground text-center py-3 border border-dashed border-neon/15 rounded-lg">
                  + {(leaderTeam.max_members || 4) - (leaderTeam.member_ids || []).length} slot còn trống · Mời thêm từ trang Matches
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="glass-card rounded-xl border border-neon/15 overflow-hidden">
            <div className="px-4 py-3 border-b border-neon/10 flex items-center gap-2">
              <Shield className="w-4 h-4 text-neon" />
              <h3 className="font-display text-xs tracking-widest uppercase neon-text">Tạo đội mới</h3>
            </div>
            <div className="p-4">
              <div className="flex gap-3">
                <Input
                  value={teamName}
                  onChange={e => setTeamName(e.target.value)}
                  placeholder="Nhập tên đội..."
                  className="font-mono text-sm bg-muted/50 border-neon/20 focus:border-neon/50 text-foreground placeholder:text-muted-foreground"
                  onKeyDown={e => e.key === 'Enter' && teamName.trim() && createTeamMutation.mutate()}
                />
                <Button
                  onClick={() => createTeamMutation.mutate()}
                  disabled={!teamName.trim()}
                  className="gap-1 font-display text-xs uppercase tracking-widest bg-neon text-background hover:bg-neon/90 flex-shrink-0"
                >
                  <Plus className="w-4 h-4" /> Tạo
                </Button>
              </div>
              <p className="font-mono text-[10px] text-muted-foreground mt-2">
                Tối đa 4 thành viên / đội
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}