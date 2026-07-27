import { db } from '@/api/apiClient';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { LogOut, Terminal, Eye, KeyRound, Activity, Clock, Heart, UserCheck, Shield, FileText, HelpCircle, Info, Mail, Trophy, Users, Star, Award, User, Check, X, Github, Bell, Trash2, MessageCircle, UserPlus, UserMinus } from 'lucide-react';

import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import TermsContent from '/docs/terms.mdx';
import SupportContent from '/docs/support.mdx';

const TABS = [
  { id: 'password', label: 'Bảo mật', icon: KeyRound },
  { id: 'privacy', label: 'Quyền riêng tư', icon: Eye },
  { id: 'activity', label: 'Nhật ký', icon: Activity },
  { id: 'terms', label: 'Điều khoản', icon: FileText },
  { id: 'support', label: 'Hỗ trợ', icon: HelpCircle },
  { id: 'about', label: 'Về CTE & DSTC', icon: Info },
  { id: 'system', label: 'Hệ thống', icon: Terminal },
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
                  className={`w-full flex items-start gap-3 p-3 rounded-lg hover:bg-primary/5 transition-colors text-left ${
                    !notif.is_read ? 'bg-primary/[0.03]' : ''
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
  const urlParams = new URLSearchParams(window.location.search);
  const initialTab = urlParams.get('tab') || 'password';
  const [activeTab, setActiveTab] = useState(initialTab);
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
              <div className="px-4 py-3 border-b border-primary/10 flex items-center gap-3">
                <img src="/cte-logo.svg" alt="CTE FTU" className="w-6 h-6 rounded object-contain opacity-80" />
                <h3 className="font-display text-sm font-semibold text-primary">Đôi điều về CTE</h3>
              </div>
              <div className="p-4 space-y-4 font-body text-xs text-muted-foreground leading-relaxed">
                <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/15">
                  <Mail className="w-4 h-4 text-primary flex-shrink-0" />
                  <a href="mailto:datasciencetalent.cteftu@gmail.com" className="text-primary font-mono hover:underline">datasciencetalent.cteftu@gmail.com</a>
                </div>
                <div>
                  <p className="font-body font-medium text-foreground text-sm mb-1 flex items-center gap-1.5"><Star className="w-3.5 h-3.5 text-primary/60" /> Quá trình hình thành</p>
                  <p>Thành lập ngày 10/8/2022, Câu lạc bộ Khoa học Công nghệ trong Kinh tế và Kinh doanh trường Đại học Ngoại thương (Club of Technology in Economics - <span className="text-primary">CTE FTU</span>) ra đời trong sứ mệnh chung của Nhà trường nhằm xây dựng hệ sinh thái về Khoa học Dữ liệu và Khoa học Công nghệ tại Trường Đại học Ngoại thương.</p>
                  <p className="mt-2">Cho tới hiện tại, CTE là câu lạc bộ chuyên môn duy nhất hoạt động trong lĩnh vực Khoa học dữ liệu, trực thuộc Đoàn Thanh niên Cộng sản Hồ Chí Minh trường Đại học Ngoại thương.</p>
                </div>
                <div>
                  <p className="font-body font-medium text-foreground text-sm mb-1 flex items-center gap-1.5"><Star className="w-3.5 h-3.5 text-primary/60" /> Sứ mệnh và tầm nhìn</p>
                  <p>Là câu lạc bộ chuyên môn được xây dựng nhằm tập hợp các sinh viên kinh tế có đam mê Khoa học dữ liệu, Khoa học công nghệ, CTE luôn nỗ lực không ngừng trong quá trình phát triển năng lực cho cộng đồng sinh viên, với mục tiêu góp phần nhỏ trong việc đào tạo nguồn nhân lực chất lượng cao cho xã hội.</p>
                </div>
                <div className="space-y-2">
                  <p className="font-body font-medium text-foreground text-sm flex items-center gap-1.5"><Award className="w-3.5 h-3.5 text-primary/60" /> Hoạt động nổi bật</p>
                  <div className="p-3 rounded-lg bg-white/3 border border-primary/10 space-y-1">
                    <p className="text-foreground/80 font-medium">Data Science Talent Competition (DSTC)</p>
                    <p>Cuộc thi về lĩnh vực Khoa học dữ liệu đầu tiên do sinh viên Kinh tế tổ chức, quy tụ đông đảo học sinh, sinh viên toàn quốc đề xuất giải pháp cho các vấn đề xã hội bằng Khoa học dữ liệu.</p>
                  </div>
                  <div className="p-3 rounded-lg bg-white/3 border border-primary/10 space-y-1">
                    <p className="text-foreground/80 font-medium">Chuỗi khóa học Data Bootcamp</p>
                    <p>Tổ chức theo hai mùa: Summer Bootcamp và Winter Bootcamp, giúp học sinh và sinh viên linh hoạt chọn thời điểm phù hợp để tham gia.</p>
                  </div>
                  <div className="p-3 rounded-lg bg-white/3 border border-primary/10 space-y-1">
                    <p className="text-foreground/80 font-medium">Game Bụt của Cô Tấm, tiền sự kiện DSTC 2026</p>
                    <p>Game online mang tính giáo dục do CLB phát triển, đưa kiến thức KHCN đến gần giới trẻ qua trải nghiệm giải trí. <a href="https://butcuacotam.cteftu.id.vn/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Trải nghiệm tại butcuacotam.cteftu.id.vn →</a></p>
                  </div>
                  <div className="p-3 rounded-lg bg-white/3 border border-primary/10 space-y-1">
                    <p className="text-foreground/80 font-medium">Data Science Explorer Community</p>
                    <p>Cộng đồng với gần <span className="text-primary font-medium">7.500 thành viên</span> năng động, chia sẻ tài liệu, trải nghiệm và tips phỏng vấn cho các vị trí Data.</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="glass-card rounded-xl border border-primary/10 overflow-hidden">
              <div className="px-4 py-3 border-b border-primary/10 flex items-center gap-3">
                <Trophy className="w-4 h-4 text-primary" />
                <h3 className="font-display text-sm font-semibold text-primary">Về Data Science Talent Competition</h3>
              </div>
              <div className="p-4 space-y-4 font-body text-xs text-muted-foreground leading-relaxed">
                <p>DSTC là cuộc thi về Khoa học dữ liệu đầu tiên của FTU do <span className="text-primary">CTE FTU</span> tổ chức, được bảo trợ pháp lý bởi Đoàn TNCS HCM và bảo trợ chuyên môn bởi Khoa Công nghệ & Khoa học Dữ liệu nhà trường.</p>
                <div className="p-3 rounded-lg bg-white/3 border border-primary/10 space-y-2">
                  <p className="text-foreground font-medium">1. Tiền sự kiện</p>
                  <p><span className="text-primary/70">Nội dung:</span> Game Bụt của Cô Tấm — game online mang tính giáo dục do CLB phát triển, đưa kiến thức KHCN đến gần với giới trẻ thông qua trò chơi giải trí.</p>
                  <p><span className="text-primary/70">Link:</span> <a href="https://butcuacotam.cteftu.id.vn/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">butcuacotam.cteftu.id.vn</a></p>
                  <p><span className="text-primary/70">Đối tác:</span> <a href="https://ntq-solution.com.vn" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">NTQ Solutions</a> — đơn vị cung cấp nền tảng công nghệ cho game.</p>
                </div>
                <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 space-y-2">
                  <p className="text-foreground font-medium">2. Data Science Talent Competition 226</p>
                  <p><span className="text-primary/70">Nội dung:</span> Cuộc thi về tài chính định lượng (quant finance), thí sinh sử dụng kiến thức toán và tài chính để tìm ra alpha — phương trình dự báo giá cổ phiếu trên sàn chứng khoán Việt Nam (tương tự International Quant Championship).</p>
                  <p><span className="text-primary/70">Đối tác:</span> <span className="text-foreground/80">XNO Quant</span> — đơn vị cung cấp nền tảng thi đấu cho cuộc thi.</p>
                </div>
              </div>
            </div>
          </div>
        );

      case 'system':
        return (
          <div className="space-y-4">
            <div className="glass-card rounded-xl border border-primary/10 overflow-hidden">
              <div className="px-4 py-3 border-b border-primary/10 flex items-center gap-2">
                <Terminal className="w-4 h-4 text-primary" />
                <h3 className="font-display text-sm font-semibold text-primary">Về hệ thống</h3>
              </div>
              <div className="p-4 space-y-2 font-body text-xs text-muted-foreground">
                <div className="flex justify-between"><span className="text-primary/60">Platform</span>
                  <div className="flex flex-row gap-2 w-fit">
                    <code className="font-mono">dstc-matching</code>
                    <a href="https://github.com/SpikeVN/dstc-matching" className="hover:text-accent flex flex-row font-mono">
                      <Github height={18} />
                      {__COMMIT_HASH__}
                    </a>
                  </div>
                </div>
                <div className="flex justify-between"><span className="text-primary/60">Ban tổ chức</span><span>CLB Khoa học Công nghệ trong Kinh tế và Kinh doanh</span></div>
                <div className="flex justify-between"><span className="text-primary/60">Host</span><span>Đoàn TNCS Hồ Chí Minh, Trường Đại học Ngoại Thương</span></div>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground/50">Bản quyền © 2026 CLB Khoa học Công nghệ trong Kinh tế và Kinh doanh. Bảo lưu mọi quyền.</p>
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

        <Tabs value={activeTab} onValueChange={setActiveTab}>
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