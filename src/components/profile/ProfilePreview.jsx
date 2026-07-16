import React from 'react';
import { MapPin, GraduationCap, Award, User, Star, MessageSquare, Wrench, Sparkles, Target } from 'lucide-react';

const ROLE_COLORS = {
  'Data Analyst': 'border-blue-400/40 text-blue-300',
  'ML Engineer': 'border-neon/40 text-neon',
  'Backend Developer': 'border-purple-400/40 text-purple-300',
  'Quant Researcher': 'border-orange-400/40 text-orange-300',
  'Quant Developer': 'border-cyan-400/40 text-cyan-300',
  'Quant Trader': 'border-pink-400/40 text-pink-300',
  'All-rounder': 'border-yellow-400/40 text-yellow-300',
};

function PreviewBlock({ icon: Icon, title, children }) {
  return (
    <div className="glass-card rounded-xl border border-neon/10 overflow-hidden max-w-sm mx-auto w-full">
      <div className="px-4 py-2.5 border-b border-neon/10 flex items-center gap-2">
        {Icon && <Icon className="w-3.5 h-3.5 text-neon/70" />}
        <p className="font-display text-[10px] uppercase tracking-widest text-neon/70">{title}</p>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

export default function ProfilePreview({ profile }) {
  if (!profile) {
    return (
      <div className="glass-card rounded-xl border border-neon/10 p-8 text-center">
        <User className="w-12 h-12 text-neon/15 mx-auto mb-3" />
        <p className="font-body text-sm text-muted-foreground">Chưa có hồ sơ. Hãy lưu hồ sơ trước!</p>
      </div>
    );
  }

  const age = profile.birth_year ? new Date().getFullYear() - profile.birth_year : null;

  return (
    <div className="space-y-3">
      <p className="font-body text-xs text-muted-foreground/60 text-center mb-2">
        Đây là cách người khác nhìn thấy hồ sơ của bạn
      </p>

      {/* ── Avatar card ──────────────────────────────────────────── */}
      <div className="max-w-sm mx-auto overflow-hidden rounded-xl glass-card border border-neon/20 shadow-2xl">
        <div className="relative h-48 bg-gradient-to-br from-neon/10 via-transparent to-neon/5 grid-overlay">
          {profile.profile_image ? (
            <img src={profile.profile_image} alt={profile.display_name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <User className="w-20 h-20 text-neon/20" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/85" />
          {profile.role && (
            <div className="absolute top-3 left-3">
              <span className={`font-display text-[10px] tracking-widest uppercase px-2.5 py-1 rounded border glass-card ${ROLE_COLORS[profile.role] || 'border-neon/30 text-neon'}`}>
                {profile.role}
              </span>
            </div>
          )}
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <h3 className="font-display font-bold text-lg text-white">{profile.display_name}</h3>
            <div className="flex items-center flex-wrap gap-x-3 gap-y-0.5 text-white/70 text-xs font-mono mt-0.5">
              {age && <span>{age} tuổi</span>}
              {profile.school && (
                <span className="flex items-center gap-1 truncate">
                  <GraduationCap className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">{profile.school}</span>
                </span>
              )}
              {profile.major && <span className="truncate">{profile.major}</span>}
              {profile.city && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3 flex-shrink-0" /> {profile.city}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Bio ──────────────────────────────────────────────────── */}
      {profile.bio && (
        <PreviewBlock icon={MessageSquare} title="Giới thiệu">
          <p className="font-body text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">{profile.bio}</p>
        </PreviewBlock>
      )}

      {/* ── Kỹ năng kỹ thuật ─────────────────────────────────────── */}
      {(profile.technical_skills || []).length > 0 && (
        <PreviewBlock icon={Wrench} title="Kỹ năng kỹ thuật">
          <div className="flex flex-wrap gap-1.5">
            {(profile.technical_skills || []).map(skill => (
              <span key={skill} className="font-mono text-[10px] px-2 py-0.5 rounded border border-neon/20 text-neon/80 bg-neon/5">
                {skill}
              </span>
            ))}
          </div>
        </PreviewBlock>
      )}

      {/* ── Mindset / Soft skills ────────────────────────────────── */}
      {(profile.soft_skills || []).length > 0 && (
        <PreviewBlock icon={Sparkles} title="Mindset & Soft Skills">
          <div className="flex flex-wrap gap-1.5">
            {(profile.soft_skills || []).map(s => (
              <span key={s} className="font-mono text-[10px] px-2 py-0.5 rounded border border-blue-400/20 text-blue-300/80 bg-blue-400/5">{s}</span>
            ))}
          </div>
        </PreviewBlock>
      )}

      {/* ── Mục tiêu ─────────────────────────────────────────────── */}
      {(profile.goals || []).length > 0 && (
        <PreviewBlock icon={Target} title="Mục tiêu tham gia">
          <div className="flex flex-wrap gap-1.5">
            {(profile.goals || []).map(g => (
              <span key={g} className="font-mono text-[10px] px-2 py-0.5 rounded border border-neon/20 text-neon/70">{g}</span>
            ))}
          </div>
        </PreviewBlock>
      )}

      {/* ── Thành tích ───────────────────────────────────────────── */}
      {(profile.achievements || profile.achievements_other) && (
        <PreviewBlock icon={Award} title="Thành tích">
          <div className="space-y-2">
            {profile.achievements && (
              <div className="flex items-start gap-2">
                <Award className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0 mt-0.5" />
                <p className="font-mono text-[11px] text-yellow-300/90 leading-relaxed whitespace-pre-wrap">{profile.achievements}</p>
              </div>
            )}
            {profile.achievements_other && (
              <div className="flex items-start gap-2">
                <Star className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
                <p className="font-mono text-[11px] text-muted-foreground/80 leading-relaxed whitespace-pre-wrap">{profile.achievements_other}</p>
              </div>
            )}
          </div>
        </PreviewBlock>
      )}
    </div>
  );
}