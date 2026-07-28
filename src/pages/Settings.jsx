import { db } from '@/api/apiClient';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { LogOut, Terminal, Eye, KeyRound, Activity, Clock, Heart, UserCheck, Shield, FileText, HelpCircle, Info, Users, User, Check, X, Github, Bell, Trash2, MessageCircle, UserPlus, UserMinus, Award } from 'lucide-react';

import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import TermsContent from '/docs/terms.mdx';
import SupportContent from '/docs/support.mdx';
import AboutContent from '/docs/about.mdx';
import CreditsContent from '/docs/credits.mdx';

const TABS = [
  { id: 'password', label: 'Bảo mật', icon: KeyRound },
  { id: 'privacy', label: 'Quyền riêng tư', icon: Eye },
  { id: 'activity', label: 'Nhật ký', icon: Activity },
  { id: 'terms', label: 'Điều khoản', icon: FileText },
  { id: 'support', label: 'Hỗ trợ', icon: HelpCircle },
  { id: 'credits', label: 'Credits', icon: Award },
  { id: 'about', label: 'Về CTE & DSTC', icon: Info },
  { id: 'notifications', label: 'Thông báo', icon: Bell, mobileOnly: true },
];

function PrivacyToggle({ label, desc, checked, onChange }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-primary/8 last:border-0">
      <div className="flex-1 pr-4">
        <p className="text-sm font-body text-foreground">{label}</p>
        {desc && <p className="text-xs font-body text-muted-foreground mt-0.5">{desc}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} className="data-[state=checked]:bg-primary" />
    </div>
  );
}

