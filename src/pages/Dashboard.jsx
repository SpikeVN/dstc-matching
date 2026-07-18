import { db } from '@/api/base44Client';

import React, { useMemo } from 'react';

import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import {
  Heart, MessageCircle, User, Sparkles, ChevronRight,
  CheckCircle, Zap, Target
} from 'lucide-react';
import TopSuggestions from '@/components/dashboard/TopSuggestions';
import PageFooter from '@/components/layout/PageFooter';

const PROFILE_FIELDS = [
  { key: 'display_name', label: 'Họ tên' },
  { key: 'bio', label: 'Giới thiệu' },
  { key: 'school', label: 'Trường' },
  { key: 'major', label: 'Ngành' },
  { key: 'role', label: 'Vai trò' },
  { key: 'experience', label: 'Kinh nghiệm' },
  { key: 'technical_skills', label: 'Kỹ năng kỹ thuật', check: v => v?.length > 0 },
  { key: 'goals', label: 'Mục tiêu', check: v => v?.length > 0 },
  { key: 'profile_image', label: 'Ảnh đại diện' },
  { key: 'city', label: 'Tỉnh/Thành phố' },
];

function StatCard({ icon: Icon, value, label, color = 'text-primary', onClick }) {
  return (
    <motion.div
      whileHover={{ scale: 1.03 }}
      onClick={onClick}
      className={`glass-card rounded-xl border border-primary/10 p-4 flex items-center gap-3 ${onClick ? 'cursor-pointer hover:border-primary/25' : ''} transition-all duration-200`}
    >
      <div className="w-10 h-10 rounded-lg bg-primary/8 flex items-center justify-center flex-shrink-0">
        {Icon && <Icon className={`w-5 h-5 ${color}`} />}
      </div>
      <div>
        <p className="font-display font-bold text-xl text-foreground">{value}</p>
        <p className="font-body text-xs text-muted-foreground">{label}</p>
      </div>
    </motion.div>
  );
}

function ProfileCompletion({ profile }) {
  const fields = PROFILE_FIELDS.map(f => ({
    ...f,
    done: f.check ? f.check(profile?.[f.key]) : !!profile?.[f.key],
  }));
  const done = fields.filter(f => f.done).length;
  const pct = Math.round((done / fields.length) * 100);

  return (
    <div className="glass-card rounded-xl border border-primary/10 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-semibold text-sm text-foreground">Hoàn thiện hồ sơ</h3>
        <span className="font-display font-bold text-lg text-primary">{pct}%</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="h-full rounded-full bg-primary"
        />
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {fields.map(f => (
          <div key={f.key} className={`flex items-center gap-1.5 text-xs font-body ${f.done ? 'text-primary/80' : 'text-muted-foreground'}`}>
            {f.done
              ? <CheckCircle className="w-3 h-3 text-primary flex-shrink-0" />
              : <div className="w-3 h-3 rounded-full border border-muted-foreground/30 flex-shrink-0" />
            }
            {f.label}
          </div>
        ))}
      </div>
    </div>
  );
}

