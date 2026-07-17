import React from 'react';
import { X, SlidersHorizontal, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ROLE_OPTIONS,
  EXPERIENCE_OPTIONS,
  GOAL_OPTIONS,
  TOOL_SKILLS,
  FRAMEWORK_SKILLS,
  SKILLSET,
  SOFT_SKILLS,
  FILTER_CITIES,
} from '@/lib/constants';

// Strip leading emoji from option labels
const stripEmoji = (s) => s.replace(/^\S+\s+/, '');

function FilterChip({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`text-xs font-body px-3 py-1.5 rounded-lg border transition-all duration-150 ${active
        ? 'bg-primary/15 border-primary/50 text-primary'
        : 'border-primary/10 text-muted-foreground hover:border-primary/25 hover:text-foreground'
        }`}
    >
      {label}
    </button>
  );
}

function FilterSection({ title, children }) {
  return (
    <div className="space-y-2">
      <p className="font-display text-[10px] text-primary/60">{title}</p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

const EMPTY_FILTERS = {
  roles: [], experience: [], goals: [],
  tools: [], frameworks: [], skillset: [], soft_skills: [], cities: [],
};

export default function FilterPanel({ open, onClose, filters, onChange }) {
  const toggle = (field, value) => {
    const current = filters[field] || [];
    const next = current.includes(value)
      ? current.filter(v => v !== value)
      : [...current, value];
    onChange({ ...filters, [field]: next });
  };

  const hasActive = Object.values(filters).some(v => Array.isArray(v) ? v.length > 0 : !!v);
  const reset = () => onChange(EMPTY_FILTERS);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed right-0 top-0 bottom-0 z-50 w-80 glass-card border-l border-primary/15 flex flex-col shadow-2xl"
            style={{ boxShadow: '-8px 0 40px rgba(0,0,0,0.4)' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-4 border-b border-primary/10">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-primary" />
                <h2 className="font-display font-bold text-sm text-foreground">Bộ lọc</h2>
              </div>
              <div className="flex items-center gap-2">
                {hasActive && (
                  <button onClick={reset} className="flex items-center gap-1 text-xs font-body text-muted-foreground hover:text-primary transition-colors">
                    <RotateCcw className="w-3 h-3" /> Reset
                  </button>
                )}
                <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-primary/10 transition-colors">
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
            </div>

            {/* Filters */}
            <div className="flex-1 overflow-y-auto p-4 space-y-5">

              <FilterSection title="Vai trò">
                {ROLE_OPTIONS.map(r => (
                  <FilterChip key={r} label={r}
                    active={(filters.roles || []).includes(r)}
                    onClick={() => toggle('roles', r)}
                  />
                ))}
              </FilterSection>

              <FilterSection title="Kinh nghiệm thi">
                {EXPERIENCE_OPTIONS.map(e => (
                  <FilterChip key={e.value} label={stripEmoji(e.label)}
                    active={(filters.experience || []).includes(e.value)}
                    onClick={() => toggle('experience', e.value)}
                  />
                ))}
              </FilterSection>

              <FilterSection title="Mục tiêu tham gia">
                {GOAL_OPTIONS.map(g => (
                  <FilterChip key={g.value} label={stripEmoji(g.label)}
                    active={(filters.goals || []).includes(g.value)}
                    onClick={() => toggle('goals', g.value)}
                  />
                ))}
              </FilterSection>

              <FilterSection title="Tools">
                {TOOL_SKILLS.map(s => (
                  <FilterChip key={s} label={s}
                    active={(filters.tools || []).includes(s)}
                    onClick={() => toggle('tools', s)}
                  />
                ))}
              </FilterSection>

              <FilterSection title="Frameworks & Libraries">
                {FRAMEWORK_SKILLS.map(s => (
                  <FilterChip key={s} label={s}
                    active={(filters.frameworks || []).includes(s)}
                    onClick={() => toggle('frameworks', s)}
                  />
                ))}
              </FilterSection>

              <FilterSection title="Skillset">
                {SKILLSET.map(s => (
                  <FilterChip key={s} label={s}
                    active={(filters.skillset || []).includes(s)}
                    onClick={() => toggle('skillset', s)}
                  />
                ))}
              </FilterSection>

              <FilterSection title="Mindset & Soft Skills">
                {SOFT_SKILLS.map(s => (
                  <FilterChip key={s} label={s}
                    active={(filters.soft_skills || []).includes(s)}
                    onClick={() => toggle('soft_skills', s)}
                  />
                ))}
              </FilterSection>

              <FilterSection title="Tỉnh / Thành phố">
                {FILTER_CITIES.map(c => (
                  <FilterChip key={c} label={c}
                    active={(filters.cities || []).includes(c)}
                    onClick={() => toggle('cities', c)}
                  />
                ))}
              </FilterSection>

            </div>

            {/* Apply */}
            <div className="p-4 border-t border-primary/10">
              <Button
                onClick={onClose}
                className="w-full h-9 font-display text-xs font-medium bg-primary text-background hover:bg-primary/90 gap-2"
              >
                Áp dụng bộ lọc
                {hasActive && (
                  <span className="bg-background/20 rounded px-1.5 text-[10px]">
                    {Object.values(filters).flat().length}
                  </span>
                )}
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}