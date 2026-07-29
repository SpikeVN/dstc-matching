import React, { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  MapPin, GraduationCap, Target, Award, User, FileText,
  Calendar, PersonStanding, Link, Heart, X, Eye, EyeOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDateTime } from '@/lib/timeUtils';
import SocialIcons from '@/components/profile/SocialIcons';
import CvViewer from '@/components/profile/CvViewer';
import SwipeHistoryPanel from '@/components/admin/SwipeHistoryPanel';

const ROLE_COLORS = {
  'Data Analyst': 'border-blue-400/40 text-blue-300',
  'ML Engineer': 'border-primary/40 text-primary',
  'Backend Developer': 'border-purple-400/40 text-purple-300',
  'Quant Researcher': 'border-orange-400/40 text-orange-300',
  'Quant Developer': 'border-cyan-400/40 text-cyan-300',
  'Quant Trader': 'border-pink-400/40 text-pink-300',
  'All-rounder': 'border-yellow-400/40 text-yellow-300',
};

const TAG_COLORS = {
  skills: 'bg-green-500/15 text-green-200 border-green-400/30',
  goals: 'bg-yellow-500/15 text-yellow-200 border-yellow-400/30',
  softSkills: 'bg-cyan-500/15 text-cyan-200 border-cyan-400/30',
  experience: 'bg-purple-500/15 text-purple-200 border-purple-400/30',
  achievements: 'bg-red-500/15 text-red-200 border-red-400/30',
};

