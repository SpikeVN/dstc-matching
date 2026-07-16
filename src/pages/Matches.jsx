import { db } from '@/api/base44Client';

import React from 'react';

import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { MessageCircle, User, Heart, GraduationCap, MapPin, Zap } from 'lucide-react';

const ROLE_COLORS = {
  'Data': 'bg-blue-500/10 border-blue-400/30 text-blue-300',
  'ML': 'bg-neon/10 border-neon/30 text-neon',
  'Backend': 'bg-purple-500/10 border-purple-400/30 text-purple-300',
  'All-rounder': 'bg-yellow-500/10 border-yellow-400/30 text-yellow-300',
};

const EXP_LABEL = {
  'Chưa thi lần nào': { label: 'Lần đầu tham gia', color: 'text-muted-foreground' },
  'Đã thi cuộc thi về Quant': { label: 'Đã thi Quant', color: 'text-yellow-400' },
  'Đã từng thi DSTC': { label: 'Alumni DSTC', color: 'text-neon' },
};

export default function Matches() {
  const navigate = useNavigate();

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => db.auth.me(),
  });

  const { data: matches } = useQuery({
    queryKey: ['matches', currentUser?.email],
    queryFn: async () => {
      const me = await db.auth.me();
      const [m1, m2] = await Promise.all([
        db.entities.Match.filter({ user1_id: me.email }),
        db.entities.Match.filter({ user2_id: me.email }),
      ]);
      return [...m1, ...m2];
    },
    initialData: [],
    enabled: !!currentUser,
  });

  const { data: allProfiles } = useQuery({
    queryKey: ['allProfilesForMatch'],
    queryFn: () => db.entities.ContestantProfile.list(),
    initialData: [],
  });

  const profileMap = {};
  allProfiles.forEach(p => { profileMap[p.created_by] = p; });

  if (matches.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 grid-overlay">
        <div className="text-center glass-card rounded-2xl p-10 border border-neon/15 max-w-sm w-full">
          <div className="w-16 h-16 rounded-2xl bg-neon/10 border border-neon/20 flex items-center justify-center mx-auto mb-4">
            <Heart className="w-7 h-7 text-neon/40" />
          </div>
          <h2 className="font-display font-bold text-sm neon-text tracking-widest uppercase mb-2">Chưa có match</h2>
          <p className="text-muted-foreground font-mono text-xs mb-5 leading-relaxed">
            Hãy khám phá và swipe để tìm đồng đội phù hợp
          </p>
          <Button
            className="font-display text-xs uppercase tracking-widest gap-2 bg-neon text-background hover:bg-neon/90 transition-all duration-200"
            onClick={() => navigate('/discover')}
          >
            <Zap className="w-4 h-4" /> Khám phá ngay
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8 grid-overlay">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="font-display font-bold text-lg tracking-widest uppercase neon-text">Matches của bạn</h1>
          <p className="font-mono text-xs text-muted-foreground mt-1">{matches.length} kết nối thành công</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {matches.map((match, i) => {
            const otherEmail = match.user1_id === currentUser?.email ? match.user2_id : match.user1_id;
            const profile = profileMap[otherEmail];
            const exp = EXP_LABEL[profile?.experience];

            return (
              <motion.div
                key={match.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.06 }}
                className="glass-card rounded-xl border border-neon/10 hover:border-neon/25 transition-all duration-200 overflow-hidden group"
              >
                {/* Top accent line */}
                <div className="h-px bg-gradient-to-r from-transparent via-neon/40 to-transparent" />

                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-xl overflow-hidden border border-neon/20 bg-muted/50 flex-shrink-0">
                      {profile?.profile_image ? (
                        <img src={profile.profile_image} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <User className="w-5 h-5 text-neon/30" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-display font-bold text-sm text-foreground truncate">{profile?.display_name || 'Unknown'}</h3>
                        {profile?.role && (
                          <span className={`font-mono text-[10px] px-2 py-0.5 rounded border ${ROLE_COLORS[profile.role] || 'border-neon/20 text-neon'}`}>
                            {profile.role}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-[11px] font-mono text-muted-foreground flex-wrap">
                        {profile?.school && (
                          <span className="flex items-center gap-1">
                            <GraduationCap className="w-3 h-3" /> {profile.school}
                          </span>
                        )}
                        {profile?.city && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" /> {profile.city}
                          </span>
                        )}
                      </div>
                      {exp && (
                        <span className={`font-mono text-[10px] ${exp.color} mt-1 block`}>{exp.label}</span>
                      )}
                    </div>
                  </div>

                  {profile?.bio && (
                    <p className="font-mono text-xs text-muted-foreground mt-3 line-clamp-2 leading-relaxed">{profile.bio}</p>
                  )}

                  {(profile?.technical_skills || []).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-3">
                      {profile.technical_skills.slice(0, 4).map(s => (
                        <span key={s} className="font-mono text-[10px] px-2 py-0.5 rounded border border-neon/15 text-neon/70 bg-neon/5">{s}</span>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2 mt-4">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 h-8 font-display text-[11px] uppercase tracking-wider gap-1.5 border-neon/25 text-neon hover:bg-neon/10"
                      onClick={() => navigate(`/profile-view?id=${profile?.id}`)}
                    >
                      <User className="w-3.5 h-3.5" /> Hồ sơ
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1 h-8 font-display text-[11px] uppercase tracking-wider gap-1.5 bg-neon text-background hover:bg-neon/90 transition-all duration-200"
                      onClick={() => navigate(`/messages?match=${match.id}`)}
                    >
                      <MessageCircle className="w-3.5 h-3.5" /> Nhắn tin
                    </Button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}