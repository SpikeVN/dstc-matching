import { db } from '@/api/apiClient';

import React, { useState, useMemo, useEffect } from 'react';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { X, Heart, RotateCcw, Sparkles, ChevronRight, ChevronLeft, Zap, Filter } from 'lucide-react';
import { motion, useMotionValue, useTransform, AnimatePresence } from 'framer-motion';
import SwipeCard from '@/components/discover/SwipeCard';
import MatchOverlay from '@/components/discover/MatchOverlay';
import FilterPanel from '@/components/discover/FilterPanel';
import { COMPLEMENTARY_ROLES } from '@/lib/constants';
import { Link, useNavigate } from 'react-router-dom';

function computeScore(myProfile, candidate) {
  let score = 0;
  const mySkills = new Set(myProfile.technical_skills || []);
  const theirSkills = new Set(candidate.technical_skills || []);
  for (const s of theirSkills) { if (!mySkills.has(s)) score += 3; }
  const myGoals = new Set(myProfile.goals || []);
  for (const g of (candidate.goals || [])) { if (myGoals.has(g)) score += 5; }
  const compRoles = COMPLEMENTARY_ROLES[myProfile.role] || [];
  if (candidate.role && compRoles.includes(candidate.role)) score += 8;
  const expLevels = { "Chưa thi lần nào": 0, "Đã thi cuộc thi về Quant": 1, "Đã từng thi DSTC": 2 };
  if (Math.abs((expLevels[myProfile.experience] ?? 0) - (expLevels[candidate.experience] ?? 0)) <= 1) score += 2;
  return score;
}

function DraggableCard({ profile, onSwipe }) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-220, 220], [-20, 20]);
  const likeOpacity = useTransform(x, [30, 110], [0, 1]);
  const passOpacity = useTransform(x, [-110, -30], [1, 0]);
  const cardOpacity = useTransform(x, [-250, 0, 250], [0.4, 1, 0.4]);
  const cardScale = useTransform(x, [-250, 0, 250], [0.9, 1, 0.9]);

  const handleDragEnd = (_, info) => {
    if (info.offset.x > 110) onSwipe('like');
    else if (info.offset.x < -110) onSwipe('pass');
  };

  return (
    <motion.div
      style={{ x, y, rotate, opacity: cardOpacity, scale: cardScale }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.7}
      onDragEnd={handleDragEnd}
      whileTap={{ cursor: 'grabbing' }}
      className="absolute inset-0 cursor-grab"
    >
      {/* Like stamp */}
      <motion.div
        style={{ opacity: likeOpacity }}
        className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none select-none"
      >
        <span className="font-display text-primary text-5xl font-black border-[4px] border-primary rounded-lg px-5 py-2 rotate-[-18deg] bg-background/60 backdrop-blur-sm">
          LIKE ✓
        </span>
      </motion.div>
      {/* Pass stamp */}
      <motion.div
        style={{ opacity: passOpacity }}
        className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none select-none"
      >
        <span className="font-display text-destructive text-5xl font-black border-[4px] border-destructive rounded-lg px-5 py-2 rotate-[18deg] bg-background/60 backdrop-blur-sm">
          PASS ✗
        </span>
      </motion.div>
      <SwipeCard profile={profile} className="h-full" />
    </motion.div>
  );
}

