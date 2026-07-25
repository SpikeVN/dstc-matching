import React, { useState } from 'react';
import { MapPin, GraduationCap, Target, Award, User, FileText, ChevronDown, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import CvViewer from '@/components/profile/CvViewer';
import SocialIcons from '@/components/profile/SocialIcons';

const ROLE_COLORS = {
  'Data Analyst': 'border-blue-400/40 text-blue-300',
  'ML Engineer': 'border-primary/40 text-primary',
  'Backend Developer': 'border-purple-400/40 text-purple-300',
  'Quant Researcher': 'border-orange-400/40 text-orange-300',
  'Quant Developer': 'border-cyan-400/40 text-cyan-300',
  'Quant Trader': 'border-pink-400/40 text-pink-300',
  'All-rounder': 'border-yellow-400/40 text-yellow-300',
};

export default function SwipeCard({ profile, style, className = '', showMoreButton = true, showSocials = true }) {
  const [cvOpen, setCvOpen] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const skills = (profile.technical_skills || []).slice(0, 5);
  const goals = profile.goals || [];

  return (
    <>
    <div
      className={`w-full max-w-sm mx-auto overflow-hidden rounded-xl glass-card shadow-2xl flex flex-col ${className}`}
      style={{ border: '1px solid rgba(42, 75, 46, 0.3)', ...style }}
    >
      {/* Image / Avatar */}
      <div className="relative h-52 bg-gradient-to-br from-primary/10 via-transparent to-primary/5 grid-overlay">
        {profile.profile_image ? (
          <img src={profile.profile_image} alt={profile.display_name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <User className="w-20 h-20 text-primary/20" />
          </div>
        )}

        {/* Top gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/80" />

        {/* Role badge */}
        {profile.role && (
          <div className="absolute top-3 left-3">
            <span className={`font-display text-[10px] px-2.5 py-1 rounded border glass-card ${ROLE_COLORS[profile.role] || 'border-primary/30 text-primary'}`}>
              {profile.role}
            </span>
          </div>
        )}

        {/* Name */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <h3 className="font-display font-bold text-lg text-white tracking-wide">{profile.display_name}</h3>
          <div className="flex items-center gap-2 text-white/70 text-xs font-mono mt-0.5">
            {profile.school && (
              <span className="flex items-center gap-1 truncate">
                <GraduationCap className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">{profile.school}{profile.major && ` · ${profile.major}`}</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="p-4 space-y-3 flex-1">
        {profile.bio && (
          <p className="text-xs text-muted-foreground font-mono line-clamp-2 leading-relaxed">{profile.bio}</p>
        )}

        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-mono">
          {profile.city && (
            <span className="flex items-center gap-1 text-muted-foreground">
              <MapPin className="w-3 h-3 text-primary/60" /> {profile.city}
            </span>
          )}
        </div>

        {skills.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {skills.map(skill => (
              <span
                key={skill}
                className="font-mono text-[10px] px-2 py-0.5 rounded border border-primary/20 text-primary/80 bg-primary/5"
              >
                {skill}
              </span>
            ))}
          </div>
        )}

        {goals.length > 0 && (
          <div className="flex items-center gap-2">
            <Target className="w-3 h-3 text-primary/60 flex-shrink-0" />
            <div className="flex gap-1.5 flex-wrap">
              {goals.map(g => (
                <span key={g} className="font-mono text-[10px] px-2 py-0.5 rounded border border-primary/20 text-primary/80 bg-primary/5">
                  {g}
                </span>
              ))}
            </div>
          </div>
        )}

        {profile.achievements && (
          <div className="flex items-start gap-2">
            <Award className="w-3 h-3 text-yellow-400 flex-shrink-0 mt-0.5" />
            <p className="font-mono text-[10px] text-yellow-300/80 line-clamp-2 leading-relaxed">{profile.achievements}</p>
          </div>
        )}

        {profile.cv_url && (
          <button
            onClick={() => setCvOpen(true)}
            className="inline-flex items-center gap-1.5 text-[11px] font-mono text-primary/70 hover:text-primary transition-colors"
          >
            <FileText className="w-3 h-3" />
            <span className="underline underline-offset-2">Xem CV</span>
          </button>
        )}

        {showSocials && <SocialIcons links={profile.social_links} />}

      </div>

      {/* Separator + Show more button - at card bottom */}
      {showMoreButton ? (
        <>
          <div className="h-px" style={{ background: 'rgba(42, 75, 46, 0.3)' }} />
          <button
            onClick={() => setShowMore(true)}
            className="flex items-center justify-center gap-1 w-full text-[11px] font-mono text-muted-foreground/60 hover:text-primary/80 transition-colors py-2"
          >
            <span>Xem thêm</span>
            <ChevronDown className="w-3 h-3" />
          </button>
        </>
      ) : (
        <div className="h-px" style={{ background: 'rgba(42, 75, 46, 0.3)' }} />
      )}
    </div>
    {cvOpen && <CvViewer url={profile.cv_url} onClose={() => setCvOpen(false)} />}
    <AnimatePresence>
    {showMore && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.1 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        onClick={() => setShowMore(false)}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.1 }}
          className="relative bg-card border border-primary/15 rounded-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto p-6 space-y-5 shadow-2xl"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl overflow-hidden border border-primary/20 flex-shrink-0">
              {profile.profile_image ? (
                <img src={profile.profile_image} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-muted/50"><User className="w-6 h-6 text-primary/20" /></div>
              )}
            </div>
            <div className="min-w-0">
              <h3 className="font-display font-bold text-base text-foreground">{profile.display_name}</h3>
              <div className="flex items-center gap-2 text-muted-foreground text-xs font-mono">
                {profile.school && <span>{profile.school}{profile.major && ` · ${profile.major}`}</span>}
              </div>
            </div>
          </div>

          {/* Role */}
          {profile.role && (
            <span className={`inline-block font-display text-[10px] px-2.5 py-1 rounded border ${ROLE_COLORS[profile.role] || 'border-primary/30 text-primary'}`}>
              {profile.role}
            </span>
          )}

          {/* City */}
          {profile.city && (
            <div className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground">
              <MapPin className="w-3 h-3 text-primary/60" /> {profile.city}
            </div>
          )}

          {/* Bio */}
          {profile.bio && (
            <div>
              <p className="font-display text-[10px] text-primary/60 mb-1">Giới thiệu</p>
              <p className="text-xs text-muted-foreground font-mono leading-relaxed whitespace-pre-line">{profile.bio}</p>
            </div>
          )}

          {/* Tech skills */}
          {(profile.technical_skills || []).length > 0 && (
            <div>
              <p className="font-display text-[10px] text-primary/60 mb-1.5">Kỹ năng kỹ thuật</p>
              <div className="flex flex-wrap gap-1.5">
                {profile.technical_skills.map(s => (
                  <span key={s} className="font-mono text-[10px] px-2 py-0.5 rounded border border-primary/20 text-primary/80 bg-primary/5">{s}</span>
                ))}
              </div>
            </div>
          )}

          {/* Soft skills */}
          {(profile.soft_skills || []).length > 0 && (
            <div>
              <p className="font-display text-[10px] text-primary/60 mb-1.5">Soft skills</p>
              <div className="flex flex-wrap gap-1.5">
                {profile.soft_skills.map(s => (
                  <span key={s} className="font-mono text-[10px] px-2 py-0.5 rounded border border-blue-400/20 text-blue-300/80 bg-blue-500/5">{s}</span>
                ))}
              </div>
            </div>
          )}

          {/* Goals */}
          {goals.length > 0 && (
            <div>
              <p className="font-display text-[10px] text-primary/60 mb-1.5">Mục tiêu</p>
              <div className="flex flex-wrap gap-1.5">
                {goals.map(g => (
                  <span key={g} className="font-mono text-[10px] px-2 py-0.5 rounded border border-primary/20 text-primary/80 bg-primary/5">{g}</span>
                ))}
              </div>
            </div>
          )}

          {/* Experience */}
          {profile.experience && (
            <div>
              <p className="font-display text-[10px] text-primary/60 mb-1">Kinh nghiệm thi</p>
              <p className="text-xs font-mono text-muted-foreground">{profile.experience}</p>
            </div>
          )}

          {/* Achievements */}
          {profile.achievements && (
            <div>
              <p className="font-display text-[10px] text-primary/60 mb-1">Thành tích</p>
              <p className="text-xs font-mono text-muted-foreground leading-relaxed">{profile.achievements}</p>
            </div>
          )}

          {profile.achievements_other && (
            <div>
              <p className="font-display text-[10px] text-primary/60 mb-1">Thành tích khác</p>
              <p className="text-xs font-mono text-muted-foreground leading-relaxed">{profile.achievements_other}</p>
            </div>
          )}

          {/* CV */}
          {profile.cv_url && (
            <button onClick={() => { setShowMore(false); setCvOpen(true); }}
              className="inline-flex items-center gap-1.5 text-[11px] font-mono text-primary/70 hover:text-primary transition-colors">
              <FileText className="w-3 h-3" />
              <span className="underline underline-offset-2">Xem CV</span>
            </button>
          )}

          {/* Social links */}
          <SocialIcons links={profile.social_links} />

          {/* Close */}
          <button onClick={() => setShowMore(false)}
            className="absolute top-3 right-3 p-1.5 rounded-full text-muted-foreground/60 hover:text-primary hover:bg-primary/10 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </motion.div>
      </motion.div>
    )}
    </AnimatePresence>
    </>
  );
}