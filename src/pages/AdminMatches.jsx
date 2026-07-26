import { db } from '@/api/apiClient';

import React, { useState } from 'react';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Search, Heart, MessageCircle, User, Shield, Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { format, addHours } from 'date-fns';
import MatchDashboard from '@/components/admin/MatchDashboard';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
const ADMIN_ROLES = [
  { value: 'owner', label: 'Owner', color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
  { value: 'mod', label: 'Mod', color: 'text-purple-400', bg: 'bg-purple-400/10' },
  { value: 'manager', label: 'Manager', color: 'text-blue-400', bg: 'bg-blue-400/10' },
  { value: 'user', label: 'User', color: 'text-muted-foreground', bg: 'bg-muted/50' },
];

function RoleBadge({ role }) {
  const config = ADMIN_ROLES.find(r => r.value === role) || ADMIN_ROLES[3];
  return (
    <span className={`text-[11px] font-medium px-2 py-0.5 rounded ${config.bg} ${config.color}`}>
      {config.label}
    </span>
  );
}

export default function AdminMatches() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [roleFilterValue, setRoleFilterValue] = useState('');

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => db.auth.me(),
  });

  const canManageRoles = ['owner', 'mod'].includes(currentUser?.admin_role);

  // ── Match data ──────────────────────────────────────────────────
  const { data: matches, isLoading: loadingMatches } = useQuery({
    queryKey: ['adminAllMatches'],
    queryFn: () => db.entities.Match.list('-created_date', 200),
    initialData: [],
  });

  const { data: allProfiles, isLoading: loadingProfiles } = useQuery({
    queryKey: ['adminAllProfiles'],
    queryFn: () => db.entities.ContestantProfile.list(),
    initialData: [],
  });

  const { data: allMessages } = useQuery({
    queryKey: ['adminAllMessages'],
    queryFn: () => db.entities.Message.list('-created_date', 500),
    initialData: [],
  });

  // ── User management data ────────────────────────────────────────
  const { data: adminUsers, isLoading: loadingUsers } = useQuery({
    queryKey: ['adminUsers', roleFilterValue, search],
    queryFn: () => db.admin.listUsers({ role: roleFilterValue === 'all' ? undefined : roleFilterValue || undefined, search: search || undefined }),
    initialData: [],
    enabled: currentUser?.admin_role !== 'user',
  });

  // ── Mutations ───────────────────────────────────────────────────
  const roleMutation = useMutation({
    mutationFn: ({ userId, role }) => db.admin.updateUserRole(userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
    },
  });

  const visibilityMutation = useMutation({
    mutationFn: ({ userId, visible }) => db.admin.updateVisibility(userId, visible),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
    },
  });

  // ── Access control ──────────────────────────────────────────────
  if (currentUser && !['owner', 'mod', 'manager'].includes(currentUser.admin_role)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <Shield className="w-12 h-12 text-destructive/40 mx-auto" />
          <p className="font-display font-bold text-lg text-foreground">Truy cập bị từ chối</p>
          <p className="font-body text-sm text-muted-foreground">Trang này chỉ dành cho admin.</p>
        </div>
      </div>
    );
  }

  // ── Match data processing ───────────────────────────────────────
  const profileMap = {};
  allProfiles.forEach(p => { profileMap[p.created_by] = p; });

  const msgCountByMatch = {};
  allMessages.forEach(msg => {
    msgCountByMatch[msg.match_id] = (msgCountByMatch[msg.match_id] || 0) + 1;
  });

  const filteredMatches = matches.filter(match => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const p1 = profileMap[match.user1_id];
    const p2 = profileMap[match.user2_id];
    return (
      match.user1_id?.toLowerCase().includes(q) ||
      match.user2_id?.toLowerCase().includes(q) ||
      p1?.display_name?.toLowerCase().includes(q) ||
      p2?.display_name?.toLowerCase().includes(q) ||
      p1?.school?.toLowerCase().includes(q) ||
      p2?.school?.toLowerCase().includes(q)
    );
  });

  const isLoading = loadingMatches || loadingProfiles;

  return (
    <div className="min-h-screen flex flex-col p-4 md:p-8 grid-overlay">
      <div className="max-w-5xl mx-auto gap-5 w-full flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-display font-bold text-xl tracking-wide text-primary flex items-center gap-2">
              <Shield className="w-5 h-5" /> Admin Panel
            </h1>
            <p className="font-body text-xs text-muted-foreground mt-1">
              {matches.length} matches — {allProfiles.length} thí sinh — {allMessages.length} tin nhắn
            </p>
          </div>
          <div className="flex gap-3 text-xs font-body">
            <div className="px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-primary">
              <span className="font-bold text-lg">{matches.length}</span> Matches
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-pink-500/10 border border-pink-500/20 text-pink-300">
              <span className="font-bold text-lg">{allMessages.length}</span> Tin nhắn
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-300">
              <span className="font-bold text-lg">{allProfiles.length}</span> Hồ sơ
            </div>
          </div>
        </div>

        {/* Tabs (line variant) */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="h-auto bg-transparent p-0 border-b border-primary/10 rounded-none w-full justify-start gap-0">
            {['dashboard', 'users', 'matches'].map(tab => {
              const icons = { dashboard: Shield, users: Users, matches: Heart };
              const labels = { dashboard: 'Dashboard', users: 'Quản lý người dùng', matches: 'Matches' };
              const Icon = icons[tab];
              return (
                <TabsTrigger
                  key={tab}
                  value={tab}
                  className="px-4 py-2.5 text-xs font-body rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none text-muted-foreground hover:text-foreground transition-all"
                >
                  <Icon className="w-3.5 h-3.5 inline mr-1.5" />
                  {labels[tab]}
                </TabsTrigger>
              );
            })}
          </TabsList>

          <TabsContent value="dashboard" className="mt-5">
            <MatchDashboard matches={matches} allProfiles={allProfiles} allMessages={allMessages} />
          </TabsContent>

          <TabsContent value="users" className="mt-5">
          <div className="space-y-4">
            {/* Search and filters */}
            <div className="flex gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Tìm theo tên, email..."
                  className="pl-9 bg-muted/40 border-primary/15 focus:border-primary/40 font-body text-sm"
                />
              </div>
              <Select value={roleFilterValue} onValueChange={setRoleFilterValue}>
                <SelectTrigger className="w-[140px] h-9 text-xs bg-muted/40 border-primary/15 text-foreground">
                  <SelectValue placeholder="Tất cả vai trò" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả vai trò</SelectItem>
                  <SelectItem value="owner">Owner</SelectItem>
                  <SelectItem value="mod">Mod</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Users table */}
            {loadingUsers ? (
              <div className="text-center py-16">
                <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin mx-auto" />
              </div>
            ) : adminUsers.length === 0 ? (
              <div className="text-center py-16">
                <Users className="w-10 h-10 text-primary/10 mx-auto mb-3" />
                <p className="font-body text-sm text-muted-foreground">Không tìm thấy người dùng</p>
              </div>
            ) : (
              <div className="glass-card rounded-xl border border-primary/10 overflow-hidden">
                <table className="w-full text-xs font-body">
                  <thead>
                    <tr className="border-b border-primary/10 bg-muted/20">
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-[11px] uppercase tracking-wider">Người dùng</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-[11px] uppercase tracking-wider">Email</th>
                      <th className="text-center px-4 py-3 font-semibold text-muted-foreground text-[11px] uppercase tracking-wider">Vai trò</th>
                      <th className="text-center px-4 py-3 font-semibold text-muted-foreground text-[11px] uppercase tracking-wider">Hiển thị</th>
                      <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-[11px] uppercase tracking-wider hidden sm:table-cell">Gán ngày</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-primary/8">
                    {adminUsers.map(u => (
                      <tr key={u.id} className="hover:bg-primary/5 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg overflow-hidden border border-primary/20 bg-muted/50 flex-shrink-0">
                              {u.profile_image
                                ? <img src={u.profile_image} alt="" className="w-full h-full object-cover" />
                                : <div className="w-full h-full flex items-center justify-center"><User className="w-4 h-4 text-primary/30" /></div>
                              }
                            </div>
                            <span className="font-medium text-sm text-foreground truncate max-w-[160px]">{u.display_name || 'Unknown'}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground truncate max-w-[200px]">{u.email}</td>
                        <td className="px-4 py-3 text-center">
                          {canManageRoles ? (
                            <Select
                              value={u.admin_role}
                              onValueChange={role => roleMutation.mutate({ userId: u.id, role })}
                            >
                              <SelectTrigger className="h-7 text-xs font-medium px-2 border border-primary/20 bg-transparent text-foreground gap-1 w-auto min-w-[80px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {ADMIN_ROLES.filter(r => r.value !== 'owner').map(r => (
                                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <RoleBadge role={u.admin_role} />
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => visibilityMutation.mutate({ userId: u.id, visible: !u.admin_visible })}
                            className={`p-1.5 rounded-lg transition-all hover:bg-primary/10 ${
                              u.admin_visible ? 'text-primary' : 'text-muted-foreground/50'
                            }`}
                            title={u.admin_visible ? 'Visible in matching' : 'Hidden from matching'}
                          >
                            {u.admin_visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-muted-foreground/50 hidden sm:table-cell">
                          {u.assigned_date ? format(addHours(new Date(u.assigned_date), 7), 'dd/MM/yy') : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          </TabsContent>

          <TabsContent value="matches" className="mt-5">
          <div className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Tìm theo tên, email, trường..."
                className="pl-9 bg-muted/40 border-primary/15 focus:border-primary/40 font-body text-sm"
              />
            </div>

            {/* Matches table */}
            {isLoading ? (
              <div className="text-center py-16">
                <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin mx-auto" />
              </div>
            ) : filteredMatches.length === 0 ? (
              <div className="text-center py-16">
                <Heart className="w-10 h-10 text-primary/10 mx-auto mb-3" />
                <p className="font-body text-sm text-muted-foreground">Không tìm thấy match nào</p>
              </div>
            ) : (
              <div className="glass-card rounded-xl border border-primary/10 overflow-hidden">
                <table className="w-full text-xs font-body">
                  <thead>
                    <tr className="border-b border-primary/10 bg-muted/20">
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-[11px] uppercase tracking-wider w-8">#</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-[11px] uppercase tracking-wider">User 1</th>
                      <th className="text-center px-4 py-3 font-semibold text-muted-foreground text-[11px] uppercase tracking-wider w-12"></th>
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-[11px] uppercase tracking-wider">User 2</th>
                      <th className="text-center px-4 py-3 font-semibold text-muted-foreground text-[11px] uppercase tracking-wider hidden sm:table-cell">Tin nhắn</th>
                      <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-[11px] uppercase tracking-wider">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-primary/8">
                    {filteredMatches.map((match, i) => {
                      const p1 = profileMap[match.user1_id];
                      const p2 = profileMap[match.user2_id];
                      const msgCount = msgCountByMatch[match.id] || 0;
                      const statusLabel = {
                        matched: 'Matched',
                        team_invited: 'Đã mời',
                        team_joined: 'Trong đội',
                      }[match.status] || match.status;

                      return (
                        <tr key={match.id} className="hover:bg-primary/5 transition-colors">
                          <td className="px-4 py-3 text-xs text-muted-foreground/50">{i + 1}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-lg overflow-hidden border border-primary/20 bg-muted/50 flex-shrink-0">
                                {p1?.profile_image
                                  ? <img src={p1.profile_image} alt="" className="w-full h-full object-cover" />
                                  : <div className="w-full h-full flex items-center justify-center"><User className="w-4 h-4 text-primary/30" /></div>
                                }
                              </div>
                              <span className="font-medium text-sm text-foreground truncate max-w-[150px]">{p1?.display_name || match.user1_id.slice(0, 8)}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Heart className="w-4 h-4 text-pink-400 mx-auto" />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-lg overflow-hidden border border-primary/20 bg-muted/50 flex-shrink-0">
                                {p2?.profile_image
                                  ? <img src={p2.profile_image} alt="" className="w-full h-full object-cover" />
                                  : <div className="w-full h-full flex items-center justify-center"><User className="w-4 h-4 text-primary/30" /></div>
                                }
                              </div>
                              <span className="font-medium text-sm text-foreground truncate max-w-[150px]">{p2?.display_name || match.user2_id.slice(0, 8)}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center text-xs text-muted-foreground hidden sm:table-cell">
                            <span className="flex items-center justify-center gap-1">
                              <MessageCircle className="w-3.5 h-3.5" />
                              {msgCount}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className={`text-[11px] px-2.5 py-1 rounded-md font-medium ${
                              match.status === 'team_joined' ? 'text-primary bg-primary/10' :
                              match.status === 'team_invited' ? 'text-yellow-400 bg-yellow-400/10' :
                              'text-pink-400 bg-pink-400/10'
                            }`}>{statusLabel}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}