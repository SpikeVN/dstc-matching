import { db, markProfileVisited } from '@/api/apiClient';

import React, { useState, useRef, useEffect, useContext, useCallback } from 'react';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UNSAFE_NavigationContext as NavigationContext } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import InlineProfileEditor from '@/components/profile/InlineProfileEditor';
import ProfilePreview from '@/components/profile/ProfilePreview';
import PageFooter from '@/components/layout/PageFooter';
import { Save, Eye } from 'lucide-react';
import { Toggle } from '@/components/ui/toggle';
import { motion, AnimatePresence } from 'framer-motion';

// Works with BrowserRouter — useBlocker requires createBrowserRouter
function useNavigationBlocker(blocked, onNavigate) {
  const { navigator } = useContext(NavigationContext);
  useEffect(() => {
    if (!blocked) return;
    const push = navigator.push;
    const replace = navigator.replace;
    navigator.push = (...args) => onNavigate('push', () => { navigator.push = push; navigator.push(...args); });
    navigator.replace = (...args) => onNavigate('replace', () => { navigator.replace = replace; navigator.replace(...args); });
    return () => { navigator.push = push; navigator.replace = replace; };
  }, [blocked, navigator, onNavigate]);
}

export default function Profile() {
  const queryClient = useQueryClient();
  const { authChecked, isAuthenticated } = useAuth();
  const [mode, setMode] = useState('edit');
  const editorRef = useRef(null);
  const [editorSaving, setEditorSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Warn before browser close / refresh when form is dirty
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  // Block in-app navigation when form is dirty
  const [pendingNav, setPendingNav] = useState(null);
  const handleNavigate = useCallback((type, proceed) => {
    setPendingNav({ type, proceed });
  }, []);
  useNavigationBlocker(isDirty, handleNavigate);
  // Dismiss dialog if user saves while it's showing
  useEffect(() => {
    if (!isDirty && pendingNav) setPendingNav(null);
  }, [isDirty, pendingNav]);
  // Keep a ref to latest form data so preview can show it without needing to save first
  const latestFormRef = useRef(null);
  const [previewData, setPreviewData] = useState(null);

  const { data: profiles, isLoading, isFetching } = useQuery({
    queryKey: ['myProfile'],
    queryFn: async () => {
      const me = await db.auth.me();
      if (!me) return [];
      return db.entities.ContestantProfile.filter({ created_by: me.id });
    },
    staleTime: 60_000, // Don't refetch aggressively — avoids wiping local state
    enabled: authChecked && isAuthenticated,
  });
  const myProfile = profiles?.[0];

  // Mark profile as visited on first open (used by Discover to prompt completion)
  useEffect(() => {
    if (myProfile?.id && !myProfile.visited_profile) {
      markProfileVisited(myProfile.id).catch(() => { });
    }
  }, [myProfile?.id, myProfile?.visited_profile]);

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
        return db.entities.ContestantProfile.create({ ...data, username: me.id });
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
        {/* Fixed header with mode toggle + save button */}
        <div className="fixed top-0 left-0 right-0 md:left-64 z-20 px-4 md:px-8 py-3 bg-background/80 backdrop-blur-xl border-b border-primary/10">
          <div className="max-w-2xl mx-auto w-full flex items-center justify-between h-14">
            <div>
              <h1 className="font-display font-bold text-xl tracking-wide text-primary">Hồ sơ</h1>
              <p className="font-body text-xs text-muted-foreground mt-0.5">Chỉnh sửa thông tin rồi nhấn "Lưu hồ sơ"</p>
            </div>
            <div className="flex items-center gap-2">
              <Toggle
                size="sm"
                variant="outline"
                className="px-3"
                pressed={mode === 'preview'}
                onPressedChange={(pressed) => pressed ? handleSwitchToPreview() : setMode('edit')}
                aria-label="Xem trước"
              >
                <Eye className="w-3.5 h-3.5" />
                <span className="text-xs">Xem trước</span>
              </Toggle>
              {isDirty && mode === 'edit' && (
                <button
                  onClick={() => editorRef.current?.save()}
                  disabled={editorSaving}
                  className="inline-flex items-center justify-center gap-1.5 h-8 px-3 min-w-9 rounded-md border border-input bg-transparent shadow-sm text-xs font-medium transition-colors hover:bg-primary hover:text-background disabled:pointer-events-none disabled:opacity-50"
                >
                  {editorSaving ? (
                    <><div className="w-3.5 h-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin" /> Đang lưu...</>
                  ) : (
                    <><Save className="w-3.5 h-3.5" /> Lưu hồ sơ</>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
        {/* Spacer to offset the fixed header */}
        <div className="h-20 mb-5" />

        {profiles && (
          <AnimatePresence mode="wait">
            {mode === 'edit' ? (
              <motion.div
                key="edit"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2 }}
              >
                <InlineProfileEditor
                  key={myProfile?.id ?? 'new'}
                  ref={editorRef}
                  profile={myProfile}
                  onSave={handleSave}
                  onSavingChange={setEditorSaving}
                  onDirtyChange={setIsDirty}
                />
              </motion.div>
            ) : (
              <motion.div
                key="preview"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2 }}
              >
                <ProfilePreview profile={previewData || myProfile} />
              </motion.div>
            )}
          </AnimatePresence>
        )}
        <PageFooter />
      </div>

      {/* Unsaved changes confirmation dialog */}
      {pendingNav && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-card border border-primary/20 rounded-xl p-6 w-full max-w-sm mx-4 shadow-2xl">
            <h3 className="font-display text-base font-semibold text-primary mb-2">Thay đổi chưa được lưu</h3>
            <p className="font-body text-sm text-muted-foreground mb-5">
              Bạn có thay đổi chưa lưu trong hồ sơ. Nếu rời đi, các thay đổi sẽ bị mất.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { pendingNav.proceed(); setPendingNav(null); }}
                className="h-9 px-4 text-sm font-medium rounded-md border border-destructive/40 text-destructive hover:bg-destructive/10 transition-colors"
              >
                Rời đi
              </button>
              <button
                onClick={() => setPendingNav(null)}
                className="h-9 px-4 text-sm font-medium rounded-md bg-primary text-background hover:opacity-90 transition-opacity"
              >
                Ở lại
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}