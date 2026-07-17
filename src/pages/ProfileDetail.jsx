import { db } from '@/api/base44Client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { ArrowLeft, MapPin, GraduationCap, Award, Star, User, MessageSquare, Wrench, Sparkles, Target, Briefcase, Medal } from 'lucide-react';

const ROLE_COLORS = {
  'Data Analyst': 'border-blue-400/40 text-blue-300',
  'ML Engineer': 'border-primary/40 text-primary',
  'Backend Developer': 'border-purple-400/40 text-purple-300',
  'Quant Researcher': 'border-orange-400/40 text-orange-300',
  'Quant Developer': 'border-cyan-400/40 text-cyan-300',
  'Quant Trader': 'border-pink-400/40 text-pink-300',
  'All-rounder': 'border-yellow-400/40 text-yellow-300',
};

function DetailBlock({ icon: Icon, title, children }) {
  return (
    <div className="glass-card rounded-xl border border-primary/10 overflow-hidden">
      <div className="px-4 py-2.5 border-b border-primary/10 flex items-center gap-2">
        {Icon && <Icon className="w-3.5 h-3.5 text-primary/70" />}
        <p className="font-display text-[10px] text-primary/70">{title}</p>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

export default function ProfileDetail() {
  const [params] = useSearchParams();
  const profileId = params.get('id');
  const navigate = useNavigate();

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profileDetail', profileId],
    queryFn: () => db.entities.ContestantProfile.get(profileId),
    enabled: !!profileId,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center glass-card rounded-2xl p-8 border border-primary/15 max-w-sm w-full">
          <User className="w-12 h-12 text-primary/15 mx-auto mb-3" />
          <p className="font-body text-sm text-muted-foreground">Không tìm thấy hồ sơ</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate(-1)}>
            Quay lại
          </Button>
        </div>
      </div>
    );
  }

  const age = profile.birth_year ? new Date().getFullYear() - profile.birth_year : null;

  return (
    <div className="min-h-screen p-4 md:p-8 grid-overlay">
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Back */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-xs font-body text-muted-foreground hover:text-primary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Quay lại
        </button>

        {/* Avatar card */}
        <div className="overflow-hidden rounded-xl glass-card border border-primary/20 shadow-2xl">
          <div className="relative h-56 bg-gradient-to-br from-primary/10 via-transparent to-primary/5 grid-overlay">
            {profile.profile_image ? (
              <img src={profile.profile_image} alt={profile.display_name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <User className="w-20 h-20 text-primary/20" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/85" />
            {profile.role && (
              <div className="absolute top-3 left-3">
                <span className={`font-display text-[10px] px-2.5 py-1 rounded border glass-card ${ROLE_COLORS[profile.role] || 'border-primary/30 text-primary'}`}>
                  {profile.role}
                </span>
              </div>
            )}
            <div className="absolute bottom-0 left-0 right-0 p-5">
              <h2 className="font-display font-bold text-xl text-white">{profile.display_name}</h2>
              <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-white/70 text-xs font-mono mt-1">
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

        {/* Bio */}
        {profile.bio && (
          <DetailBlock icon={MessageSquare} title="Giới thiệu">
            <p className="font-body text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{profile.bio}</p>
          </DetailBlock>
        )}

        {/* Experience */}
        {profile.experience && (
          <DetailBlock icon={Medal} title="Kinh nghiệm thi">
            <p className="font-body text-sm text-foreground">{profile.experience}</p>
          </DetailBlock>
        )}

        {/* Technical skills */}
        {(profile.technical_skills || []).length > 0 && (
          <DetailBlock icon={Wrench} title="Kỹ năng kỹ thuật">
            <div className="flex flex-wrap gap-1.5">
              {(profile.technical_skills || []).map(skill => (
                <span key={skill} className="font-mono text-[11px] px-2 py-0.5 rounded border border-primary/20 text-primary/80 bg-primary/5">
                  {skill}
                </span>
              ))}
            </div>
          </DetailBlock>
        )}

        {/* Soft skills */}
        {(profile.soft_skills || []).length > 0 && (
          <DetailBlock icon={Sparkles} title="Mindset & Soft Skills">
            <div className="flex flex-wrap gap-1.5">
              {(profile.soft_skills || []).map(s => (
                <span key={s} className="font-mono text-[11px] px-2 py-0.5 rounded border border-blue-400/20 text-blue-300/80 bg-blue-400/5">{s}</span>
              ))}
            </div>
          </DetailBlock>
        )}

        {/* Goals */}
        {(profile.goals || []).length > 0 && (
          <DetailBlock icon={Target} title="Mục tiêu tham gia">
            <div className="flex flex-wrap gap-1.5">
              {(profile.goals || []).map(g => (
                <span key={g} className="font-mono text-[11px] px-2 py-0.5 rounded border border-primary/20 text-primary/70">{g}</span>
              ))}
            </div>
          </DetailBlock>
        )}

        {/* Achievements */}
        {(profile.achievements || profile.achievements_other) && (
          <DetailBlock icon={Award} title="Thành tích">
            <div className="space-y-3">
              {profile.achievements && (
                <div className="flex items-start gap-2">
                  <Award className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                  <p className="font-mono text-xs text-yellow-300/90 leading-relaxed whitespace-pre-wrap">{profile.achievements}</p>
                </div>
              )}
              {profile.achievements_other && (
                <div className="flex items-start gap-2">
                  <Star className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <p className="font-mono text-xs text-muted-foreground/80 leading-relaxed whitespace-pre-wrap">{profile.achievements_other}</p>
                </div>
              )}
            </div>
          </DetailBlock>
        )}

        {/* Message button */}
        <Button
          className="w-full h-10 font-display text-sm font-medium gap-2 bg-primary text-background hover:bg-primary/90"
          onClick={() => navigate('/matches')}
        >
          <MessageSquare className="w-4 h-4" /> Nhắn tin
        </Button>
      </div>
    </div>
  );
}