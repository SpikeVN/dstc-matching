import React from 'react';
import { MapPin, GraduationCap, Target, Award, User } from 'lucide-react';

const ROLE_COLORS = {
  'Data Analyst': 'border-blue-400/40 text-blue-300',
  'ML Engineer': 'border-primary/40 text-primary',
  'Backend Developer': 'border-purple-400/40 text-purple-300',
  'Quant Researcher': 'border-orange-400/40 text-orange-300',
  'Quant Developer': 'border-cyan-400/40 text-cyan-300',
  'Quant Trader': 'border-pink-400/40 text-pink-300',
  'All-rounder': 'border-yellow-400/40 text-yellow-300',
};

export default function SwipeCard({ profile, style, className = '' }) {
  const skills = (profile.technical_skills || []).slice(0, 5);
  const goals = profile.goals || [];
  const age = profile.birth_year ? new Date().getFullYear() - profile.birth_year : null;

  return (
    <div
      className={`w-full max-w-sm mx-auto overflow-hidden rounded-xl glass-card border border-primary/20 shadow-2xl ${className}`}
      style={style}
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
            {age && <span>{age}t</span>}
            {profile.school && (
              <span className="flex items-center gap-1 truncate">
                <GraduationCap className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">{profile.school}</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="p-4 space-y-3">
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
                <span key={g} className="font-mono text-[10px] px-2 py-0.5 rounded border border-primary/20 text-primary/70">
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
      </div>

      {/* Bottom primary line */}
      <div className="h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
    </div>
  );
}