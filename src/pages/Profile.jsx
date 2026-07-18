import { db } from '@/api/base44Client';

import React, { useState, useRef } from 'react';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import InlineProfileEditor from '@/components/profile/InlineProfileEditor';
import ProfilePreview from '@/components/profile/ProfilePreview';
import PageFooter from '@/components/layout/PageFooter';
import { Eye, Edit3 } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Profile() {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState('edit');
  // Keep a ref to latest form data so preview can show it without needing to save first
  const latestFormRef = useRef(null);
  const [previewData, setPreviewData] = useState(null);

  const { data: profiles, isLoading } = useQuery({
    queryKey: ['myProfile'],
    queryFn: async () => {
      const me = await db.auth.me();
      return db.entities.ContestantProfile.filter({ created_by: me.email });
    },
    initialData: [],
    staleTime: 60_000, // Don't refetch aggressively — avoids wiping local state
  });
  const myProfile = profiles[0];

  // Track the saved profile id so repeated saves update correctly even before query refetches
  const savedIdRef = useRef(null);
  if (myProfile?.id && !savedIdRef.current) savedIdRef.current = myProfile.id;

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      const me = await db.auth.me();
      const profileId = savedIdRef.current || myProfile?.id;
      if (profileId) {
        return db.entities.ContestantProfile.update(profileId, data);
      } else {
        return db.entities.ContestantProfile.create({ ...data, username: me.email });
      }
    },
    onSuccess: (saved, variables) => {
      // Store the id so next save uses update, not create
      if (saved?.id) savedIdRef.current = saved.id;
      setPreviewData(variables);
      // Invalidate so other pages (Discover, Dashboard) see fresh data
      queryClient.invalidateQueries({ queryKey: ['myProfile'] });
    },
  });

  const handleSave = async (data) => {
    latestFormRef.current = data;
    setPreviewData(data);
    await saveMutation.mutateAsync(data);
  };

  const handleSwitchToPreview = () => {
    // When switching to preview, use latest form data if available, else saved profile
    if (latestFormRef.current) setPreviewData(latestFormRef.current);
    else setPreviewData(myProfile);
    setMode('preview');
  };

  return (
    <div className="min-h-screen flex flex-col p-4 md:p-8 grid-overlay">
      <div className="max-w-2xl mx-auto w-full flex-1 flex flex-col">
        {/* Mode toggle */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="font-display font-bold text-xl tracking-wide text-primary">Hồ sơ</h1>
            <p className="font-body text-xs text-muted-foreground mt-0.5">Chỉnh sửa thông tin rồi nhấn "Lưu hồ sơ"</p>
          </div>
          <div className="flex gap-1 p-1 rounded-lg bg-muted/40 border border-primary/10">
            <button
              onClick={() => setMode('edit')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-body transition-all ${mode === 'edit' ? 'bg-primary/15 text-primary border border-primary/30' : 'text-muted-foreground hover:text-foreground'
                }`}
            >
              <Edit3 className="w-3.5 h-3.5" /> Chỉnh sửa
            </button>
            <button
              onClick={handleSwitchToPreview}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-body transition-all ${mode === 'preview' ? 'bg-primary/15 text-primary border border-primary/30' : 'text-muted-foreground hover:text-foreground'
                }`}
            >
              <Eye className="w-3.5 h-3.5" /> Xem trước
            </button>
          </div>
        </div>

        {!isLoading && (
          <div className={mode === 'edit' ? 'block' : 'hidden'}>
            <InlineProfileEditor key={myProfile?.id ?? 'new'} profile={myProfile} onSave={handleSave} />
          </div>
        )}
        {mode === 'preview' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
            <ProfilePreview profile={previewData || myProfile} />
          </motion.div>
        )}
        <PageFooter />
      </div>
    </div>
  );
}