export default function Discover() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [matchedProfile, setMatchedProfile] = useState(null);
  const [showMatch, setShowMatch] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [filters, setFilters] = useState({ roles: [], experience: [], goals: [], tools: [], frameworks: [], skillset: [], soft_skills: [], cities: [] });
  const [swipeDir, setSwipeDir] = useState(null);
  const [seenInCurrentRound, setSeenInCurrentRound] = useState(new Set());

  const { data: myProfiles } = useQuery({
    queryKey: ['myProfile'],
    queryFn: async () => {
      const me = await db.auth.me();
      return db.entities.ContestantProfile.filter({ created_by: me.id });
    },
    initialData: [],
  });
  const myProfile = myProfiles[0];

  const { data: allProfiles } = useQuery({
    queryKey: ['allProfiles', filters],
    queryFn: () => {
      // Map frontend filter state to backend query params
      const params = {};
      if (filters.roles?.length) params.role = filters.roles;
      if (filters.experience?.length) params.experience = filters.experience;
      if (filters.goals?.length) params.goal = filters.goals;
      if (filters.cities?.length) params.city = filters.cities;
      const skillFilters = [...(filters.tools || []), ...(filters.frameworks || []), ...(filters.skillset || [])];
      if (skillFilters.length) params.technical_skill = skillFilters;
      if (filters.soft_skills?.length) params.soft_skill = filters.soft_skills;
      // Only send params when filters are active; otherwise list() returns everything
      return Object.keys(params).length > 0
        ? db.entities.ContestantProfile.filter(params)
        : db.entities.ContestantProfile.list();
    },
    initialData: [],
    enabled: !!myProfile,
  });

  const { data: mySwipes } = useQuery({
    queryKey: ['mySwipes'],
    queryFn: async () => {
      const me = await db.auth.me();
      return db.entities.SwipeAction.filter({ swiper_id: me.id });
    },
    initialData: [],
    enabled: !!myProfile,
  });

  const { data: blockedUsers } = useQuery({
    queryKey: ['blockedUsers', myProfile?.created_by],
    queryFn: () => db.block.list(),
    initialData: [],
    enabled: !!myProfile,
  });

  const activeFilters = useMemo(() => {
    return Object.values(filters).flat().length;
  }, [filters]);

  const candidates = useMemo(() => {
    if (!myProfile || !allProfiles.length) return [];
    const likedIds = new Set(mySwipes.filter(s => s.action === 'like').map(s => s.swiped_id));
    const blockedIds = new Set(blockedUsers.map(b => b.blocked_id));
    let filtered = allProfiles.filter(p =>
      p.created_by !== myProfile.created_by &&
      p.display_name &&
      !likedIds.has(p.created_by) &&
      !blockedIds.has(p.created_by) &&
      !seenInCurrentRound.has(p.created_by)
    );
    if (filters.roles?.length > 0) filtered = filtered.filter(p => filters.roles.includes(p.role));
    if (filters.experience?.length > 0) filtered = filtered.filter(p => filters.experience.includes(p.experience));
    if (filters.goals?.length > 0) filtered = filtered.filter(p =>
      filters.goals.some(g => (p.goals || []).includes(g))
    );
    if (filters.cities?.length > 0) {
      filtered = filtered.filter(p => {
        const city = (p.city || '').toLowerCase();
        return filters.cities.some(c => {
          if (c === 'Hà Nội') return city.includes('hà nội');
          if (c === 'Hồ Chí Minh') return city.includes('hồ chí minh');
          if (c === 'Tỉnh/Thành phố khác') return !city.includes('hà nội') && !city.includes('hồ chí minh');
          return false;
        });
      });
    }
    const skillFilters = [...(filters.tools || []), ...(filters.frameworks || []), ...(filters.skillset || [])];
    if (skillFilters.length > 0) filtered = filtered.filter(p =>
      skillFilters.some(s => (p.technical_skills || []).includes(s))
    );
    if (filters.soft_skills?.length > 0) filtered = filtered.filter(p =>
      filters.soft_skills.some(s => (p.soft_skills || []).includes(s))
    );
    return filtered.sort((a, b) => computeScore(myProfile, b) - computeScore(myProfile, a));
  }, [myProfile, allProfiles, mySwipes, seenInCurrentRound, filters]);

  const safeIndex = candidates.length > 0 ? Math.min(currentIndex, candidates.length - 1) : 0;
  const currentCandidate = candidates[safeIndex];
  const remaining = Math.max(0, candidates.length - safeIndex);

  // Reset round when all candidates have been seen — passed candidates reappear
  useEffect(() => {
    if (candidates.length === 0 && seenInCurrentRound.size > 0) {
      setSeenInCurrentRound(new Set());
      setCurrentIndex(0);
    }
  }, [candidates.length, seenInCurrentRound.size]);

  const swipeMutation = useMutation({
    mutationFn: async ({ action, candidateEmail }) => {
      const result = await db.entities.SwipeAction.create({ swiper_id: myProfile.created_by, swiped_id: candidateEmail, action });
      return { matched: result?.is_match ?? false };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['mySwipes'] });
      queryClient.invalidateQueries({ queryKey: ['matches'] });
      if (result.matched) { setMatchedProfile(currentCandidate); setShowMatch(true); }
    },
  });

  const handleSwipe = (action) => {
    if (!currentCandidate) return;
    setSwipeDir(action);
    const swipedId = currentCandidate.created_by;
    setSeenInCurrentRound(prev => new Set([...prev, swipedId]));
    swipeMutation.mutate({ action, candidateEmail: swipedId });
    setTimeout(() => { setSwipeDir(null); }, 200);
  };

  if (!myProfile || !myProfile.profile_complete || !myProfile.visited_profile) {
    return (
      <div className="h-screen flex flex-col p-4 pb-10 grid-overlay overflow-hidden">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-sm glass-card rounded-2xl p-8 border border-neon/20">
            <Sparkles className="w-10 h-10 text-neon mx-auto mb-4 text-primary" />
            <h2 className="font-display font-bold text-base mb-2 text-primary">Hoàn thành hồ sơ trước</h2>
            <p className="text-muted-foreground font-body text-xs mb-5 leading-relaxed">
              Bạn cần hoàn thành hồ sơ để bắt đầu tìm kiếm đồng đội
            </p>
            <Link to="/profile">
              <Button className="font-display text-xs font-medium gap-2 bg-primary text-background hover:bg-primary/90 ">
                Hoàn thành hồ sơ <ChevronRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Mobile header — fixed to top, placed OUTSIDE overflow-hidden to avoid click-area clipping */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-20 bg-background/80 px-4 pt-3 pb-2 border-b border-primary/10">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center justify-center w-11 h-11 -ml-1.5 rounded-full hover:bg-primary/10 active:bg-primary/15 transition-colors shrink-0 touch-manipulation"
          >
            <ChevronLeft className="w-5 h-5 text-primary" />
          </button>
          <div className="text-center min-w-0 px-2">
            <h1 className="font-display font-bold text-sm tracking-wide text-primary truncate">Tìm đồng đội</h1>
            <p className="text-muted-foreground font-body text-xs">{remaining} ứng viên{activeFilters > 0 ? ` (đã lọc)` : ''}</p>
          </div>
          <button
            onClick={() => setShowFilter(true)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg border text-xs font-body transition-all shrink-0 touch-manipulation ${activeFilters > 0
              ? 'border-primary/50 bg-primary/10 text-primary'
              : 'border-primary/15 text-muted-foreground hover:border-primary/30 hover:text-foreground active:bg-primary/5'
              }`}
          >
            <Filter className="w-4 h-4" />
            Lọc {activeFilters > 0 && <span className="bg-primary text-background rounded px-1 text-[10px] font-display font-bold">{activeFilters}</span>}
          </button>
        </div>
      </div>

      <div className="h-screen flex flex-col items-center overflow-hidden grid-overlay">
        {/* Padded container for everything else — pt-16 gives room for fixed mobile header */}
        <div className="flex-1 w-full max-w-sm flex flex-col items-center pb-10 pt-16 md:pt-0 px-4">
          {/* Desktop header */}
          <div className="hidden md:block w-full pt-4 pb-3">
            <div className="flex items-center justify-between mb-1">
              <div>
                <h1 className="font-display font-bold text-sm tracking-wide text-primary">Tìm đồng đội</h1>
                <p className="text-muted-foreground font-body text-xs">{remaining} ứng viên{activeFilters > 0 ? ` (đã lọc)` : ''}</p>
              </div>
              <button
                onClick={() => setShowFilter(true)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-body transition-all ${activeFilters > 0
                  ? 'border-primary/50 bg-primary/10 text-primary'
                  : 'border-primary/15 text-muted-foreground hover:border-primary/30 hover:text-foreground'
                  }`}
              >
                <Filter className="w-3.5 h-3.5" />
                Lọc {activeFilters > 0 && <span className="bg-primary text-background rounded px-1 text-[10px] font-display font-bold">{activeFilters}</span>}
              </button>
            </div>
            <div className="w-full h-px bg-primary/10 mt-2 mb-3" />
          </div>

          {/* Card area */}
          <div className="relative w-full flex-1 min-h-0">
            <AnimatePresence mode="wait">
              {currentCandidate ? (
                <motion.div
                  key={`${currentCandidate.id}-${currentIndex}`}
                  initial={{ scale: 0.9, opacity: 0, y: 16 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{
                    x: swipeDir === 'like' ? 400 : swipeDir === 'pass' ? -400 : 0,
                    rotate: swipeDir === 'like' ? 20 : swipeDir === 'pass' ? -20 : 0,
                    opacity: 0,
                  }}
                  transition={{ duration: 0.22, ease: 'easeOut' }}
                  className="absolute inset-0"
                >
                  <DraggableCard profile={currentCandidate} onSwipe={handleSwipe} />
                </motion.div>
              ) : (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="absolute inset-0 flex items-center justify-center"
                >
                  <div className="text-center glass-card rounded-2xl p-8 border border-primary/15 w-full">
                    <RotateCcw className="w-10 h-10 text-primary/20 mx-auto mb-3" />
                    <p className="font-display text-sm text-foreground font-semibold mb-1">
                      {activeFilters > 0 ? 'Không tìm thấy ứng viên' : 'Đã hết ứng viên!'}
                    </p>
                    <p className="font-body text-xs text-muted-foreground mt-1 mb-4">
                      {activeFilters > 0 ? 'Thử thay đổi bộ lọc' : 'Quay lại sau hoặc bỏ lọc'}
                    </p>
                    {activeFilters > 0 && (
                      <Button size="sm" variant="outline"
                        className="font-display text-xs border-primary/30 text-primary hover:bg-primary/10 hover:text-primary"
                        onClick={() => setFilters({ roles: [], experience: [], goals: [], tools: [], frameworks: [], skillset: [], soft_skills: [], cities: [] })}>
                        Bỏ lọc
                      </Button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Action buttons */}
          {currentCandidate && (
            <div className="flex items-center gap-6 mt-5">
              <motion.button
                whileTap={{ scale: 0.88 }}
                className="w-14 h-14 rounded-full glass-card border-2 border-destructive/40 hover:border-destructive/70 hover:bg-destructive/10 flex items-center justify-center transition-all duration-150 shadow-lg"
                onClick={() => handleSwipe('pass')}
              >
                <X className="w-6 h-6 text-destructive" />
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.88 }}
                className="w-14 h-14 rounded-full glass-card border-2 border-primary/40 hover:border-primary/70 hover:bg-primary/10 flex items-center justify-center transition-all duration-150 shadow-lg"
                onClick={() => handleSwipe('like')}
              >
                <Heart className="w-6 h-6 text-primary fill-primary" />
              </motion.button>
            </div>
          )}

          {currentCandidate && (
            <p className="font-body text-[10px] text-muted-foreground/40 mt-3">← vuốt để bỏ qua · vuốt để thích →</p>
          )}
        </div>

        <FilterPanel
          open={showFilter}
          onClose={() => setShowFilter(false)}
          filters={filters}
          onChange={setFilters}
        />

        <MatchOverlay show={showMatch} matchedProfile={matchedProfile} onClose={() => setShowMatch(false)} />
      </div>
    </>
  );
}