import { db } from '@/api/apiClient';

import React, { useMemo } from 'react';

import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Sparkles, User, ChevronRight } from 'lucide-react';
import { COMPLEMENTARY_ROLES, SKILL_ICONS } from '@/lib/constants';

function computeScore(myProfile, candidate) {
  let score = 0;
  const mySkills = new Set(myProfile.technical_skills || []);
  const theirSkills = new Set(candidate.technical_skills || []);
  // Complementary skills score higher
  for (const s of theirSkills) { if (!mySkills.has(s)) score += 3; else score += 1; }
  const myGoals = new Set(myProfile.goals || []);
  for (const g of (candidate.goals || [])) { if (myGoals.has(g)) score += 5; }
  const compRoles = COMPLEMENTARY_ROLES[myProfile.role] || [];
  if (candidate.role && compRoles.includes(candidate.role)) score += 10;
  if (myProfile.domain_business && candidate.domain_business === myProfile.domain_business) score += 6;
  const expLevels = { "Người mới": 0, "Đã thi hackathon": 1, "Đã thi DSTC": 2 };
  if (Math.abs((expLevels[myProfile.experience] ?? 0) - (expLevels[candidate.experience] ?? 0)) <= 1) score += 3;
  return score;
}

const ROLE_COLORS = {
  'Data': 'text-blue-300 border-blue-400/30',
  'ML': 'text-primary border-primary/30',
  'Backend': 'text-purple-300 border-purple-400/30',
  'All-rounder': 'text-yellow-300 border-yellow-400/30',
};

function ScoreBar({ score, max }) {
  const pct = Math.min(100, Math.round((score / max) * 100));
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="font-body text-[10px] text-primary/60 w-8 text-right">{pct}%</span>
    </div>
  );
}

export default function TopSuggestions({ myProfile, mySwipes = [] }) {
  const navigate = useNavigate();

  const { data: allProfiles } = useQuery({
    queryKey: ['allProfiles'],
    queryFn: () => db.entities.ContestantProfile.list(),
    initialData: [],
    enabled: !!myProfile,
  });

  const suggestions = useMemo(() => {
    if (!myProfile || !allProfiles.length) return [];
    const swipedIds = new Set(mySwipes.map(s => s.swiped_id));
    return allProfiles
      .filter(p => p.created_by !== myProfile.created_by && p.display_name && !swipedIds.has(p.created_by))
      .map(p => ({ ...p, score: computeScore(myProfile, p) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 4);
  }, [myProfile, allProfiles, mySwipes]);

  const maxScore = suggestions[0]?.score || 1;

  if (!suggestions.length) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <h3 className="font-display font-semibold text-sm text-foreground">Gợi ý hàng đầu</h3>
        </div>
        <button onClick={() => navigate('/discover')} className="font-body text-xs text-primary/70 hover:text-primary transition-colors">
          Xem thêm →
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {suggestions.map(p => (
          <button
            key={p.id}
            onClick={() => navigate('/discover')}
            className="flex items-center gap-3 p-3 rounded-xl glass-card border border-primary/8 hover:border-primary/25 transition-all text-left group"
          >
            <div className="w-10 h-10 rounded-xl overflow-hidden border border-primary/15 bg-muted/50 flex-shrink-0">
              {p.profile_image
                ? <img src={p.profile_image} alt="" className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center"><User className="w-4 h-4 text-primary/25" /></div>
              }
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-2">
                <p className="font-body font-semibold text-sm text-foreground truncate">{p.display_name}</p>
                {p.role && (
                  <span className={`font-display text-[9px] px-1.5 py-0.5 rounded border flex-shrink-0 ${ROLE_COLORS[p.role] || 'text-primary border-primary/30'}`}>
                    {p.role}
                  </span>
                )}
              </div>
              <ScoreBar score={p.score} max={maxScore} />
              <div className="flex gap-1 flex-wrap">
                {(p.technical_skills || []).slice(0, 2).map(s => (
                  <span key={s} className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-primary/5 border border-primary/10 text-primary/60">
                    {SKILL_ICONS[s] || '⚙️'} {s}
                  </span>
                ))}
              </div>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}