export default function UserDetailModal({ user, profile, open, onClose }) {
  const [showSwipeHistory, setShowSwipeHistory] = useState(false);
  const [cvOpen, setCvOpen] = useState(false);

  if (!user) return null;

  // Use the full contestant profile if available, fall back to user admin data
  const p = profile || user;
  const skills = (p.technical_skills || []).slice(0, 5);
  const goals = p.goals || [];
  const genderShown = p.gender && p.gender !== 'Không muốn nói';

  return (
    <>
      <Dialog open={open} onOpenChange={(open) => { if (!open) onClose(); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="w-4 h-4 text-primary" />
              Chi tiết người dùng
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            {/* Header with avatar and basic info */}
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl overflow-hidden border border-primary/20 flex-shrink-0">
                {user.profile_image ? (
                  <img src={user.profile_image} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-muted/50">
                    <User className="w-6 h-6 text-primary/20" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-display font-bold text-base text-foreground">
                  {user.display_name || 'Unknown'}
                </h3>
                <p className="text-xs text-muted-foreground">{user.email}</p>
                {p.school && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                    <GraduationCap className="w-3 h-3 text-primary/60" />
                    {p.school}{p.major && ` · ${p.major}`}
                  </span>
                )}
              </div>
            </div>

            {/* Role */}
            {p.role && (
              <span className={`inline-block font-display text-[10px] px-2.5 py-1 rounded border ${ROLE_COLORS[p.role] || 'border-primary/30 text-primary'}`}>
                {p.role}
              </span>
            )}

            {/* Admin metadata */}
            <div className="flex flex-wrap gap-3 text-xs">
              {user.admin_role && (
                <span className="text-muted-foreground/70">
                  Vai trò: <span className="font-medium text-foreground">{user.admin_role}</span>
                </span>
              )}
              {user.admin_visible !== undefined && (
                <span className="flex items-center gap-1 text-muted-foreground/70">
                  {user.admin_visible ? (
                    <><Eye className="w-3 h-3 text-primary" /> Hiển thị</>
                  ) : (
                    <><EyeOff className="w-3 h-3 text-destructive/60" /> Ẩn</>
                  )}
                </span>
              )}
              {user.assigned_date && (
                <span className="text-muted-foreground/50">
                  Gán ngày: {formatDateTime(user.assigned_date, 'dd/MM/yy')}
                </span>
              )}
              {user.created_date && (
                <span className="text-muted-foreground/50">
                  Đã tạo: {formatDateTime(user.created_date, 'dd/MM/yy')}
                </span>
              )}
            </div>

            {/* City / Gender / Age */}
            {(p.city || genderShown || p.birth_year) && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {p.city && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-primary/60" /> {p.city}
                  </span>
                )}
                {genderShown && (
                  <span className="flex items-center gap-1">
                    <PersonStanding className="w-3.5 h-3.5 text-primary/60" /> {p.gender}
                  </span>
                )}
                {p.birth_year && (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-primary/60" /> {new Date().getFullYear() - p.birth_year} tuổi
                  </span>
                )}
              </div>
            )}

            {/* Bio */}
            {p.bio && (
              <div>
                <p className="font-display text-[10px] text-primary/60 mb-1">Giới thiệu</p>
                <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">{p.bio}</p>
              </div>
            )}

            {/* Tech skills */}
            {(p.technical_skills || []).length > 0 && (
              <div>
                <p className="font-display text-[10px] text-green-400/70 mb-1.5">Kỹ năng kỹ thuật</p>
                <div className="flex flex-wrap gap-1.5">
                  {p.technical_skills.map(s => (
                    <span key={s} className={`text-xs px-3 py-1 rounded-full border font-body font-medium ${TAG_COLORS.skills}`}>{s}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Soft skills */}
            {(p.soft_skills || []).length > 0 && (
              <div>
                <p className="font-display text-[10px] text-cyan-400/70 mb-1.5">Soft skills</p>
                <div className="flex flex-wrap gap-1.5">
                  {p.soft_skills.map(s => (
                    <span key={s} className={`text-xs px-3 py-1 rounded-full border font-body font-medium ${TAG_COLORS.softSkills}`}>{s}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Goals */}
            {goals.length > 0 && (
              <div>
                <p className="font-display text-[10px] text-yellow-400/70 mb-1.5">Mục tiêu</p>
                <div className="flex flex-wrap gap-1.5">
                  {goals.map(g => (
                    <span key={g} className={`text-xs px-3 py-1 rounded-full border font-body font-medium ${TAG_COLORS.goals}`}>{g}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Experience */}
            {p.experience && (
              <div>
                <p className="font-display text-[10px] text-purple-400/70 mb-1">Kinh nghiệm thi</p>
                <p className="text-xs text-purple-300/70">{p.experience}</p>
              </div>
            )}

            {/* Achievements */}
            {p.achievements && (
              <div>
                <p className="font-display text-[10px] text-red-400/70 mb-1">Thành tích</p>
                <p className="text-xs text-red-300/70 leading-relaxed">{p.achievements}</p>
              </div>
            )}

            {p.achievements_other && (
              <div>
                <p className="font-display text-[10px] text-red-400/70 mb-1">Thành tích khác</p>
                <p className="text-xs text-red-300/70 leading-relaxed">{p.achievements_other}</p>
              </div>
            )}

            {/* CV */}
            {p.cv_url && (
              <button onClick={() => setCvOpen(true)}
                className="inline-flex items-center gap-1.5 text-xs text-primary/70 hover:text-primary transition-colors">
                <FileText className="w-3.5 h-3.5" />
                <span className="underline underline-offset-2">Xem CV</span>
              </button>
            )}

            {/* Social links */}
            {p.social_links && Object.values(p.social_links).some(v => v?.trim()) && (
              <div className="flex items-center gap-1.5 text-xs">
                <Link className="w-3.5 h-3.5 text-primary/60" />
                <span className="text-muted-foreground">Liên kết</span>
                <SocialIcons links={p.social_links} />
              </div>
            )}

            {/* View swipe history button */}
            <div className="pt-2 border-t border-primary/10">
              <Button
                variant="outline"
                size="sm"
                className="w-full h-9 text-xs"
                onClick={() => setShowSwipeHistory(true)}
              >
                <Heart className="w-3.5 h-3.5 mr-1.5 text-pink-400" />
                Xem lịch sử vuốt
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {cvOpen && <CvViewer url={p.cv_url} onClose={() => setCvOpen(false)} />}

      {showSwipeHistory && (
        <SwipeHistoryPanel
          userId={user.id}
          userName={user.display_name || user.email}
          open={showSwipeHistory}
          onClose={() => setShowSwipeHistory(false)}
        />
      )}
    </>
  );
}