function ActivityItem({ icon: Icon, title, desc, time, color = 'text-primary' }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-primary/8 last:border-0">
      <div className={`w-8 h-8 rounded-lg bg-primary/8 flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-body text-foreground">{title}</p>
        <p className="text-xs font-body text-muted-foreground mt-0.5">{desc}</p>
      </div>
      <span className="text-[10px] font-body text-muted-foreground/60 flex-shrink-0 flex items-center gap-1">
        <Clock className="w-3 h-3" /> {time}
      </span>
    </div>
  );
}

const NOTIF_ICONS_MAP = {
  new_message: MessageCircle,
  new_match: Heart,
  team_invite: UserPlus,
  team_invite_accepted: UserPlus,
  team_invite_rejected: UserMinus,
  disband_request: LogOut,
  disband_accepted: Users,
  disband_rejected: X,
};

const NOTIF_COLORS_MAP = {
  new_message: 'text-blue-400',
  new_match: 'text-pink-400',
  team_invite: 'text-primary',
  team_invite_accepted: 'text-primary',
  team_invite_rejected: 'text-orange-400',
  disband_request: 'text-red-400',
  disband_accepted: 'text-red-400',
  disband_rejected: 'text-muted-foreground',
};

function NotificationsTabContent({ currentUser }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: notifications } = useQuery({
    queryKey: ['notifications', currentUser?.id],
    queryFn: () => db.notifications.list(),
    initialData: [],
    enabled: !!currentUser,
  });

  const handleMarkAllRead = async () => {
    await db.notifications.clearAll();
    queryClient.invalidateQueries({ queryKey: ['notifications', currentUser?.id] });
    queryClient.invalidateQueries({ queryKey: ['notificationsUnread', currentUser?.id] });
  };

  const handleItemClick = (notif) => {
    db.notifications.markRead([notif.id]);
    queryClient.invalidateQueries({ queryKey: ['notifications', currentUser?.id] });
    queryClient.invalidateQueries({ queryKey: ['notificationsUnread', currentUser?.id] });

    switch (notif.type) {
      case 'new_message':
        navigate('/messages');
        break;
      case 'new_match':
        navigate(notif.data?.match_id ? `/messages?match=${notif.data.match_id}` : '/messages');
        break;
      default:
        navigate('/team');
    }
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now - d) / 60000);
    if (diff < 60) return `${diff}p trước`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h trước`;
    return `${Math.floor(diff / 1440)}d trước`;
  };

  return (
    <div className="glass-card rounded-xl border border-primary/10 overflow-hidden">
      <div className="px-4 py-3 border-b border-primary/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-primary" />
          <h3 className="font-display text-sm font-semibold text-primary">Thông báo</h3>
        </div>
        {notifications.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleMarkAllRead}
            className="h-7 text-xs font-body text-muted-foreground hover:text-primary gap-1"
          >
            <Trash2 className="w-3 h-3" /> Đã đọc tất cả
          </Button>
        )}
      </div>
      <div className="p-4">
        {notifications.length === 0 ? (
          <div className="py-8 text-center">
            <Bell className="w-8 h-8 text-primary/15 mx-auto mb-2" />
            <p className="text-sm font-body text-muted-foreground">Không có thông báo</p>
          </div>
        ) : (
          <div className="space-y-1">
            {notifications.map((notif) => {
              const Icon = NOTIF_ICONS_MAP[notif.type] || Bell;
              const color = NOTIF_COLORS_MAP[notif.type] || 'text-primary';
              return (
                <button
                  key={notif.id}
                  onClick={() => handleItemClick(notif)}
                  className={`w-full flex items-start gap-3 p-3 rounded-lg hover:bg-primary/5 transition-colors text-left ${!notif.is_read ? 'bg-primary/[0.03]' : ''
                    }`}
                >
                  <div className={`w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 ${color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-body leading-tight ${notif.is_read ? 'text-muted-foreground' : 'text-foreground font-medium'}`}>
                      {notif.title}
                    </p>
                    {notif.body && (
                      <p className="text-xs font-body text-muted-foreground mt-0.5 truncate">{notif.body}</p>
                    )}
                  </div>
                  <span className="text-[10px] font-body text-muted-foreground/60 flex-shrink-0 mt-1">
                    {formatTime(notif.created_date)}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Settings() {
  const { logout } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { section = 'password' } = useParams();
  const activeTab = section;
  const [privacy, setPrivacy] = useState({
    showAge: true,
    showGender: true,
    showCity: true,
    showSchool: true,
    showMajor: true,
    showAchievements: true,
  });
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [pwMsg, setPwMsg] = useState('');
  const [usernameForm, setUsernameForm] = useState('');
  const [usernameMsg, setUsernameMsg] = useState('');
  const [usernameLoading, setUsernameLoading] = useState(false);

  // Map backend snake_case keys to frontend camelCase
  const backendToFrontend = {
    show_age: 'showAge',
    show_gender: 'showGender',
    show_location: 'showCity',
    show_school: 'showSchool',
    show_major: 'showMajor',
    show_achievements: 'showAchievements',
  };
  const frontendToBackend = Object.fromEntries(
    Object.entries(backendToFrontend).map(([k, v]) => [v, k])
  );

  const { data: matches } = useQuery({
    queryKey: ['matchesForActivity'],
    queryFn: async () => {
      const me = await db.auth.me();
      const [m1, m2] = await Promise.all([
        db.entities.Match.filter({ user1_id: me.id }),
        db.entities.Match.filter({ user2_id: me.id }),
      ]);
      return [...m1, ...m2].sort((a, b) => new Date(b.created_date) - new Date(a.created_date)).slice(0, 8);
    },
    initialData: [],
  });

  const { data: allProfiles } = useQuery({
    queryKey: ['allProfilesForActivity'],
    queryFn: () => db.entities.ContestantProfile.list(),
    initialData: [],
  });
  const profileMap = {};
  allProfiles.forEach((p) => { profileMap[p.created_by] = p; });

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => db.auth.me(),
  });

  // Initialize username form when currentUser loads
  useEffect(() => {
    if (currentUser?.username && !usernameForm) {
      setUsernameForm(currentUser.username);
    }
  }, [currentUser?.username]);

  // Initialize privacy settings from server
  useEffect(() => {
    if (currentUser?.info_shown) {
      const mapped = {};
      for (const [backendKey, frontendKey] of Object.entries(backendToFrontend)) {
        mapped[frontendKey] = currentUser.info_shown[backendKey] ?? true;
      }
      setPrivacy(mapped);
    }
  }, [currentUser?.info_shown]);

  // Save privacy settings to server
  const handlePrivacyChange = async (frontendKey, value) => {
    setPrivacy((p) => ({ ...p, [frontendKey]: value }));
    const newPrivacy = { ...privacy, [frontendKey]: value };
    const backendPayload = {};
    for (const [fk, bk] of Object.entries(frontendToBackend)) {
      backendPayload[bk] = newPrivacy[fk];
    }
    try {
      await db.auth.updateInfoShown(backendPayload);
      queryClient.invalidateQueries({ queryKey: ['allProfiles'] });
    } catch (err) {
      console.error('Failed to save privacy settings:', err);
    }
  };

  const handlePasswordChange = async () => {
    if (!pwForm.current) { setPwMsg('Vui lòng nhập mật khẩu hiện tại'); return; }
    if (pwForm.next.length < 6) { setPwMsg('Mật khẩu mới ít nhất 6 ký tự'); return; }
    if (pwForm.next !== pwForm.confirm) { setPwMsg('Mật khẩu xác nhận không khớp'); return; }
    setPwMsg('');
    try {
      await db.auth.changePassword(pwForm.current, pwForm.next);
      setPwMsg('✓ Đã đổi mật khẩu thành công');
      setPwForm({ current: '', next: '', confirm: '' });
    } catch (err) {
      setPwMsg(err.message || 'Không thể đổi mật khẩu');
    }
  };

  const handleUsernameChange = async () => {
    const username = usernameForm.trim();
    if (username.length < 3 || username.length > 20) {
      setUsernameMsg('Tên đăng nhập phải từ 3 đến 20 ký tự');
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      setUsernameMsg('Chỉ chứa chữ cái, số và dấu gạch dưới');
      return;
    }
    setUsernameLoading(true);
    setUsernameMsg('');
    try {
      await db.auth.updateUsername(username);
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
      setUsernameMsg('✓ Đã cập nhật tên đăng nhập');
    } catch (err) {
      setUsernameMsg(err.message || 'Không thể cập nhật tên đăng nhập');
    } finally {
      setUsernameLoading(false);
    }
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now - d) / 60000);
    if (diff < 60) return `${diff}p trước`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h trước`;
    return `${Math.floor(diff / 1440)}d trước`;
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'privacy':
        return (
          <div className="glass-card rounded-xl border border-primary/10 overflow-hidden">
            <div className="px-4 py-3 border-b border-primary/10 flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              <h3 className="font-display text-sm font-semibold text-primary">Thông tin hiển thị công khai</h3>
            </div>
            <div className="p-4">
              <p className="text-xs font-body text-muted-foreground mb-4 leading-relaxed">
                Chọn thông tin mà người dùng khác có thể xem trên hồ sơ của bạn trong quá trình tìm đồng đội.
              </p>
              <p className="text-[11px] font-body text-muted-foreground/50 mb-3 flex items-center gap-1.5">
                <Info className="w-3 h-3" /> Tên, kỹ năng, vai trò luôn hiển thị và không thể ẩn.
              </p>
              <PrivacyToggle label="Tuổi" desc="Hiển thị tuổi của bạn trên hồ sơ" checked={privacy.showAge} onChange={(v) => handlePrivacyChange('showAge', v)} />
              <PrivacyToggle label="Giới tính" desc="Hiển thị giới tính của bạn" checked={privacy.showGender} onChange={(v) => handlePrivacyChange('showGender', v)} />
              <PrivacyToggle label="Tỉnh/Thành phố" desc="Hiển thị nơi ở hiện tại" checked={privacy.showCity} onChange={(v) => handlePrivacyChange('showCity', v)} />
              <PrivacyToggle label="Trường học" desc="Hiển thị tên trường đại học" checked={privacy.showSchool} onChange={(v) => handlePrivacyChange('showSchool', v)} />
              <PrivacyToggle label="Ngành học" desc="Hiển thị chuyên ngành" checked={privacy.showMajor} onChange={(v) => handlePrivacyChange('showMajor', v)} />
              <PrivacyToggle label="Thành tích" desc="Hiển thị thành tích nổi bật" checked={privacy.showAchievements} onChange={(v) => handlePrivacyChange('showAchievements', v)} />
            </div>
          </div>
        );

      case 'password':
        return (
          <div className="glass-card rounded-xl border border-primary/10 overflow-hidden">
            <div className="px-4 py-3 border-b border-primary/10 flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-primary" />
              <h3 className="font-display text-sm font-semibold text-primary">Đổi mật khẩu</h3>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-xs font-body text-muted-foreground leading-relaxed">
                Mật khẩu nên có ít nhất 8 ký tự, bao gồm chữ hoa, chữ thường và số.
              </p>
              {[
                { label: 'Mật khẩu hiện tại', field: 'current', placeholder: 'Nhập mật khẩu hiện tại' },
                { label: 'Mật khẩu mới', field: 'next', placeholder: 'Nhập mật khẩu mới' },
                { label: 'Xác nhận mật khẩu mới', field: 'confirm', placeholder: 'Nhập lại mật khẩu mới' },
              ].map(({ label, field, placeholder }) => (
                <div key={field} className="space-y-1.5">
                  <Label className="font-body text-xs text-muted-foreground">{label}</Label>
                  <PasswordInput
                    value={pwForm[field]}
                    onChange={(e) => setPwForm((p) => ({ ...p, [field]: e.target.value }))}
                    placeholder={placeholder}
                    className="text-sm bg-muted/50 border-primary/15 focus:border-primary/50 font-body"
                  />
                </div>
              ))}
              {pwForm.confirm.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-1.5 text-xs font-body"
                  style={{ color: pwForm.next === pwForm.confirm ? 'var(--primary, #71d65b)' : '#fca5a5' }}
                >
                  {pwForm.next === pwForm.confirm ? (
                    <><Check className="w-3.5 h-3.5" /> Mật khẩu khớp</>
                  ) : (
                    <><X className="w-3.5 h-3.5" /> Mật khẩu không khớp</>
                  )}
                </motion.div>
              )}
              {pwMsg && (
                <p className={`text-xs font-body ${pwMsg.startsWith('✓') ? 'text-primary' : 'text-destructive'}`}>{pwMsg}</p>
              )}
              <Button onClick={handlePasswordChange} className="w-full h-9 font-display text-xs font-medium bg-primary text-background hover:bg-primary/90 transition-all duration-200 mt-2">
                Cập nhật mật khẩu
              </Button>

              <div className="md:hidden pt-4 mt-4 border-t border-primary/10">
                <Button
                  onClick={() => { logout(); navigate('/'); }}
                  variant="outline"
                  className="w-full h-10 font-display text-xs font-medium gap-2 border-destructive/30 text-destructive hover:bg-destructive/10 hover:border-destructive/50 md:hidden"
                >
                  <LogOut className="w-4 h-4" />
                  Đăng xuất
                </Button>
              </div>
            </div>
          </div>
        );

      case 'activity':
        return (
          <div className="glass-card rounded-xl border border-primary/10 overflow-hidden">
            <div className="px-4 py-3 border-b border-primary/10 flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              <h3 className="font-display text-sm font-semibold text-primary">Nhật ký hoạt động</h3>
            </div>
            <div className="p-4">
              {matches.length === 0 ? (
                <p className="text-sm font-body text-muted-foreground text-center py-6">Chưa có hoạt động nào</p>
              ) : (
                matches.map((match) => {
                  const otherEmail = match.user1_id === currentUser?.id ? match.user2_id : match.user1_id;
                  const profile = profileMap[otherEmail];
                  return (
                    <ActivityItem
                      key={match.id}
                      icon={Heart}
                      title={`Match với ${profile?.display_name || 'Unknown'}`}
                      desc={`${profile?.role || ''} — ${profile?.school || ''}`}
                      time={formatTime(match.created_date)}
                      color="text-pink-400"
                    />
                  );
                })
              )}
              <ActivityItem
                icon={UserCheck}
                title="Đăng nhập thành công"
                desc={`Tài khoản: ${currentUser?.email || ''}`}
                time="Hôm nay"
                color="text-primary"
              />
            </div>
          </div>
        );

      case 'terms':
        return (
          <div className="space-y-4">
            <div className="glass-card rounded-xl border border-primary/10 overflow-hidden">
              <div className="px-4 py-3 border-b border-primary/10 flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                <h3 className="font-display text-sm font-semibold text-primary">Điều khoản & Pháp lý</h3>
              </div>
              <div className="p-4 prose prose-invert prose-sm max-w-none">
                <TermsContent />
              </div>
            </div>
          </div>
        );

      case 'support':
        return (
          <div className="space-y-4">
            <div className="glass-card rounded-xl border border-primary/10 overflow-hidden">
              <div className="px-4 py-3 border-b border-primary/10 flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-primary" />
                <h3 className="font-display text-sm font-semibold text-primary">Hỗ trợ & Xử lý sự cố</h3>
              </div>
              <div className="p-4 prose prose-invert prose-sm max-w-none">
                <SupportContent />
              </div>
            </div>
          </div>
        );

      case 'about':
        return (
          <div className="space-y-4">
            <div className="glass-card rounded-xl border border-primary/10 overflow-hidden">
              <div className="px-4 py-3 border-b border-primary/10 flex items-center gap-2">
                <Info className="w-4 h-4 text-primary" />
                <h3 className="font-display text-sm font-semibold text-primary">Về CTE & DSTC</h3>
              </div>
              <div className="p-4 prose prose-invert prose-sm max-w-none">
                <AboutContent />
              </div>
            </div>
          </div>
        );

      case 'credits':
        return (
          <div className="space-y-4">
            <div className="glass-card rounded-xl border border-primary/10 overflow-hidden">
              <div className="px-4 py-3 border-b border-primary/10 flex items-center gap-2">
                <Award className="w-4 h-4 text-primary" />
                <h3 className="font-display text-sm font-semibold text-primary">Credits</h3>
              </div>
              <div className="p-4 prose prose-invert prose-sm max-w-none">
                <CreditsContent />
              </div>
            </div>
          </div>
        );

      case 'notifications':
        return <NotificationsTabContent currentUser={currentUser} />;

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex flex-col p-4 md:p-8 grid-overlay">
      <div className="max-w-2xl mx-auto gap-5 w-full flex-1 flex flex-col">
        <div>
          <h1 className="font-display font-bold text-xl tracking-wide text-primary">Cài đặt</h1>
          <p className="font-body text-xs text-muted-foreground mt-1">Quản lý tài khoản và quyền riêng tư</p>
        </div>

        <Tabs value={activeTab} onValueChange={(tab) => navigate(`/settings/${tab}`)}>
          <TabsList className="h-auto bg-transparent p-0 border-b border-primary/10 rounded-none w-full justify-start gap-0 flex-wrap mb-4">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className={`px-4 py-2.5 text-xs font-body rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none text-muted-foreground hover:text-foreground transition-all shrink-0 ${tab.mobileOnly ? 'md:hidden' : ''}`}
                >
                  <Icon className="w-3.5 h-3.5 inline mr-1.5" />
                  {tab.label}
                </TabsTrigger>
              );
            })}
          </TabsList>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              {renderTabContent()}
            </motion.div>
          </AnimatePresence>
        </Tabs>
      </div>
    </div>
  );
}