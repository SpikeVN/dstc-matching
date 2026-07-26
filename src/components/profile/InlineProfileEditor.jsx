import { db } from '@/api/apiClient';

import React, { useState, useRef, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react';

import { Textarea } from '@/components/ui/textarea';
import { ChevronDown, Camera, Save, User, Briefcase, MessageSquare, Wrench, Brain, Sparkles, Medal, Target, Award, Plus, FileText, Upload, X, Link, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import ImageCropModal from '@/components/profile/ImageCropModal';
import {
  VIETNAM_CITIES, TOOL_SKILLS, FRAMEWORK_SKILLS, SKILLSET, SOFT_SKILLS,
  EXPERIENCE_OPTIONS, GOAL_OPTIONS, ROLE_OPTIONS, SOCIAL_PLATFORMS
} from
  '@/lib/constants';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// ─── Inline editable text field — underline style ──────────────────────────
function InlineField({ label, value, onChange, placeholder, multiline = false, type = 'text', className = '' }) {
  return (
    <div className="space-y-1">
      {label && <p className="font-display text-[10px] text-primary/60">{label}</p>}
      {multiline ? (
        <Textarea value={value || ''} onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder || 'Nhấn để chỉnh sửa...'}
          className="text-sm bg-transparent border-0 border-b-2 border-primary/20 focus:border-primary rounded-none px-0 py-2 text-foreground resize-none min-h-[72px] flex-1 focus-visible:ring-0 focus-visible:ring-offset-0 transition-colors cursor-text" />
      ) : (
        <input type={type} value={value || ''} onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder || 'Nhấn để chỉnh sửa...'}
          className={`text-sm bg-transparent border-0 border-b-2 border-primary/20 focus:border-primary rounded-none px-0 py-2 h-9 w-full focus-visible:ring-0 focus-visible:ring-offset-0 transition-colors focus:text-primary cursor-text outline-none ${className}`} />
      )}
    </div>
  );
}

