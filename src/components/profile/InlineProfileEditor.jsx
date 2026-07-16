import { db } from '@/api/base44Client';

import React, { useState, useRef, useCallback } from 'react';

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Camera, Save, User, Briefcase, MessageSquare, Wrench, Brain, Sparkles, Medal, Target, Award } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  VIETNAM_CITIES, TOOL_SKILLS, FRAMEWORK_SKILLS, SKILLSET, SOFT_SKILLS,
  EXPERIENCE_OPTIONS, GOAL_OPTIONS, ROLE_OPTIONS } from
'@/lib/constants';

// ─── Inline editable text field (controlled — commits every keystroke) ──────
function InlineField({ label, value, onChange, placeholder, multiline, type = 'text' }) {
  const [editing, setEditing] = useState(false);
  const inputRef = useRef();

  const startEdit = () => { setEditing(true); setTimeout(() => inputRef.current?.focus(), 50); };
  const commit = () => setEditing(false);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !multiline) { e.preventDefault(); commit(); }
    if (e.key === 'Escape') commit();
  };

  if (editing) {
    return (
      <div className="space-y-1.5">
        {label && <p className="font-display text-[10px] uppercase tracking-widest text-neon/60">{label}</p>}
        {multiline ? (
          <Textarea ref={inputRef} value={value || ''} onChange={(e) => onChange(e.target.value)}
            onBlur={commit}
            className="text-sm bg-muted/50 border-neon/40 focus:border-neon text-foreground resize-none min-h-[72px] flex-1"
            onKeyDown={(e) => e.key === 'Escape' && commit()} />
        ) : (
          <Input ref={inputRef} type={type} value={value || ''} onChange={(e) => onChange(e.target.value)}
            onBlur={commit}
            className="text-sm bg-muted/50 border-neon/40 focus:border-neon text-foreground h-9 flex-1"
            onKeyDown={handleKeyDown} />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {label && <p className="font-display text-[10px] uppercase tracking-widest text-neon/60">{label}</p>}
      <button onClick={startEdit}
      className="w-full text-left flex items-center gap-2 group px-3 py-2 rounded-lg border border-transparent hover:border-neon/20 hover:bg-neon/5 transition-all min-h-[36px]">
        <span className={`font-body text-sm flex-1 ${value ? 'text-foreground' : 'text-muted-foreground/40 italic'}`}>
          {value || placeholder || 'Nhấn để chỉnh sửa...'}
        </span>
      </button>
    </div>
  );
}

function InlineSelect({ label, value, options, onChange, placeholder }) {
  return (
    <div className="space-y-1.5">
      {label && <p className="font-display text-[10px] uppercase tracking-widest text-neon/60">{label}</p>}
      <Select value={value || ''} onValueChange={(v) => onChange(v)}>
        <SelectTrigger className="h-9 text-sm bg-muted/40 border-neon/15 hover:border-neon/30 focus:border-neon/50 text-foreground">
          <SelectValue placeholder={placeholder || 'Chọn...'} />
        </SelectTrigger>
        <SelectContent className="bg-card border-neon/20 text-sm">
          {options.map((o) => <SelectItem key={o.value || o} value={o.value || o}>{o.label || o}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

function TagGroup({ label, all, selected, onToggle, variant = 'primary' }) {
  const activeClass = variant === 'soft' ?
  'bg-blue-500/10 border-blue-400/40 text-blue-300' :
  'bg-neon/10 border-neon/40 text-neon';
  return (
    <div className="space-y-2">
      {label && <p className="font-display text-[10px] uppercase tracking-widest text-neon/60">{label}</p>}
      <div className="flex flex-wrap gap-1.5">
        {all.map((item) =>
        <button key={item} onClick={() => onToggle(item)}
        className={`text-xs px-2.5 py-1 rounded border transition-all font-body ${
        selected.includes(item) ? activeClass : 'border-neon/10 text-muted-foreground hover:border-neon/25 hover:text-foreground'}`
        }>
            {item}
          </button>
        )}
      </div>
    </div>
  );
}

function SectionCard({ icon: Icon, title, children }) {
  return (
    <div className="glass-card rounded-xl border border-neon/10 overflow-hidden">
      <div className="px-4 py-3 border-b border-neon/10 flex items-center gap-2">
        {Icon && <Icon className="w-3.5 h-3.5 text-neon/70" />}
        <h3 className="font-display text-xs tracking-widest uppercase neon-text">{title}</h3>
      </div>
      <div className="p-4 space-y-4">{children}</div>
    </div>
  );
}

// Compress image client-side before upload
async function compressImage(file) {
  if (!file.type.startsWith('image/') || file.size < 300 * 1024) return file;
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 720;
      let w = img.width, h = img.height;
      if (w > MAX || h > MAX) {
        if (w > h) { h = Math.round(h * MAX / w); w = MAX; } else
        { w = Math.round(w * MAX / h); h = MAX; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => resolve(new File([blob], 'photo.jpg', { type: 'image/jpeg' })), 'image/jpeg', 0.78);
    };
    img.src = url;
  });
}

// ─── Main component ──────────────────────────────────────────────────────────
export default function InlineProfileEditor({ profile, onSave }) {
  // Initialize once — NOT re-initialized on prop change to avoid data loss
  const [form, setForm] = useState(() => ({
    bio: profile?.bio || '',
    display_name: profile?.display_name || '',
    birth_year: profile?.birth_year || null,
    gender: profile?.gender || '',
    city: profile?.city || '',
    school: profile?.school || '',
    major: profile?.major || '',
    technical_skills: profile?.technical_skills || [],
    soft_skills: profile?.soft_skills || [],
    experience: profile?.experience || '',
    goals: profile?.goals || [],
    roles: Array.isArray(profile?.roles) && profile.roles.length > 0 ?
    profile.roles :
    profile?.role ? [profile.role] : [],
    role: profile?.role || '',
    achievements: profile?.achievements || '',
    achievements_other: profile?.achievements_other || '',
    profile_image: profile?.profile_image || ''
  }));
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const update = useCallback((field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const toggleArray = useCallback((field, item) => {
    setForm((prev) => {
      const current = prev[field] || [];
      const next = current.includes(item) ? current.filter((i) => i !== item) : [...current, item];
      return { ...prev, [field]: next };
    });
  }, []);

  const handleSave = async () => {
    if (!form.display_name?.trim()) {
      toast.error('Vui lòng điền họ tên trước khi lưu!', { duration: 3000 });
      return;
    }
    setSaving(true);
    try {
      await onSave({ ...form, role: form.roles?.[0] || '', profile_complete: true });
      toast.success('Hồ sơ đã được lưu!', { duration: 2000 });
    } catch (err) {
      toast.error('Lưu thất bại: ' + (err?.message || 'Lỗi không xác định'), { duration: 4000 });
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const compressed = await compressImage(file);
    const { file_url } = await db.integrations.Core.UploadFile({ file: compressed });
    update('profile_image', file_url);
    await onSave({ ...form, profile_image: file_url, profile_complete: true });
    setUploading(false);
    toast.success('Ảnh đã được cập nhật!', { duration: 1500 });
  };

  return (
    <div className="space-y-4">
      {/* ── Avatar + Info cơ bản ─────────────────────────────────── */}
      <SectionCard icon={User} title="Ảnh & Thông tin cơ bản">
        <div className="flex gap-4 items-start">
          {/* Avatar */}
          <div className="relative group flex-shrink-0">
            <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-neon/30 flex items-center justify-center bg-muted/50"
            style={{ boxShadow: '0 0 16px rgba(49,209,162,0.15)' }}>
              {form.profile_image ?
              <img src={form.profile_image} alt="avatar" className="w-full h-full object-cover" /> :
              <Camera className="w-7 h-7 text-neon/30" />
              }
            </div>
            <label className="absolute bottom-0 right-0 w-7 h-7 bg-neon rounded-full flex items-center justify-center cursor-pointer shadow-lg hover:scale-110 transition-transform">
              <Camera className="w-3 h-3 text-background" />
              <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploading} />
            </label>
            {uploading &&
            <div className="absolute inset-0 bg-background/70 rounded-2xl flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-neon/20 border-t-neon rounded-full animate-spin" />
              </div>
            }
          </div>
          {/* Name + birth year */}
          <div className="flex-1 space-y-2 min-w-0">
            <InlineField label="Họ tên *" value={form.display_name}
            onChange={(v) => update('display_name', v)} placeholder="Nguyễn Văn A" />
            <InlineField label="Năm sinh" value={form.birth_year ? String(form.birth_year) : ''}
            onChange={(v) => {
              const n = parseInt(v);
              update('birth_year', isNaN(n) ? null : n);
            }}
            placeholder="2004" type="number" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <InlineField label="Trường" value={form.school}
          onChange={(v) => update('school', v)} placeholder="ĐH Ngoại Thương..." />
          <InlineField label="Ngành học" value={form.major}
          onChange={(v) => update('major', v)} placeholder="Khoa học dữ liệu" />
          <InlineSelect label="Giới tính" value={form.gender} onChange={(v) => update('gender', v)}
          options={['Nam', 'Nữ', 'Không muốn nói']} placeholder="Chọn..." />
          <InlineSelect label="Tỉnh/Thành phố" value={form.city} onChange={(v) => update('city', v)}
          options={VIETNAM_CITIES} placeholder="Chọn tỉnh/thành..." />
        </div>
      </SectionCard>

      {/* ── Vai trò ──────────────────────────────────────────────── */}
      <SectionCard icon={Briefcase} title="Vai trò mong muốn">
        <TagGroup all={ROLE_OPTIONS} selected={form.roles || []}
        onToggle={(r) => {
          const current = form.roles || [];
          const next = current.includes(r) ? [] : [r];
          update('roles', next);
        }} />
        <p className="font-body text-[10px] text-muted-foreground/50 mt-1">Chọn 1 vai trò phù hợp nhất với bạn</p>
      </SectionCard>

      {/* ── Bio ─────────────────────────────────────────────────── */}
      <SectionCard icon={MessageSquare} title="Giới thiệu bản thân">
        <InlineField value={form.bio} onChange={(v) => update('bio', v)}
        placeholder="Viết vài dòng về bản thân, đam mê, mục tiêu..." multiline />
      </SectionCard>

      {/* ── Tools & Libraries ───────────────────────────────────── */}
      <SectionCard icon={Wrench} title="Tools & Libraries">
        <p className="font-display text-[10px] uppercase tracking-widest text-neon/60 -mb-1">Tools</p>
        <TagGroup all={TOOL_SKILLS} selected={form.technical_skills}
        onToggle={(s) => toggleArray('technical_skills', s)} />
        <p className="font-display text-[10px] uppercase tracking-widest text-neon/60 -mb-1 mt-2">Frameworks & Libraries</p>
        <TagGroup all={FRAMEWORK_SKILLS} selected={form.technical_skills}
        onToggle={(s) => toggleArray('technical_skills', s)} />
      </SectionCard>

      {/* ── Skillset ─────────────────────────────────────────────── */}
      <SectionCard icon={Brain} title="Skillset">
        <TagGroup all={SKILLSET} selected={form.technical_skills}
        onToggle={(s) => toggleArray('technical_skills', s)} />
      </SectionCard>

      {/* ── Mindset / Soft skills ───────────────────────────────── */}
      <SectionCard icon={Sparkles} title="Mindset & Soft Skills">
        <TagGroup all={SOFT_SKILLS} selected={form.soft_skills}
        onToggle={(s) => toggleArray('soft_skills', s)} variant="soft" />
      </SectionCard>

      {/* ── Kinh nghiệm ─────────────────────────────────────────── */}
      <SectionCard icon={Medal} title="Kinh nghiệm thi">
        <TagGroup all={EXPERIENCE_OPTIONS.map((e) => e.value)} selected={form.experience ? [form.experience] : []}
        onToggle={(e) => update('experience', form.experience === e ? '' : e)} />
      </SectionCard>

      {/* ── Mục tiêu ────────────────────────────────────────────── */}
      <SectionCard icon={Target} title="Mục tiêu tham gia">
        <TagGroup all={GOAL_OPTIONS.map((g) => g.value)} selected={form.goals}
        onToggle={(g) => toggleArray('goals', g)} />
      </SectionCard>

      {/* ── Thành tích ──────────────────────────────────────────── */}
      <SectionCard icon={Award} title="Thành tích nổi bật">
        <InlineField label="Thành tích trong Vòng 1 DSTC - VQC 2026" value={form.achievements}
        onChange={(v) => update('achievements', v)}
        placeholder="VD: Top 10 DSTC 2025, Giải Nhì Hackathon ABC..." multiline />
        <InlineField label="Thành tích khác" value={form.achievements_other}
        onChange={(v) => update('achievements_other', v)}
        placeholder="Các giải thưởng, dự án, chứng chỉ nổi bật khác..." multiline />
      </SectionCard>

      {/* ── Save button ─────────────────────────────────────────── */}
      <Button
        onClick={handleSave}
        disabled={saving}
        className="w-full gap-2 font-display text-sm uppercase tracking-widest bg-neon text-background hover:bg-neon/90 disabled:opacity-60"
        style={{ boxShadow: '0 0 16px rgba(49,209,162,0.35)' }}>
        {saving ?
        <><div className="w-4 h-4 border-2 border-background/30 border-t-background rounded-full animate-spin" /> Đang lưu...</> :
        <><Save className="w-4 h-4" /> Lưu hồ sơ</>
        }
      </Button>

      {!form.display_name?.trim() &&
      <p className="text-center font-body text-xs text-destructive/80 pb-1">
          Cần điền ít nhất <strong>Họ tên</strong> để lưu hồ sơ
        </p>
      }

      <p className="text-center font-body text-[10px] text-muted-foreground/40 pb-2">
        Nhấn "Lưu hồ sơ" để lưu tất cả thay đổi
      </p>
    </div>
  );
}