import { db } from '@/api/base44Client';

import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Camera, Save, X } from 'lucide-react';

import { toast } from 'sonner';
import {
  VIETNAM_CITIES, TECHNICAL_SKILLS, SOFT_SKILLS,
  EXPERIENCE_OPTIONS, GOAL_OPTIONS, ROLE_OPTIONS, DOMAIN_OPTIONS
} from '@/lib/constants';

function SectionCard({ title, children }) {
  return (
    <div className="glass-card rounded-xl border border-neon/10 overflow-hidden">
      <div className="px-4 py-3 border-b border-neon/10">
        <h3 className="font-display text-xs tracking-widest uppercase neon-text">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function TagButton({ active, onClick, children, variant = 'primary' }) {
  const activeClass = variant === 'soft'
    ? 'bg-blue-500/10 border-blue-400/40 text-blue-300'
    : 'bg-neon/10 border-neon/40 text-neon';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-sm px-3 py-1.5 rounded border transition-all flex items-center gap-1 ${
        active
          ? activeClass
          : 'border-neon/10 text-muted-foreground hover:border-neon/25 hover:text-foreground'
      }`}
    >
      {active && <X className="w-2.5 h-2.5 flex-shrink-0" />}
      {children}
    </button>
  );
}

function OptionCard({ active, onClick, label, desc }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left px-4 py-3 rounded-lg border transition-all w-full ${
        active
          ? 'bg-neon/10 border-neon/40 text-foreground'
          : 'border-neon/10 text-muted-foreground hover:border-neon/25 hover:text-foreground hover:bg-neon/5'
      }`}
    >
      <p className="text-sm font-medium">{label}</p>
      {desc && <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>}
    </button>
  );
}

