import React from 'react';
import SwipeCard from '@/components/discover/SwipeCard';

export default function ProfilePreview({ profile }) {
  if (!profile) {
    return (
      <div className="glass-card rounded-xl border border-primary/10 p-8 text-center">
        <p className="font-body text-sm text-muted-foreground">Chưa có hồ sơ. Hãy lưu hồ sơ trước!</p>
      </div>
    );
  }

  return <SwipeCard profile={profile} />;
}
