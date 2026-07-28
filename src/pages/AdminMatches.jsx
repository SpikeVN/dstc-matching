import { db } from '@/api/apiClient';

import React, { useState, useDeferredValue } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { Users, Search, Heart, MessageCircle, User, Shield, Eye, EyeOff, Flag, X, Clock, Trash2, Pencil, Settings, Ban, File, MailCheck, MailPlus, Upload } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { formatDateTime } from '@/lib/timeUtils';
import MatchDashboard from '@/components/admin/MatchDashboard';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
/** @type {Record<string, number>} Lower = more privilege */
const ROLE_HIERARCHY = { owner: 0, manager: 1, mod: 2, user: 3 };

const ADMIN_ROLES = [
  { value: 'owner', label: 'Owner', color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
  { value: 'manager', label: 'Quản lý', color: 'text-blue-400', bg: 'bg-blue-400/10' },
  { value: 'mod', label: 'Giám sát', color: 'text-purple-400', bg: 'bg-purple-400/10' },
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
  const { section = 'dashboard' } = useParams();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [roleFilterValue, setRoleFilterValue] = useState('');
  const [matchStatusFilter, setMatchStatusFilter] = useState('');
  const [selectedReport, setSelectedReport] = useState(null);
  const [reportDetailOpen, setReportDetailOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState(null); // { id, name } for rename
  const [renamingTeamId, setRenamingTeamId] = useState(null); // for rename
  const [renamingTeamValue, setRenamingTeamValue] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [bulkEmails, setBulkEmails] = useState('');
  const [showBulkAdd, setShowBulkAdd] = useState(false);
  const [noConfirmMode, setNoConfirmMode] = useState(false);
  const [noConfirmDialogOpen, setNoConfirmDialogOpen] = useState(false);
  const deferredSearch = useDeferredValue(search);

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => db.auth.me(),
  });

  const currentUserLevel = (ROLE_HIERARCHY)[currentUser?.admin_role] ?? 3;
  const canManageRoles = currentUserLevel < ROLE_HIERARCHY.user;
  const canManageWhitelist = currentUserLevel <= ROLE_HIERARCHY.manager; // manager+ (level 0-1)
  // Roles the current user is allowed to assign (strictly lower privilege, never owner)
  const assignableRoles = ADMIN_ROLES.filter(r => (ROLE_HIERARCHY)[r.value] > currentUserLevel && r.value !== 'owner');

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

  const { data: oneSidedSwipes } = useQuery({
    queryKey: ['adminOneSidedSwipes'],
    queryFn: () => db.entities.SwipeAction.list('-created_date'),
    initialData: [],
  });

  // ── Reports data ──────────────────────────────────────────────────
  const { data: reports, isLoading: loadingReports } = useQuery({
    queryKey: ['adminReports'],
    queryFn: () => db.admin.listReports(),
    initialData: [],
  });

  const { data: reportMessages } = useQuery({
    queryKey: ['adminReportMessages', selectedReport?.id],
    queryFn: () => db.admin.getReportMessages(selectedReport.id),
    enabled: !!selectedReport?.id,
    initialData: [],
  });

  // ── User management data ────────────────────────────────────────
  const { data: adminUsers, isLoading: loadingUsers } = useQuery({
    queryKey: ['adminUsers', roleFilterValue, deferredSearch],
    queryFn: () => db.admin.listUsers({ role: roleFilterValue === 'all' ? undefined : roleFilterValue || undefined, search: deferredSearch || undefined }),
    initialData: [],
    placeholderData: keepPreviousData,
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

  const deleteUserMutation = useMutation({
    mutationFn: (userId) => db.admin.deleteUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
    },
    onError: (error) => {
      toast.error(error.message || 'Không thể xóa người dùng');
    },
  });

  // ── Team management data ────────────────────────────────────────
  const { data: adminTeams, isLoading: loadingTeams } = useQuery({
    queryKey: ['adminTeams'],
    queryFn: () => db.admin.listTeams(),
    initialData: [],
  });

  const { data: systemSettings, isLoading: loadingSettings } = useQuery({
    queryKey: ['adminSettings'],
    queryFn: () => db.admin.getSettings(),
    initialData: {},
  });

  const { data: blockList, isLoading: loadingBlocks } = useQuery({
    queryKey: ['adminBlocks'],
    queryFn: () => db.admin.listBlocks(),
    initialData: [],
  });

  // ── Team mutations ──────────────────────────────────────────────
  const teamRenameMutation = useMutation({
    mutationFn: ({ id, name }) => db.admin.updateTeam(id, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminTeams'] });
      setRenamingTeamId(null);
      setRenamingTeamValue('');
    },
  });

  const teamDeleteMutation = useMutation({
    mutationFn: (id) => db.admin.deleteTeam(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminTeams'] });
    },
  });

  const settingsMutation = useMutation({
    mutationFn: ({ key, value }) => db.admin.updateSetting(key, value),
    onSuccess: (_data, variables) => {
      // Immediately update the cache so the toggle reflects the change
      queryClient.setQueryData(['adminSettings'], (old) => ({
        ...(old || {}),
        [variables.key]: variables.value,
      }));
      queryClient.invalidateQueries({ queryKey: ['adminSettings'] });
    },
  });

  // ── Whitelist data ──────────────────────────────────────────
  const { data: whitelistEntries, isLoading: loadingWhitelist } = useQuery({
    queryKey: ['adminWhitelist', deferredSearch],
    queryFn: () => db.admin.listWhitelist({ search: deferredSearch || undefined }),
    initialData: [],
    enabled: currentUser?.admin_role !== 'user',
  });

  const addWhitelistMutation = useMutation({
    mutationFn: (email) => db.admin.addWhitelistEmail(email),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['adminWhitelist'] }); },
    onError: (error) => toast.error(error.message || 'Không thể thêm email'),
  });

  const bulkAddWhitelistMutation = useMutation({
    mutationFn: (emails) => db.admin.bulkAddWhitelist(emails),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['adminWhitelist'] }); },
    onError: (error) => toast.error(error.message || 'Không thể thêm danh sách email'),
  });

  const removeWhitelistMutation = useMutation({
    mutationFn: (id) => db.admin.removeWhitelistEmail(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['adminWhitelist'] }); },
    onError: (error) => toast.error(error.message || 'Không thể xóa email'),
  });

  const clearWhitelistMutation = useMutation({
    mutationFn: () => db.admin.clearAllWhitelist(),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['adminWhitelist'] }); },
    onError: (error) => toast.error(error.message || 'Không thể xóa danh sách'),
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

  // Build one-sided swipe entries (liked but no match)
  const matchedPairKeys = new Set();
  matches.forEach(m => {
    matchedPairKeys.add(`${m.user1_id}:${m.user2_id}`);
    matchedPairKeys.add(`${m.user2_id}:${m.user1_id}`);
  });

  const donPhuongEntries = (oneSidedSwipes || [])
    .filter(sa => sa.action === 'like' && !sa.is_match && !matchedPairKeys.has(`${sa.swiper_id}:${sa.swiped_id}`))
    .map(sa => ({
      _type: 'don_phuong',
      id: sa.id,
      user1_id: sa.swiper_id,
      user2_id: sa.swiped_id,
      status: 'don_phuong',
      created_date: sa.created_date,
    }));

  const allEntries = [
    ...matches.map(m => ({ ...m, _type: 'match' })),
    ...donPhuongEntries,
  ];

  const filteredMatches = allEntries.filter(entry => {
    // Status filter
    if (matchStatusFilter && matchStatusFilter !== 'all' && entry.status !== matchStatusFilter) return false;
    // Search filter
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const p1 = profileMap[entry.user1_id];
    const p2 = profileMap[entry.user2_id];
    return (
      entry.user1_id?.toLowerCase().includes(q) ||
      entry.user2_id?.toLowerCase().includes(q) ||
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
        <Tabs value={section} onValueChange={(tab) => navigate(`/admin/${tab}`)}>
          <TabsList className="h-auto bg-transparent p-0 border-b border-primary/10 rounded-none w-full justify-start gap-0">
            {['dashboard', 'users', 'matches', 'reports', 'teams', 'blocks', 'whitelist', 'settings'].map(tab => {
              const icons = { dashboard: Shield, users: Users, matches: Heart, reports: Flag, teams: Users, blocks: Ban, whitelist: MailCheck, settings: Settings };
              const labels = { dashboard: 'Dashboard', users: 'Quản lý người dùng', matches: 'Matches', reports: 'Reports', teams: 'Đội', blocks: 'Chặn', whitelist: 'Whitelist', settings: 'Cài đặt' };
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
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/60 z-10" />
                <Input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Tìm theo tên, email..."
                  className="pl-9 bg-[rgba(10,18,11,0.75)] backdrop-blur-md border-primary/15 focus:border-primary/40 font-body text-sm"
                />
              </div>
              <Select value={roleFilterValue} onValueChange={setRoleFilterValue}>
                <SelectTrigger className="w-[140px] h-9 text-xs bg-[rgba(10,18,11,0.75)] backdrop-blur-md border-primary/15 text-foreground">
                  <SelectValue placeholder="Tất cả vai trò" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả vai trò</SelectItem>
                  <SelectItem value="owner">Owner</SelectItem>
                  <SelectItem value="manager">Quản lý</SelectItem>
                  <SelectItem value="mod">Giám sát</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* No-confirm toggle */}
            <div className="flex items-center gap-2 pb-1">
              <Switch
                id="no-confirm-mode"
                checked={noConfirmMode}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setNoConfirmDialogOpen(true);
                  } else {
                    setNoConfirmMode(false);
                  }
                }}
                className="data-[state=checked]:bg-destructive"
              />
              <label htmlFor="no-confirm-mode" className="text-xs font-body text-muted-foreground cursor-pointer select-none">
                Chế độ xóa nhanh <span className="text-destructive font-medium">(bỏ qua xác nhận)</span>
              </label>
            </div>

            <AlertDialog open={noConfirmDialogOpen} onOpenChange={setNoConfirmDialogOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Xác nhận chế độ xóa nhanh</AlertDialogTitle>
                  <AlertDialogDescription>
                    Bật chế độ xóa nhanh sẽ bỏ qua tất cả xác nhận khi xóa người dùng. Bạn có chắc chắn?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Hủy</AlertDialogCancel>
                  <AlertDialogAction onClick={() => setNoConfirmMode(true)}>Xác nhận</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

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
                      <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-[11px] uppercase tracking-wider hidden sm:table-cell">Sửa lần cuối</th>
                      <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-[11px] uppercase tracking-wider">Hành động</th>
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
                          {u.id === currentUser?.id ? (
                            <Select value={u.admin_role} disabled>
                              <SelectTrigger className="h-7 text-xs font-medium px-2 border border-primary/20 bg-transparent text-foreground gap-1 w-[96px] opacity-60 cursor-not-allowed">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {ADMIN_ROLES.filter(r => r.value === u.admin_role).map(r => (
                                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : u.admin_role === 'owner' ? (
                            <Select value="owner" disabled>
                              <SelectTrigger className="h-7 text-xs font-medium px-2 border border-primary/20 bg-transparent text-foreground gap-1 w-[96px] opacity-60 cursor-not-allowed">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="owner">Owner</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : canManageRoles ? (
                            <Select
                              value={u.admin_role}
                              onValueChange={role => roleMutation.mutate({ userId: u.id, role })}
                            >
                              <SelectTrigger className="h-7 text-xs font-medium px-2 border border-primary/20 bg-transparent text-foreground gap-1 w-[96px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {assignableRoles.map(r => (
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
                          {u.assigned_date ? formatDateTime(u.assigned_date, 'dd/MM/yy') : '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {u.id !== currentUser?.id && u.admin_role !== 'owner' && (
                            <button
                              onClick={() => {
                                if (noConfirmMode || window.confirm(`Xóa người dùng "${u.display_name || u.email}"? Hành động này không thể hoàn tác.`)) {
                                  deleteUserMutation.mutate(u.id);
                                }
                              }}
                              className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                              title="Xóa người dùng"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
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
            {/* Search and filters */}
            <div className="flex gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/60 z-10" />
                <Input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Tìm theo tên, email, trường..."
                  className="pl-9 bg-[rgba(10,18,11,0.75)] backdrop-blur-md border-primary/15 focus:border-primary/40 font-body text-sm"
                />
              </div>
              <Select value={matchStatusFilter} onValueChange={setMatchStatusFilter}>
                <SelectTrigger className="w-[140px] h-9 text-xs bg-[rgba(10,18,11,0.75)] backdrop-blur-md border-primary/15 text-foreground">
                  <SelectValue placeholder="Tất cả trạng thái" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả trạng thái</SelectItem>
                  <SelectItem value="matched">Matched</SelectItem>
                  <SelectItem value="team_invited">Đã mời</SelectItem>
                  <SelectItem value="team_joined">Trong đội</SelectItem>
                  <SelectItem value="don_phuong">Đơn phương</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Matches table */}
            {isLoading ? (
              <div className="text-center py-16">
                <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin mx-auto" />
              </div>
            ) : filteredMatches.length === 0 ? (
              <div className="text-center py-16">
                <p className="font-body text-sm text-muted-foreground">Không tìm thấy kết quả nào</p>
              </div>
            ) : (
              <div className="glass-card rounded-xl border border-primary/10 overflow-hidden">
                <table className="w-full text-xs font-body">
                  <thead>
                    <tr className="border-b border-primary/10 bg-muted/20">
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-[11px] uppercase tracking-wider w-8">#</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-[11px] uppercase tracking-wider">User 1</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-[11px] uppercase tracking-wider">User 2</th>
                      <th className="text-center px-4 py-3 font-semibold text-muted-foreground text-[11px] uppercase tracking-wider hidden sm:table-cell">Số tin nhắn</th>
                      <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-[11px] uppercase tracking-wider">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-primary/8">
                    {filteredMatches.map((entry, i) => {
                      const p1 = profileMap[entry.user1_id];
                      const p2 = profileMap[entry.user2_id];
                      const msgCount = msgCountByMatch[entry.id] || 0;
                      /** @type {Record<string, string>} */
                      const statusStyles = {
                        matched: 'text-pink-400 bg-pink-400/10',
                        team_invited: 'text-yellow-400 bg-yellow-400/10',
                        team_joined: 'text-primary bg-primary/10',
                        don_phuong: 'text-orange-400 bg-orange-400/10',
                      };
                      /** @type {Record<string, string>} */
                      const statusLabels = {
                        matched: 'Matched',
                        team_invited: 'Đã mời',
                        team_joined: 'Trong đội',
                        don_phuong: 'Đơn phương',
                      };

                      return (
                        <tr key={entry.id} className="hover:bg-primary/5 transition-colors">
                          <td className="px-4 py-3 text-xs text-muted-foreground/50">{i + 1}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-lg overflow-hidden border border-primary/20 bg-muted/50 flex-shrink-0">
                                {p1?.profile_image
                                  ? <img src={p1.profile_image} alt="" className="w-full h-full object-cover" />
                                  : <div className="w-full h-full flex items-center justify-center"><User className="w-4 h-4 text-primary/30" /></div>
                                }
                              </div>
                              <span className="font-medium text-sm text-foreground truncate max-w-[150px]">{p1?.display_name || entry.user1_id.slice(0, 8)}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-lg overflow-hidden border border-primary/20 bg-muted/50 flex-shrink-0">
                                {p2?.profile_image
                                  ? <img src={p2.profile_image} alt="" className="w-full h-full object-cover" />
                                  : <div className="w-full h-full flex items-center justify-center"><User className="w-4 h-4 text-primary/30" /></div>
                                }
                              </div>
                              <span className="font-medium text-sm text-foreground truncate max-w-[150px]">{p2?.display_name || entry.user2_id.slice(0, 8)}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center text-xs text-muted-foreground hidden sm:table-cell">
                            <span className="flex items-center justify-center gap-1">
                              <MessageCircle className="w-3.5 h-3.5" />
                              {msgCount}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className={`text-[11px] px-2.5 py-1 rounded-md font-medium ${statusStyles[entry.status] || ''}`}>
                              {statusLabels[entry.status] || entry.status}
                            </span>
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

          <TabsContent value="reports" className="mt-5">
          <div className="space-y-4">
            <p className="font-body text-xs text-muted-foreground">Tổng số báo cáo: {reports.length}</p>

            {loadingReports ? (
              <div className="text-center py-16">
                <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin mx-auto" />
              </div>
            ) : reports.length === 0 ? (
              <div className="text-center py-16">
                <Flag className="w-10 h-10 text-primary/10 mx-auto mb-3" />
                <p className="font-body text-sm text-muted-foreground">Chưa có báo cáo nào</p>
              </div>
            ) : (
              <div className="glass-card rounded-xl border border-primary/10 overflow-hidden">
                <table className="w-full text-xs font-body">
                  <thead>
                    <tr className="border-b border-primary/10 bg-muted/20">
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-[11px] uppercase tracking-wider w-8">#</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-[11px] uppercase tracking-wider">Người báo cáo</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-[11px] uppercase tracking-wider">Bị báo cáo</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-[11px] uppercase tracking-wider hidden md:table-cell">Lý do</th>
                      <th className="text-center px-4 py-3 font-semibold text-muted-foreground text-[11px] uppercase tracking-wider">Tin nhắn</th>
                      <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-[11px] uppercase tracking-wider hidden sm:table-cell">Ngày</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-primary/8">
                    {reports.map((report, i) => (
                      <tr
                        key={report.id}
                        className="hover:bg-primary/5 transition-colors cursor-pointer"
                        onClick={() => {
                          setSelectedReport(report);
                          setReportDetailOpen(true);
                        }}
                      >
                        <td className="px-4 py-3 text-xs text-muted-foreground/50">{i + 1}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg overflow-hidden border border-primary/20 bg-muted/50 flex-shrink-0">
                              {report.reporter_image
                                ? <img src={report.reporter_image} alt="" className="w-full h-full object-cover" />
                                : <div className="w-full h-full flex items-center justify-center"><User className="w-4 h-4 text-primary/30" /></div>
                              }
                            </div>
                            <span className="font-medium text-sm text-foreground truncate max-w-[150px]">{report.reporter_name || report.reporter_id.slice(0, 8)}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg overflow-hidden border border-primary/20 bg-muted/50 flex-shrink-0">
                              {report.reported_image
                                ? <img src={report.reported_image} alt="" className="w-full h-full object-cover" />
                                : <div className="w-full h-full flex items-center justify-center"><User className="w-4 h-4 text-primary/30" /></div>
                              }
                            </div>
                            <span className="font-medium text-sm text-foreground truncate max-w-[150px] text-red-400">{report.reported_name || report.reported_id.slice(0, 8)}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground max-w-[250px] truncate hidden md:table-cell">
                          {report.reason || <span className="italic text-muted-foreground/50">Không có lý do</span>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                            <MessageCircle className="w-3.5 h-3.5" />
                            {report.message_count || 0}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-muted-foreground/50 hidden sm:table-cell">
                          {report.created_date ? formatDateTime(report.created_date, 'dd/MM/yy HH:mm') : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          </TabsContent>

          {/* ── Teams tab ──────────────────────────────────────────── */}
          <TabsContent value="teams" className="mt-5">
          <div className="space-y-4">
            <p className="font-body text-xs text-muted-foreground">Tổng số đội: {adminTeams.length}</p>

            {loadingTeams ? (
              <div className="text-center py-16">
                <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin mx-auto" />
              </div>
            ) : adminTeams.length === 0 ? (
              <div className="text-center py-16">
                <Users className="w-10 h-10 text-primary/10 mx-auto mb-3" />
                <p className="font-body text-sm text-muted-foreground">Chưa có đội nào</p>
              </div>
            ) : (
              <div className="glass-card rounded-xl border border-primary/10 overflow-hidden">
                <table className="w-full text-xs font-body">
                  <thead>
                    <tr className="border-b border-primary/10 bg-muted/20">
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-[11px] uppercase tracking-wider w-8">#</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-[11px] uppercase tracking-wider">Tên đội</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-[11px] uppercase tracking-wider">Trưởng nhóm</th>
                      <th className="text-center px-4 py-3 font-semibold text-muted-foreground text-[11px] uppercase tracking-wider">Thành viên</th>
                      <th className="text-center px-4 py-3 font-semibold text-muted-foreground text-[11px] uppercase tracking-wider">Trạng thái</th>
                      <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-[11px] uppercase tracking-wider">Hành động</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-primary/8">
                    {adminTeams.map((team, i) => (
                      <tr key={team.id} className="hover:bg-primary/5 transition-colors">
                        <td className="px-4 py-3 text-xs text-muted-foreground/50">{i + 1}</td>
                        <td className="px-4 py-3">
                          {renamingTeamId === team.id ? (
                            <div className="flex items-center gap-2">
                              <Input
                                value={renamingTeamValue}
                                onChange={e => setRenamingTeamValue(e.target.value)}
                                className="text-xs h-7 w-32 bg-muted/50 border-primary/20"
                                onKeyDown={e => {
                                  if (e.key === 'Enter' && renamingTeamValue.trim()) {
                                    teamRenameMutation.mutate({ id: team.id, name: renamingTeamValue.trim() });
                                  }
                                  if (e.key === 'Escape') setRenamingTeamId(null);
                                }}
                                autoFocus
                              />
                              <Button size="sm" className="h-7 text-[10px] px-2 bg-primary text-background"
                                onClick={() => renamingTeamValue.trim() && teamRenameMutation.mutate({ id: team.id, name: renamingTeamValue.trim() })}>
                                Lưu
                              </Button>
                            </div>
                          ) : (
                            <span className="font-medium text-sm text-foreground">{team.name}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-md overflow-hidden border border-primary/20 bg-muted/50 flex-shrink-0">
                              {team.leader_image
                                ? <img src={team.leader_image} alt="" className="w-full h-full object-cover" />
                                : <div className="w-full h-full flex items-center justify-center"><User className="w-3 h-3 text-primary/30" /></div>
                              }
                            </div>
                            <span className="text-xs text-foreground truncate max-w-[120px]">{team.leader_name || team.leader_id.slice(0, 8)}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center text-xs text-muted-foreground">
                          {(team.member_ids || []).length}/{team.max_members || 2}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-[11px] px-2.5 py-1 rounded-md font-medium ${
                            team.status === 'forming' ? 'text-yellow-400 bg-yellow-400/10' :
                            team.status === 'full' ? 'text-primary bg-primary/10' :
                            team.status === 'locked' ? 'text-red-400 bg-red-400/10' : ''
                          }`}>
                            {team.status === 'forming' ? 'Đang thành lập' :
                             team.status === 'full' ? 'Đủ thành viên' :
                             team.status === 'locked' ? 'Đã khóa' : team.status}
                          </span>
                          {team.disband_initiated_by && (
                            <span className="ml-1 text-[10px] text-amber-400">(đang giải tán)</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => { setRenamingTeamId(team.id); setRenamingTeamValue(team.name); }}
                              className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                              title="Đổi tên"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                if (window.confirm(`Xóa đội "${team.name}"?`)) {
                                  teamDeleteMutation.mutate(team.id);
                                }
                              }}
                              className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                              title="Xóa đội"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          </TabsContent>

          {/* ── Blocks tab ──────────────────────────────────────────── */}
          <TabsContent value="blocks" className="mt-5">
          <div className="space-y-4">
            <p className="font-body text-xs text-muted-foreground">Tổng số chặn: {blockList.length}</p>

            {loadingBlocks ? (
              <div className="text-center py-16">
                <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin mx-auto" />
              </div>
            ) : blockList.length === 0 ? (
              <div className="text-center py-16">
                <Ban className="w-10 h-10 text-primary/10 mx-auto mb-3" />
                <p className="font-body text-sm text-muted-foreground">Chưa có ai bị chặn</p>
              </div>
            ) : (
              <div className="glass-card rounded-xl border border-primary/10 overflow-hidden">
                <table className="w-full text-xs font-body">
                  <thead>
                    <tr className="border-b border-primary/10 bg-muted/20">
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-[11px] uppercase tracking-wider w-8">#</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-[11px] uppercase tracking-wider">Người chặn</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-[11px] uppercase tracking-wider">Bị chặn</th>
                      <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-[11px] uppercase tracking-wider hidden sm:table-cell">Ngày</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-primary/8">
                    {blockList.map((block, i) => (
                      <tr key={block.id} className="hover:bg-primary/5 transition-colors">
                        <td className="px-4 py-3 text-xs text-muted-foreground/50">{i + 1}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg overflow-hidden border border-primary/20 bg-muted/50 flex-shrink-0">
                              {block.blocker_image
                                ? <img src={block.blocker_image} alt="" className="w-full h-full object-cover" />
                                : <div className="w-full h-full flex items-center justify-center"><User className="w-4 h-4 text-primary/30" /></div>
                              }
                            </div>
                            <span className="font-medium text-sm text-foreground truncate max-w-[150px]">{block.blocker_name || block.blocker_id.slice(0, 8)}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg overflow-hidden border border-primary/20 bg-muted/50 flex-shrink-0">
                              {block.blocked_image
                                ? <img src={block.blocked_image} alt="" className="w-full h-full object-cover" />
                                : <div className="w-full h-full flex items-center justify-center"><User className="w-4 h-4 text-primary/30" /></div>
                              }
                            </div>
                            <span className="font-medium text-sm text-foreground truncate max-w-[150px]">{block.blocked_name || block.blocked_id.slice(0, 8)}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-muted-foreground/50 hidden sm:table-cell">
                          {block.created_date ? formatDateTime(block.created_date, 'dd/MM/yy HH:mm') : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          </TabsContent>

          {/* ── Whitelist tab ────────────────────────────────────────── */}
          <TabsContent value="whitelist" className="mt-5">
          <div className="space-y-4">
            {/* Header with actions */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <p className="font-body text-xs text-muted-foreground">
                Tổng số email trong danh sách: {whitelistEntries.length}
              </p>
              <div className="flex gap-2">
                {canManageWhitelist && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => setShowBulkAdd(!showBulkAdd)}
                    >
                      <Upload className="w-3.5 h-3.5 mr-1" />
                      Thêm hàng loạt
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                      onClick={() => {
                        if (window.confirm(`Xóa tất cả ${whitelistEntries.length} email khỏi danh sách cho phép?`)) {
                          clearWhitelistMutation.mutate();
                        }
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1" />
                      Xóa tất cả
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Single email add form */}
            {canManageWhitelist && !showBulkAdd && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (newEmail.trim()) {
                    addWhitelistMutation.mutate(newEmail.trim(), {
                      onSuccess: () => setNewEmail(''),
                    });
                  }
                }}
                className="flex gap-2"
              >
                <Input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="Nhập email để thêm..."
                  className="max-w-sm h-9 text-sm bg-[rgba(10,18,11,0.75)] backdrop-blur-md border-primary/15"
                />
                <Button type="submit" size="sm" className="h-9 text-xs" disabled={addWhitelistMutation.isPending}>
                  <MailPlus className="w-3.5 h-3.5 mr-1" />
                  Thêm
                </Button>
              </form>
            )}

            {/* Bulk add form */}
            {canManageWhitelist && showBulkAdd && (
              <div className="glass-card rounded-lg border border-primary/10 p-4 space-y-3">
                <p className="text-xs text-muted-foreground">
                  Nhập danh sách email, mỗi email một dòng hoặc cách nhau bằng dấu phẩy
                </p>
                <textarea
                  value={bulkEmails}
                  onChange={(e) => setBulkEmails(e.target.value)}
                  placeholder={`email1@example.com\nemail2@example.com\nemail3@example.com`}
                  rows={5}
                  className="w-full text-sm bg-[rgba(10,18,11,0.75)] backdrop-blur-md border border-primary/15 rounded-lg p-3 text-foreground font-body resize-none focus:outline-none focus:border-primary/40"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => {
                      const emails = bulkEmails
                        .split(/[\n,]+/)
                        .map(e => e.trim())
                        .filter(e => e.includes('@'));
                      if (emails.length > 0) {
                        bulkAddWhitelistMutation.mutate(emails, {
                          onSuccess: () => { setBulkEmails(''); setShowBulkAdd(false); },
                        });
                      }
                    }}
                    disabled={bulkAddWhitelistMutation.isPending}
                  >
                    <Upload className="w-3.5 h-3.5 mr-1" />
                    Thêm {bulkEmails.split(/[\n,]+/).filter(e => e.includes('@')).length} email
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 text-xs"
                    onClick={() => { setShowBulkAdd(false); setBulkEmails(''); }}>
                    Hủy
                  </Button>
                </div>
              </div>
            )}

            {/* Search */}
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/60 z-10" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Tìm email..."
                className="pl-9 bg-[rgba(10,18,11,0.75)] backdrop-blur-md border-primary/15 focus:border-primary/40 font-body text-sm"
              />
            </div>

            {/* Whitelist table */}
            {loadingWhitelist ? (
              <div className="text-center py-16">
                <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin mx-auto" />
              </div>
            ) : whitelistEntries.length === 0 ? (
              <div className="text-center py-16">
                <MailCheck className="w-10 h-10 text-primary/10 mx-auto mb-3" />
                <p className="font-body text-sm text-muted-foreground">Chưa có email nào trong danh sách cho phép</p>
                <p className="font-body text-xs text-muted-foreground/50 mt-1">
                  Khi danh sách trống, tất cả email đều được phép đăng ký
                </p>
              </div>
            ) : (
              <div className="glass-card rounded-xl border border-primary/10 overflow-hidden">
                <table className="w-full text-xs font-body">
                  <thead>
                    <tr className="border-b border-primary/10 bg-muted/20">
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-[11px] uppercase tracking-wider w-8">#</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-[11px] uppercase tracking-wider">Email</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-[11px] uppercase tracking-wider hidden sm:table-cell">Người thêm</th>
                      <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-[11px] uppercase tracking-wider hidden sm:table-cell">Ngày thêm</th>
                      {canManageWhitelist && (
                        <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-[11px] uppercase tracking-wider">Hành động</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-primary/8">
                    {whitelistEntries.map((entry, i) => (
                      <tr key={entry.id} className="hover:bg-primary/5 transition-colors">
                        <td className="px-4 py-3 text-xs text-muted-foreground/50">{i + 1}</td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-foreground font-medium">{entry.email}</span>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground hidden sm:table-cell">
                          {entry.added_by_name || <span className="text-muted-foreground/50">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-muted-foreground/50 hidden sm:table-cell">
                          {entry.created_date ? formatDateTime(entry.created_date, 'dd/MM/yy HH:mm') : '—'}
                        </td>
                        {canManageWhitelist && (
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => {
                                if (window.confirm(`Xóa "${entry.email}" khỏi danh sách?`)) {
                                  removeWhitelistMutation.mutate(entry.id);
                                }
                              }}
                              className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                              title="Xóa email"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          </TabsContent>

          {/* ── Settings tab ────────────────────────────────────────── */}
          <TabsContent value="settings" className="mt-5">
          <div className="space-y-4">
            <div className="glass-card rounded-xl border border-primary/10 overflow-hidden">
              <div className="px-4 py-3 border-b border-primary/10 flex items-center gap-2">
                <Settings className="w-4 h-4 text-primary" />
                <h3 className="font-display text-sm font-semibold text-primary">Cài đặt hệ thống</h3>
              </div>
              <div className="p-4 space-y-4">
                {loadingSettings ? (
                  <div className="text-center py-8">
                    <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin mx-auto" />
                  </div>
                ) : (
                  <>
                  {/* ── Global matching toggle ──────────────────── */}
                  <div className="flex items-center justify-between pb-4 border-b border-primary/10">
                    <div>
                      <p className="text-sm font-medium text-foreground">Tạm dừng Matching</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Khi bật, tất cả thao tác matching, tạo đội, giải tán đội và lời mời sẽ bị từ chối
                      </p>
                    </div>
                    <Switch
                      checked={systemSettings.matching_disabled === true}
                      onCheckedChange={(checked) => {
                        settingsMutation.mutate({ key: 'matching_disabled', value: checked });
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">Yêu cầu đồng ý khi giải tán đội</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Khi bật, cần phải có xác nhận của thành viên còn lại trước khi giải tán đội
                      </p>
                    </div>
                    <Switch
                      checked={systemSettings.require_disband_consent === true}
                      onCheckedChange={(checked) => {
                        settingsMutation.mutate({ key: 'require_disband_consent', value: checked });
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">Số thành viên tối đa mỗi đội</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Áp dụng cho các đội mới được tạo sau khi thay đổi
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={2}
                        max={10}
                        value={systemSettings.team_max_members ?? 2}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          if (val >= 2 && val <= 10) {
                            settingsMutation.mutate({ key: 'team_max_members', value: val });
                          }
                        }}
                        className="w-16 h-9 text-center text-sm font-medium bg-black/30 border border-primary/20 rounded-lg text-foreground focus:outline-none focus:border-primary/50"
                      />
                      <span className="text-xs text-muted-foreground">thành viên</span>
                    </div>
                  </div>

                  {/* ── Separator ─────────────────────────── */}
                  <div className="border-t border-primary/10 pt-4">
                    <p className="text-sm font-semibold text-foreground mb-3">Phương thức đăng ký</p>

                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="text-sm font-medium text-foreground">Email</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Cho phép đăng ký bằng email và mật khẩu
                        </p>
                      </div>
                      <Switch
                        checked={systemSettings.signup_email_enabled !== false}
                        onCheckedChange={(checked) => {
                          settingsMutation.mutate({ key: 'signup_email_enabled', value: checked });
                        }}
                      />
                    </div>

                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="text-sm font-medium text-foreground">Google</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Cho phép đăng ký bằng tài khoản Google
                        </p>
                      </div>
                      <Switch
                        checked={systemSettings.signup_google_enabled !== false}
                        onCheckedChange={(checked) => {
                          settingsMutation.mutate({ key: 'signup_google_enabled', value: checked });
                        }}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-foreground">GitHub</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Cho phép đăng ký bằng tài khoản GitHub
                        </p>
                      </div>
                      <Switch
                        checked={systemSettings.signup_github_enabled !== false}
                        onCheckedChange={(checked) => {
                          settingsMutation.mutate({ key: 'signup_github_enabled', value: checked });
                        }}
                      />
                    </div>
                  </div>
                  </>
                )}
              </div>
            </div>
          </div>
          </TabsContent>

        </Tabs>

        {/* Report detail dialog */}
        <Dialog open={reportDetailOpen} onOpenChange={setReportDetailOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Flag className="w-4 h-4 text-red-400" />
                Chi tiết báo cáo
              </DialogTitle>
              <DialogDescription>
                Thông tin về báo cáo và nội dung chat liên quan
              </DialogDescription>
            </DialogHeader>
            {selectedReport && (() => {
              const reportedInUsers = adminUsers.find(u => u.id === selectedReport.reported_id);
              const reportedVisible = reportedInUsers ? reportedInUsers.admin_visible : true;
              return (
              <div className="flex-1 overflow-hidden flex flex-col gap-4">
                {/* Reporter and Reported info */}
                <div className="flex items-stretch gap-4 text-sm">
                  <div className="flex-1 glass-card rounded-lg p-3 border border-primary/10 flex flex-col">
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">Người báo cáo</p>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg overflow-hidden border border-primary/20 bg-muted/50 flex-shrink-0">
                        {selectedReport.reporter_image
                          ? <img src={selectedReport.reporter_image} alt="" className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center"><User className="w-3.5 h-3.5 text-primary/30" /></div>
                        }
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{selectedReport.reporter_name || 'Unknown'}</p>
                        <p className="text-[11px] text-muted-foreground">{selectedReport.reporter_email}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 glass-card rounded-lg p-3 border border-red-400/15 flex flex-col">
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">Bị báo cáo</p>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg overflow-hidden border border-primary/20 bg-muted/50 flex-shrink-0">
                        {selectedReport.reported_image
                          ? <img src={selectedReport.reported_image} alt="" className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center"><User className="w-3.5 h-3.5 text-primary/30" /></div>
                        }
                      </div>
                      <div>
                        <p className="font-medium text-red-400">{selectedReport.reported_name || 'Unknown'}</p>
                        <p className="text-[11px] text-muted-foreground">{selectedReport.reported_email}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Reason */}
                <div className="glass-card rounded-lg p-3 border border-primary/10">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">Lý do</p>
                  <p className="text-sm text-foreground whitespace-pre-wrap">
                    {selectedReport.reason || <span className="italic text-muted-foreground/50">Không có lý do</span>}
                  </p>
                </div>

                {/* Attachment */}
                {selectedReport.attachment_url && (
                  <div className="glass-card rounded-lg p-3 border border-primary/10">
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">Tệp đính kèm</p>
                    <a
                      href={selectedReport.attachment_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-primary hover:underline"
                    >
                      <File className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate">{selectedReport.attachment_name || 'Tải xuống tệp'}</span>
                    </a>
                  </div>
                )}

                {/* Quick actions */}
                <div className="glass-card rounded-lg p-3 border border-primary/10">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-2">Quick actions</p>
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => {
                        visibilityMutation.mutate({
                          userId: selectedReport.reported_id,
                          visible: !reportedVisible,
                        });
                      }}
                      className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-all ${
                        reportedVisible
                          ? 'border-primary/20 text-foreground hover:bg-primary/10 hover:border-primary/40'
                          : 'border-primary/40 text-primary bg-primary/10'
                      }`}
                    >
                      {reportedVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      {reportedVisible ? 'Ẩn khỏi matching' : 'Hiện lại trong matching'}
                    </button>
                  </div>
                </div>

                {/* Chat log */}
                {selectedReport.match_id && (
                  <div className="flex-1 min-h-0">
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <MessageCircle className="w-3.5 h-3.5" />
                      Nội dung chat ({reportMessages.length} tin nhắn)
                    </p>
                    <ScrollArea className="h-[300px] rounded-lg border border-primary/10 p-4">
                      <div className="space-y-3">
                        {reportMessages.length === 0 ? (
                          <p className="text-xs text-muted-foreground/50 text-center py-8">Chưa có tin nhắn nào</p>
                        ) : (
                          reportMessages.map(msg => (
                            <div key={msg.id} className="flex gap-3">
                              <div className="w-7 h-7 rounded-md overflow-hidden border border-primary/10 bg-muted/50 flex-shrink-0 mt-0.5">
                                {msg.sender_image
                                  ? <img src={msg.sender_image} alt="" className="w-full h-full object-cover" />
                                  : <div className="w-full h-full flex items-center justify-center"><User className="w-3 h-3 text-primary/30" /></div>
                                }
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-baseline gap-2">
                                  <span className="text-xs font-medium text-foreground">
                                    {msg.sender_name || msg.sender_id.slice(0, 8)}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground/50">
                                    {formatDateTime(msg.created_date, 'dd/MM HH:mm')}
                                  </span>
                                </div>
                                <p className="text-sm text-foreground mt-0.5 whitespace-pre-wrap break-words">
                                  {msg.content}
                                </p>
                                {msg.attachment_url && (
                                  <div className="mt-1 flex items-center gap-1.5 text-xs text-primary/70">
                                    <span>📎</span>
                                    <a href={msg.attachment_url} target="_blank" rel="noopener noreferrer" className="hover:underline truncate">
                                      {msg.attachment_name || 'Tệp đính kèm'}
                                    </a>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                )}

                {!selectedReport.match_id && (
                  <div className="glass-card rounded-lg p-4 border border-primary/10 text-center">
                    <p className="text-xs text-muted-foreground">Báo cáo này không liên kết với match nào</p>
                  </div>
                )}
              </div>
            );
            })()}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}