export default function ProfileForm({ profile, onSave }) {
  const [form, setForm] = useState({
    bio: profile?.bio || '',
    display_name: profile?.display_name || '',
    age: profile?.age || '',
    gender: profile?.gender || '',
    city: profile?.city || '',
    school: profile?.school || '',
    major: profile?.major || '',
    domain_business: profile?.domain_business || '',
    technical_skills: profile?.technical_skills || [],
    soft_skills: profile?.soft_skills || [],
    experience: profile?.experience || '',
    goals: profile?.goals || [],
    role: profile?.role || '',
    achievements: profile?.achievements || '',
    profile_image: profile?.profile_image || '',
  });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await db.integrations.Core.UploadFile({ file });
    setForm(prev => ({ ...prev, profile_image: file_url }));
    setUploading(false);
  };

  const toggleArrayItem = (field, item) => {
    setForm(prev => ({
      ...prev,
      [field]: prev[field].includes(item)
        ? prev[field].filter(i => i !== item)
        : [...prev[field], item]
    }));
  };

  const handleSubmit = async () => {
    if (!form.display_name) { toast.error('Vui lòng nhập họ tên'); return; }
    setSaving(true);
    await onSave({ ...form, profile_complete: true });
    setSaving(false);
    toast.success('Đã lưu hồ sơ!');
  };

  const inputClass = "text-sm bg-muted/50 border-neon/15 focus:border-neon/50 text-foreground placeholder:text-muted-foreground h-9";
  const textareaClass = "text-sm bg-muted/50 border-neon/15 focus:border-neon/50 text-foreground placeholder:text-muted-foreground resize-none min-h-[80px]";

  return (
    <div className="space-y-4">
      {/* Avatar */}
      <div className="flex justify-center py-2">
        <div className="relative group">
          <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-neon/30 flex items-center justify-center bg-muted/50"
            style={{ boxShadow: '0 0 20px rgba(49,209,162,0.15)' }}>
            {form.profile_image ? (
              <img src={form.profile_image} alt="avatar" className="w-full h-full object-cover" />
            ) : (
              <Camera className="w-8 h-8 text-neon/30" />
            )}
          </div>
          <label className="absolute bottom-0 right-0 w-8 h-8 bg-neon rounded-full flex items-center justify-center cursor-pointer shadow-lg hover:scale-110 transition-transform">
            <Camera className="w-3.5 h-3.5 text-background" />
            <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
          </label>
          {uploading && (
            <div className="absolute inset-0 bg-background/60 rounded-full flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-neon/20 border-t-neon rounded-full animate-spin" />
            </div>
          )}
        </div>
      </div>

      {/* Basic Info */}
      <SectionCard title="Thông tin cơ bản">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { label: 'Họ tên *', field: 'display_name', placeholder: 'Nguyễn Văn A' },
            { label: 'Trường', field: 'school', placeholder: 'ĐH Ngoại Thương...' },
            { label: 'Ngành học', field: 'major', placeholder: 'Khoa học dữ liệu' },
            { label: 'Tuổi', field: 'age', placeholder: '20', type: 'number' },
          ].map(({ label, field, placeholder, type }) => (
            <div key={field} className="space-y-1.5">
              <Label className="font-mono text-[10px] uppercase tracking-widest text-neon/60">{label}</Label>
              <Input
                type={type || 'text'}
                value={form[field]}
                onChange={e => setForm(prev => ({ ...prev, [field]: type === 'number' ? parseInt(e.target.value) || '' : e.target.value }))}
                placeholder={placeholder}
                className={inputClass}
              />
            </div>
          ))}
          <div className="space-y-1.5">
            <Label className="font-mono text-[10px] uppercase tracking-widest text-neon/60">Giới tính</Label>
            <Select value={form.gender} onValueChange={v => setForm(prev => ({ ...prev, gender: v }))}>
              <SelectTrigger className={inputClass}><SelectValue placeholder="Chọn..." /></SelectTrigger>
              <SelectContent className="bg-card border-neon/20 text-sm">
                {["Nam", "Nữ", "Không muốn nói"].map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="font-mono text-[10px] uppercase tracking-widest text-neon/60">Tỉnh/Thành phố</Label>
            <Select value={form.city} onValueChange={v => setForm(prev => ({ ...prev, city: v }))}>
              <SelectTrigger className={inputClass}><SelectValue placeholder="Chọn tỉnh/thành phố..." /></SelectTrigger>
              <SelectContent className="bg-card border-neon/20 text-sm max-h-52">
                {VIETNAM_CITIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </SectionCard>

      {/* Bio - sau thông tin cơ bản */}
      <SectionCard title="Giới thiệu bản thân">
        <Textarea
          placeholder="Viết vài dòng về bản thân, đam mê, mục tiêu..."
          value={form.bio}
          onChange={e => setForm(prev => ({ ...prev, bio: e.target.value }))}
          className={textareaClass}
        />
      </SectionCard>

      {/* Role & Domain */}
      <SectionCard title="Vai trò & Lĩnh vực">
        <div className="space-y-3">
          <div className="space-y-2">
            <Label className="font-mono text-[10px] uppercase tracking-widest text-neon/60">Vai trò mong muốn</Label>
            <div className="flex flex-wrap gap-2">
              {ROLE_OPTIONS.map(role => (
                <TagButton key={role} active={form.role === role} onClick={() => setForm(prev => ({ ...prev, role }))}>
                  {role}
                </TagButton>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="font-mono text-[10px] uppercase tracking-widest text-neon/60">Domain Business</Label>
            <Select value={form.domain_business} onValueChange={v => setForm(prev => ({ ...prev, domain_business: v }))}>
              <SelectTrigger className={inputClass}><SelectValue placeholder="Chọn lĩnh vực..." /></SelectTrigger>
              <SelectContent className="bg-card border-neon/20 text-sm">
                {DOMAIN_OPTIONS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </SectionCard>

      {/* Technical Skills */}
      <SectionCard title="Kỹ năng kỹ thuật">
        <div className="flex flex-wrap gap-2">
          {TECHNICAL_SKILLS.map(skill => (
            <TagButton key={skill} active={form.technical_skills.includes(skill)} onClick={() => toggleArrayItem('technical_skills', skill)}>
              {skill}
            </TagButton>
          ))}
        </div>
      </SectionCard>

      {/* Soft Skills */}
      <SectionCard title="Kỹ năng mềm">
        <div className="flex flex-wrap gap-2">
          {SOFT_SKILLS.map(skill => (
            <TagButton key={skill} active={form.soft_skills.includes(skill)} variant="soft" onClick={() => toggleArrayItem('soft_skills', skill)}>
              {skill}
            </TagButton>
          ))}
        </div>
      </SectionCard>

      {/* Experience */}
      <SectionCard title="Kinh nghiệm">
        <div className="grid grid-cols-1 gap-2">
          {EXPERIENCE_OPTIONS.map(exp => (
            <OptionCard
              key={exp.value}
              active={form.experience === exp.value}
              onClick={() => setForm(prev => ({ ...prev, experience: exp.value }))}
              label={exp.label}
              desc={exp.desc}
            />
          ))}
        </div>
      </SectionCard>

      {/* Goals */}
      <SectionCard title="Mục tiêu tham gia">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {GOAL_OPTIONS.map(goal => (
            <OptionCard
              key={goal.value}
              active={form.goals.includes(goal.value)}
              onClick={() => toggleArrayItem('goals', goal.value)}
              label={goal.label}
              desc={goal.desc}
            />
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-2">Có thể chọn nhiều mục tiêu</p>
      </SectionCard>

      {/* Achievements */}
      <SectionCard title="Thành tích nổi bật">
        <Textarea
          placeholder="VD: Vòng 1 DSTC 2024, Giải Nhì Hackathon ABC..."
          value={form.achievements}
          onChange={e => setForm(prev => ({ ...prev, achievements: e.target.value }))}
          className={textareaClass}
        />
      </SectionCard>

      {/* Submit */}
      <Button
        onClick={handleSubmit}
        disabled={saving}
        className="w-full h-11 font-display text-xs uppercase tracking-widest gap-2 bg-neon text-background hover:bg-neon/90 neon-glow-strong"
      >
        <Save className="w-4 h-4" />
        {saving ? 'Đang lưu...' : 'Lưu hồ sơ'}
      </Button>
    </div>
  );
}