function MatchCard({ match, currentUser, profileMap, onClick }) {
  const otherEmail = match.user1_id === currentUser?.email ? match.user2_id : match.user1_id;
  const profile = profileMap[otherEmail];
  const since = match.created_date ? Math.floor((new Date() - new Date(match.created_date)) / 86400000) : 0;

  return (
    <motion.div
      whileHover={{ x: 4 }}
      onClick={onClick}
      className="flex items-center gap-3 p-3 rounded-lg glass-card border border-primary/8 hover:border-primary/25 cursor-pointer transition-all duration-200"
    >
      <div className="w-10 h-10 rounded-lg overflow-hidden border border-primary/20 bg-muted/50 flex-shrink-0">
        {profile?.profile_image
          ? <img src={profile.profile_image} alt="" className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center"><User className="w-4 h-4 text-primary/30" /></div>
        }
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-body font-semibold text-sm text-foreground truncate">{profile?.display_name || 'Unknown'}</p>
        <p className="font-body text-xs text-muted-foreground truncate">{profile?.role}{profile?.school ? ` — ${profile.school}` : ''}</p>
      </div>
      <div className="text-right flex-shrink-0">
        <Heart className="w-3.5 h-3.5 text-pink-400 mb-1 ml-auto" />
        <p className="font-body text-[10px] text-muted-foreground">{since === 0 ? 'Hôm nay' : `${since}d trước`}</p>
      </div>
    </motion.div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();

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
    enabled: !!currentUser,
  });
  const myProfile = myProfiles[0];

  const { data: matches } = useQuery({
    queryKey: ['matches', currentUser?.email],
    queryFn: async () => {
      const me = await db.auth.me();
      const [m1, m2] = await Promise.all([
        db.entities.Match.filter({ user1_id: me.email }),
        db.entities.Match.filter({ user2_id: me.email }),
      ]);
      return [...m1, ...m2].sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
    },
    initialData: [],
    enabled: !!currentUser,
  });

  const { data: unreadMessages } = useQuery({
    queryKey: ['unreadForDash', currentUser?.email],
    queryFn: async () => {
      const me = await db.auth.me();
      return db.entities.Message.filter({ receiver_id: me.email, is_read: false });
    },
    initialData: [],
    enabled: !!currentUser,
    refetchInterval: 10000,
  });

  const { data: swipes } = useQuery({
    queryKey: ['swipesForDash', currentUser?.email],
    queryFn: async () => {
      const me = await db.auth.me();
      return db.entities.SwipeAction.filter({ swiper_id: me.email });
    },
    initialData: [],
    enabled: !!currentUser,
  });

  const { data: allProfiles } = useQuery({
    queryKey: ['allProfilesForDash'],
    queryFn: () => db.entities.ContestantProfile.list(),
    initialData: [],
  });

  const profileMap = useMemo(() => {
    const m = {};
    allProfiles.forEach(p => { m[p.created_by] = p; });
    return m;
  }, [allProfiles]);

  const recentMatches = matches.slice(0, 4);

  const currentHour = new Date().getHours();
  let greeting = "Chào buổi tối,";

  if (currentHour < 12) {
    greeting = "Chào buổi sáng,";
  } else if (currentHour < 18) {
    greeting = "Chào buổi chiều,";
  }

  return (
    <div className="min-h-screen flex flex-col p-4 md:p-8 grid-overlay">
      <div className="max-w-3xl mx-auto gap-6 w-full flex-1 flex flex-col">
        {/* Greeting */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <h1 className="font-display font-bold text-2xl text-foreground">
            {greeting} <span className="text-primary">{myProfile?.display_name || currentUser?.full_name || 'Thí sinh'}</span>!
          </h1>
          <p className="font-body text-sm text-muted-foreground mt-1">
            Hôm nay là {new Date().toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </motion.div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard icon={Heart} value={matches.length} label="Matches" onClick={() => navigate('/matches')} />
          <StatCard icon={MessageCircle} value={unreadMessages.length} label="Chưa đọc" color="text-blue-400" onClick={() => navigate('/messages')} />
          <StatCard icon={Zap} value={swipes.length} label="Đã swipe" color="text-yellow-400" />
          <StatCard icon={Target} value={allProfiles.filter(p => p.profile_complete && p.created_by !== currentUser?.email).length} label="Ứng viên" color="text-purple-400" onClick={() => navigate('/discover')} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Profile completion */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <ProfileCompletion profile={myProfile} />
            {!myProfile?.profile_complete && (
              <Button
                className="w-full mt-3 h-9 font-display text-xs font-medium bg-primary text-background hover:bg-primary/90 gap-2"
                onClick={() => navigate('/profile')}
              >
                <User className="w-4 h-4" /> Hoàn thiện ngay
              </Button>
            )}
          </motion.div>

          {/* Quick actions */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="space-y-3">
            <h3 className="font-display font-semibold text-sm text-foreground">Thao tác nhanh</h3>
            {[
              { Icon: Sparkles, label: 'Khám phá đồng đội', sub: 'Swipe & match với ứng viên phù hợp', path: '/discover', color: 'text-primary' },
              { Icon: MessageCircle, label: 'Xem tin nhắn', sub: `${unreadMessages.length} tin chưa đọc`, path: '/messages', color: 'text-blue-400' },
              { Icon: Heart, label: 'Danh sách match', sub: `${matches.length} kết nối`, path: '/matches', color: 'text-pink-400' },
            ].map(item => (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className="w-full flex items-center gap-3 p-3 rounded-lg glass-card border border-primary/8 hover:border-primary/25 transition-all duration-200 group"
              >
                <item.Icon className={`w-4 h-4 ${item.color} flex-shrink-0`} />
                <div className="flex-1 text-left min-w-0">
                  <p className="font-body font-medium text-sm text-foreground">{item.label}</p>
                  <p className="font-body text-xs text-muted-foreground">{item.sub}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </button>
            ))}
          </motion.div>
        </div>

        {/* Top suggestions */}
        {myProfile?.profile_complete && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}>
            <TopSuggestions myProfile={myProfile} mySwipes={swipes} />
          </motion.div>
        )}

        {/* Recent matches */}
        {recentMatches.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-semibold text-sm text-foreground">Matches gần đây</h3>
              <button onClick={() => navigate('/matches')} className="font-body text-xs text-primary/70 hover:text-primary transition-colors">
                Xem tất cả →
              </button>
            </div>
            <div className="space-y-2">
              {recentMatches.map(match => (
                <MatchCard
                  key={match.id}
                  match={match}
                  currentUser={currentUser}
                  profileMap={profileMap}
                  onClick={() => navigate(`/messages?match=${match.id}`)}
                />
              ))}
            </div>
          </motion.div>
        )}

        {/* Empty state */}
        {matches.length === 0 && myProfile?.profile_complete && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}
            className="glass-card rounded-xl border border-primary/10 p-8 text-center">
            <Sparkles className="w-10 h-10 text-primary/20 mx-auto mb-3" />
            <p className="font-display font-semibold text-sm text-foreground mb-1">Chưa có match nào</p>
            <p className="font-body text-xs text-muted-foreground mb-4">Bắt đầu swipe để tìm đồng đội DSTC!</p>
            <Button
              className="h-9 font-display text-xs font-medium bg-primary text-background hover:bg-primary/90 gap-2"
              onClick={() => navigate('/discover')}
            >
              <Zap className="w-4 h-4" /> Bắt đầu ngay
            </Button>
          </motion.div>
        )}
        <PageFooter />
      </div>
    </div>
  );
}