function InlineSelect({ label, value, options, onChange, placeholder }) {
  return (
    <div className="space-y-1">
      {label && <p className="font-display text-[10px] text-primary/60">{label}</p>}
      <Select value={value || ''} onValueChange={onChange}>
        <SelectTrigger className="h-9 text-sm bg-transparent border-0 border-b-2 border-primary/20 hover:border-primary/30 focus:border-primary rounded-none px-0 py-2 w-full text-foreground shadow-none focus:ring-0 focus:ring-offset-0 [&>svg]:text-foreground/40">
          <SelectValue placeholder={placeholder || 'Chọn...'} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => {
            const v = typeof o === 'string' ? o : o.value;
            const lbl = typeof o === 'string' ? o : o.label;
            return (
              <SelectItem key={v} value={v}>{lbl}</SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
}

function TagGroup({ label, all, selected, onToggle, variant = 'primary' }) {
  const [customInput, setCustomInput] = useState('');
  const inputRef = useRef();

  const activeClass = variant === 'soft'
    ? 'bg-blue-500/20 text-blue-200 border-blue-400/30'
    : 'bg-primary/15 text-primary border-primary/25';
  const inactiveClass = 'bg-muted/30 text-muted-foreground border-transparent hover:bg-muted/50 hover:text-foreground';

  // Custom tags: items in selected that aren't in the preset list
  const customTags = selected.filter(s => !all.includes(s));

  const handleAdd = () => {
    const val = customInput.trim();
    if (val && !selected.includes(val)) {
      onToggle(val);
      setCustomInput('');
    }
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); handleAdd(); }
    if (e.key === 'Escape') { setCustomInput(''); inputRef.current?.blur(); }
  };

  return (
    <div className="space-y-2">
      {label && <p className="font-display text-[10px] text-primary/60">{label}</p>}
      <div className="flex flex-wrap gap-1.5 items-center">
        {all.map((item) =>
          <button key={item} onClick={() => onToggle(item)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-all font-body font-medium outline-none focus-visible:ring-1 focus-visible:ring-ring ${selected.includes(item) ? activeClass : inactiveClass}`}>
            {item}
          </button>
        )}
        {customTags.map((item) =>
          <button key={item} onClick={() => onToggle(item)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-all font-body font-medium outline-none focus-visible:ring-1 focus-visible:ring-ring ${activeClass}`}>
            {item}
          </button>
        )}
        <input
          ref={inputRef}
          type="text"
          value={customInput}
          onChange={(e) => setCustomInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Thêm..."
          className="text-xs bg-transparent border-b border-primary/20 focus:border-primary rounded-none px-1.5 py-1.5 w-20 text-foreground placeholder:text-muted-foreground/40 outline-none cursor-text"
        />
        {customInput.trim() && (
          <button onClick={handleAdd}
            className="p-1 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-all outline-none focus-visible:ring-1 focus-visible:ring-ring">
            <Plus className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}

function SectionCard({ icon: Icon, title, children }) {
  return (
    <div className="glass-card rounded-xl border border-primary/10 overflow-hidden">
      <div className="px-4 py-3 border-b border-primary/10 flex items-center gap-2">
        {Icon && <Icon className="w-3.5 h-3.5 text-primary/70" />}
        <h3 className="font-display text-sm font-semibold text-primary">{title}</h3>
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
        if (w > h) { h = Math.round(h * MAX / w); w = MAX; } else { w = Math.round(w * MAX / h); h = MAX; }
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
const InlineProfileEditor = forwardRef(function InlineProfileEditor({ profile, onSave, onSavingChange, onDirtyChange }, ref) {
  // Split technical_skills into three buckets so sections don't bleed into each other
  const initialSkills = profile?.technical_skills || [];
  const toolSkillSet = new Set(TOOL_SKILLS);
  const frameworkSkillSet = new Set(FRAMEWORK_SKILLS);
  const skillsetSet = new Set(SKILLSET);

  // Snapshot the initial profile for dirty-checking
  const initialSnapshotRef = useRef(profile);

  // Initialize once — NOT re-initialized on prop change to avoid data loss
  const [form, setForm] = useState(() => ({
    bio: profile?.bio || '',
    display_name: profile?.display_name || '',
    birth_year: profile?.birth_year || null,
    gender: profile?.gender || '',
    city: profile?.city || '',
    school: profile?.school || '',
    major: profile?.major || '',
    tool_skills: initialSkills.filter(s => toolSkillSet.has(s)),
    framework_skills: initialSkills.filter(s => frameworkSkillSet.has(s)),
    skillset_skills: initialSkills.filter(s => skillsetSet.has(s)),
    // Custom tech skills that don't belong to any preset list
    custom_tech_skills: initialSkills.filter(s => !toolSkillSet.has(s) && !frameworkSkillSet.has(s) && !skillsetSet.has(s)),
    soft_skills: profile?.soft_skills || [],
    experience: profile?.experience || '',
    goals: profile?.goals || [],
    roles: Array.isArray(profile?.roles) && profile.roles.length > 0 ?
      profile.roles :
      profile?.role ? [profile.role] : [],
    role: profile?.role || '',
    achievements: profile?.achievements || '',
    achievements_other: profile?.achievements_other || '',
    profile_image: profile?.profile_image || '',
    cv_url: profile?.cv_url || '',
    social_links: profile?.social_links || {}
  }));
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState(null);

  // Dirty-check: compare current form against the initial profile snapshot
  useEffect(() => {
    const snap = initialSnapshotRef.current;
    if (!snap) { onDirtyChange?.(true); return; } // new profile, always dirty once touched
    const technical_skills = [...new Set([...form.tool_skills, ...form.framework_skills, ...form.skillset_skills, ...form.custom_tech_skills])];
    const dirty =
      form.display_name !== (snap.display_name || '') ||
      form.bio !== (snap.bio || '') ||
      form.birth_year !== (snap.birth_year ?? null) ||
      form.gender !== (snap.gender || '') ||
      form.city !== (snap.city || '') ||
      form.school !== (snap.school || '') ||
      form.major !== (snap.major || '') ||
      form.experience !== (snap.experience || '') ||
      form.role !== (snap.role || '') ||
      form.achievements !== (snap.achievements || '') ||
      form.achievements_other !== (snap.achievements_other || '') ||
      form.profile_image !== (snap.profile_image || '') ||
      form.cv_url !== (snap.cv_url || '') ||
      JSON.stringify(technical_skills) !== JSON.stringify(snap.technical_skills || []) ||
      JSON.stringify(form.soft_skills) !== JSON.stringify(snap.soft_skills || []) ||
      JSON.stringify(form.goals) !== JSON.stringify(snap.goals || []) ||
      JSON.stringify(form.roles) !== JSON.stringify(Array.isArray(snap.roles) && snap.roles.length > 0 ? snap.roles : snap.role ? [snap.role] : []) ||
      JSON.stringify(form.social_links) !== JSON.stringify(snap.social_links || {});
    onDirtyChange?.(dirty);
  }, [form, onDirtyChange]);

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
    onSavingChange?.(true);
    try {
      const technical_skills = [...new Set([...form.tool_skills, ...form.framework_skills, ...form.skillset_skills, ...form.custom_tech_skills])];
      const { tool_skills, framework_skills, skillset_skills, custom_tech_skills, ...rest } = form;
      await onSave({ ...rest, technical_skills, role: form.roles?.[0] || '', profile_complete: true });
      // Reset dirty state — current form is now the saved baseline
      initialSnapshotRef.current = { ...form, technical_skills };
      onDirtyChange?.(false);
      toast.success('Hồ sơ đã được lưu!', { duration: 2000 });
    } catch (err) {
      toast.error('Lưu thất bại: ' + (err?.message || 'Lỗi không xác định'), { duration: 4000 });
    } finally {
      setSaving(false);
      onSavingChange?.(false);
    }
  };

  // Expose save handler and saving state to parent (for sticky header button)
  useImperativeHandle(ref, () => ({
    save: handleSave,
    get saving() { return saving; },
  }), [handleSave, saving]);

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    // Revoke any previous object URL to avoid leaks
    if (cropImageSrc) URL.revokeObjectURL(cropImageSrc);
    setCropImageSrc(URL.createObjectURL(file));
    // Reset the input so the same file can be re-selected
    e.target.value = '';
  };

  const handleCropConfirm = async (croppedFile) => {
    setCropImageSrc(null);
    if (!croppedFile) return;
    setUploading(true);
    try {
      const compressed = await compressImage(croppedFile);
      const { file_url, error } = await db.integrations.Core.UploadFile({ file: compressed });
      if (!file_url) { toast.error(error || 'Tải ảnh thất bại'); return; }
      setImgError(false);
      update('profile_image', file_url);
      const technical_skills = [...new Set([...form.tool_skills, ...form.framework_skills, ...form.skillset_skills, ...form.custom_tech_skills])];
      const { tool_skills, framework_skills, skillset_skills, custom_tech_skills, ...rest } = form;
      await onSave({ ...rest, technical_skills, profile_image: file_url, profile_complete: true });
      toast.success('Ảnh đã được cập nhật!', { duration: 1500 });
    } catch (err) {
      toast.error('Tải ảnh thất bại: ' + (err?.message || 'Lỗi không xác định'), { duration: 4000 });
    } finally {
      setUploading(false);
    }
  };

  const handleCropCancel = () => {
    if (cropImageSrc) URL.revokeObjectURL(cropImageSrc);
    setCropImageSrc(null);
  };

  return (
    <div className="space-y-4">
      {/* ── Avatar + Info cơ bản ─────────────────────────────────── */}
      <SectionCard icon={User} title="Ảnh & Thông tin cơ bản">
        <div className="flex gap-4 items-start">
          {/* Avatar */}
          <div className="relative group flex-shrink-0">
            <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-primary/30 flex items-center justify-center bg-muted/50">
              {form.profile_image && !imgError ?
                <img src={form.profile_image} alt="avatar" className="w-full h-full object-cover" onError={() => setImgError(true)} /> :
                <Camera className="w-7 h-7 text-primary/30" />
              }
            </div>
            <label className="absolute bottom-0 right-0 w-7 h-7 bg-primary rounded-full flex items-center justify-center cursor-pointer shadow-lg hover:scale-110 transition-transform">
              <Camera className="w-3 h-3 text-background" />
              <input type="file" accept="image/*" className="hidden" onChange={handleImageSelect} disabled={uploading} />
            </label>
            {uploading &&
              <div className="absolute inset-0 bg-background/70 rounded-2xl flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
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
              placeholder="2004" type="number" className="no-spinner" />
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

      {/* ── Bio + CV ───────────────────────────────────────────── */}
      <SectionCard icon={MessageSquare} title="Giới thiệu bản thân">
        <InlineField value={form.bio} onChange={(v) => update('bio', v)}
          placeholder="Viết vài dòng về bản thân, đam mê, mục tiêu..." multiline />
        <div className="pt-2">
          <p className="font-display text-[10px] text-primary/60 mb-2">CV / Portfolio (PDF, PNG, JPG, WEBP, DOCX, ODT — tối đa 5 MB)</p>
          {form.cv_url ? (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/15">
              <FileText className="w-4 h-4 text-primary flex-shrink-0" />
              <a href={form.cv_url} target="_blank" rel="noopener noreferrer"
                className="text-sm font-body text-primary hover:underline truncate flex-1">
                {form.cv_url.split('/').pop()}
              </a>
              <button onClick={() => update('cv_url', '')}
                className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <label className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-dashed border-primary/20 hover:border-primary/40 cursor-pointer transition-colors group">
              <Upload className="w-4 h-4 text-primary/40 group-hover:text-primary/70 transition-colors" />
              <span className="text-xs font-body text-muted-foreground/60 group-hover:text-muted-foreground transition-colors">Tải lên CV</span>
              <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.docx,.odt" className="hidden"
                onChange={async (e) => {
                  const file = e.target.files[0];
                  if (!file) return;
                  const MAX_CV = 5 * 1024 * 1024;
                  if (file.size > MAX_CV) {
                    toast.error(`Tệp quá lớn (${(file.size / 1024 / 1024).toFixed(1)} MB). Giới hạn tối đa 5 MB.`);
                    e.target.value = '';
                    return;
                  }
                  try {
                    const { file_url, error } = await db.integrations.Core.UploadFile({ file });
                    if (file_url) {
                      update('cv_url', file_url);
                      toast.success('Tải CV thành công!');
                    } else {
                      toast.error(error || 'Tải CV thất bại. Vui lòng thử lại.');
                    }
                  } catch (err) {
                    toast.error('Tải CV thất bại: ' + (err?.message || 'Lỗi kết nối máy chủ'));
                  }
                  e.target.value = '';
                }} />
            </label>
          )}
        </div>
      </SectionCard>

      {/* ── Tools & Libraries ───────────────────────────────────── */}
      <SectionCard icon={Wrench} title="Tools & Libraries">
        <p className="font-display text-[10px] text-primary/60 -mb-1">Tools</p>
        <TagGroup all={TOOL_SKILLS} selected={form.tool_skills}
          onToggle={(s) => toggleArray('tool_skills', s)} />
        <p className="font-display text-[10px] text-primary/60 -mb-1 mt-2">Frameworks & Libraries</p>
        <TagGroup all={FRAMEWORK_SKILLS} selected={form.framework_skills}
          onToggle={(s) => toggleArray('framework_skills', s)} />
      </SectionCard>

      {/* ── Skillset ─────────────────────────────────────────────── */}
      <SectionCard icon={Brain} title="Skillset">
        <TagGroup all={SKILLSET} selected={form.skillset_skills}
          onToggle={(s) => toggleArray('skillset_skills', s)} />
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
        <InlineField label="Thành tích trong Vòng 1 DSTC 2026" value={form.achievements}
          onChange={(v) => update('achievements', v)}
          placeholder="Thành tích của bạn..." multiline />
        <InlineField label="Thành tích khác" value={form.achievements_other}
          onChange={(v) => update('achievements_other', v)}
          placeholder="Các thành tích nổi bật khác" multiline />
      </SectionCard>

      {/* ── Liên kết ───────────────────────────────────── */}
      <SectionCard icon={Link} title="Liên kết">
        {SOCIAL_PLATFORMS.map((platform) => (
          <InlineField
            key={platform.key}
            label={platform.label}
            value={form.social_links[platform.key] || ''}
            onChange={(v) => {
              const next = { ...form.social_links };
              if (v) next[platform.key] = v;
              else delete next[platform.key];
              update('social_links', next);
            }}
            placeholder={platform.placeholder}
          />
        ))}
      </SectionCard>

      {cropImageSrc && (
        <ImageCropModal
          imageSrc={cropImageSrc}
          onCropComplete={handleCropConfirm}
          onCancel={handleCropCancel}
        />
      )}
    </div>
  );
});

export default InlineProfileEditor;