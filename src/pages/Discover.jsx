import { db } from '@/api/base44Client';

import React, { useState, useMemo, useEffect } from 'react';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { X, Heart, RotateCcw, Sparkles, ChevronRight, SlidersHorizontal, Zap } from 'lucide-react';
import { motion, useMotionValue, useTransform, AnimatePresence } from 'framer-motion';
import SwipeCard from '@/components/discover/SwipeCard';
import MatchOverlay from '@/components/discover/MatchOverlay';
import FilterPanel from '@/components/discover/FilterPanel';
import { COMPLEMENTARY_ROLES } from '@/lib/constants';
import { Link } from 'react-router-dom';

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
        className="absolute top-5 left-4 z-20 font-display text-primary text-2xl font-black border-[3px] border-primary rounded-lg px-3 py-1 rotate-[-18deg] pointer-events-none select-none"
      >
        LIKE ✓
      </motion.div>
      {/* Pass stamp */}
      <motion.div
        style={{ opacity: passOpacity }}
        className="absolute top-5 right-4 z-20 font-display text-destructive text-2xl font-black border-[3px] border-destructive rounded-lg px-3 py-1 rotate-[18deg] pointer-events-none select-none"
        style={{ opacity: passOpacity }}
      >
        PASS ✗
      </motion.div>
      <SwipeCard profile={profile} className="h-full" />
    </motion.div>
  );
}

export default function Discover() {
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
      return db.entities.ContestantProfile.filter({ created_by: me.email });
    },
    initialData: [],
  });
  const myProfile = myProfiles[0];

  const { data: allProfiles } = useQuery({
    queryKey: ['allProfiles'],
    queryFn: () => db.entities.ContestantProfile.list(),
    initialData: [],
    enabled: !!myProfile,
  });

  const { data: mySwipes } = useQuery({
    queryKey: ['mySwipes'],
    queryFn: async () => {
      const me = await db.auth.me();
      return db.entities.SwipeAction.filter({ swiper_id: me.email });
    },
    initialData: [],
    enabled: !!myProfile,
  });

  const activeFilters = useMemo(() => {
    return Object.values(filters).flat().length;
  }, [filters]);

  const candidates = useMemo(() => {
    if (!myProfile || !allProfiles.length) return [];
    const likedIds = new Set(mySwipes.filter(s => s.action === 'like').map(s => s.swiped_id));
    let filtered = allProfiles.filter(p =>
      p.created_by !== myProfile.created_by &&
      p.display_name &&
      !likedIds.has(p.created_by) &&
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
      const me = await db.auth.me();
      await db.entities.SwipeAction.create({ swiper_id: me.email, swiped_id: candidateEmail, action, is_match: false });
      if (action === 'like') {
        const reverseSwipes = await db.entities.SwipeAction.filter({ swiper_id: candidateEmail, swiped_id: me.email, action: 'like' });
        if (reverseSwipes.length > 0) {
          await db.entities.Match.create({ user1_id: me.email, user2_id: candidateEmail, status: 'matched' });
          return { matched: true };
        }
      }
      return { matched: false };
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

  if (!myProfile || !myProfile.profile_complete) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 grid-overlay">
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
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center pb-4 px-4 grid-overlay">
      {/* Header */}
      <div className="w-full max-w-sm pt-4 pb-3">
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
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Lọc {activeFilters > 0 && <span className="bg-primary text-background rounded px-1 text-[10px] font-display font-bold">{activeFilters}</span>}
          </button>
        </div>
        {/* Progress */}
        {candidates.length > 0 && (
          <div className="h-1 bg-muted rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-primary rounded-full"
              animate={{ width: `${Math.min(100, (currentIndex / candidates.length) * 100)}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>
        )}
      </div>

      {/* Card area */}
      <div className="relative w-full max-w-sm" style={{ height: '480px' }}>
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
                    className="font-display text-xs border-primary/30 text-primary hover:bg-primary/10"
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
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.88 }}
            className="w-14 h-14 rounded-full glass-card border-2 border-destructive/40 hover:border-destructive/70 hover:bg-destructive/10 flex items-center justify-center transition-all duration-150 shadow-lg"
            onClick={() => handleSwipe('pass')}
          >
            <X className="w-6 h-6 text-destructive" />
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.88 }}
            className="w-16 h-16 rounded-full bg-primary/15 border-2 border-primary flex items-center justify-center transition-all duration-150"
            onClick={() => handleSwipe('like')}
          >
            <Heart className="w-7 h-7 text-primary fill-primary/20" />
          </motion.button>
        </div>
      )}

      {currentCandidate && (
        <p className="font-body text-[10px] text-muted-foreground/40 mt-3">← vuốt để bỏ qua · vuốt để thích →</p>
      )}

      <FilterPanel
        open={showFilter}
        onClose={() => setShowFilter(false)}
        filters={filters}
        onChange={setFilters}
      />

      <MatchOverlay show={showMatch} matchedProfile={matchedProfile} onClose={() => setShowMatch(false)} />
    </div>
  );
}