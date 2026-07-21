import { db } from '@/api/apiClient';

import React, { useState } from 'react';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Users, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function TeamConfirmBar({ match, currentUser, otherProfile }) {
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);

  const { data: currentMatch } = useQuery({
    queryKey: ['match', match.id],
    queryFn: () => db.entities.Match.get(match.id),
    initialData: match,
    refetchInterval: 5000,
  });

  const isUser1 = currentUser?.id === currentMatch?.user1_id;
  const myConfirmed = isUser1 ? currentMatch?.user1_confirmed : currentMatch?.user2_confirmed;
  const otherConfirmed = isUser1 ? currentMatch?.user2_confirmed : currentMatch?.user1_confirmed;
  const teamFormed = currentMatch?.status === 'team_joined';
  const otherEmail = isUser1 ? currentMatch?.user2_id : currentMatch?.user1_id;

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      if (otherConfirmed) {
        const team = await db.entities.Team.create({
          name: `${otherProfile?.display_name || 'Team'} & ${currentUser?.full_name || 'Team'}`,
          leader_id: currentUser.id,
          member_ids: [currentUser.id, otherEmail],
          max_members: 4,
          status: 'forming',
        });
        await db.entities.Match.update(match.id, {
          ...(isUser1 ? { user1_confirmed: true } : { user2_confirmed: true }),
          status: 'team_joined',
        });
        const [myProfiles, otherProfiles] = await Promise.all([
          db.entities.ContestantProfile.filter({ created_by: currentUser.id }),
          db.entities.ContestantProfile.filter({ created_by: otherEmail }),
        ]);
        const updates = [];
        if (myProfiles[0]?.id) updates.push({ id: myProfiles[0].id, has_team: true, team_id: team.id });
        if (otherProfiles[0]?.id) updates.push({ id: otherProfiles[0].id, has_team: true, team_id: team.id });
        if (updates.length > 0) await db.entities.ContestantProfile.bulkUpdate(updates);
        toast.success('Đã lập đội thành công! 🎉');
      } else {
        await db.entities.Match.update(match.id, isUser1 ? { user1_confirmed: true } : { user2_confirmed: true });
        toast.success('Đã xác nhận! Chờ đối phương xác nhận để lập đội.');
      }
      queryClient.invalidateQueries({ queryKey: ['match', match.id] });
      queryClient.invalidateQueries({ queryKey: ['matches'] });
    } catch (err) {
      toast.error('Lỗi: ' + (err?.message || 'Không xác định'));
    } finally {
      setConfirming(false);
    }
  };

  if (teamFormed) {
    return (
      <div className="px-4 py-2.5 border-b border-primary/10 bg-primary/5 flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center">
          <Check className="w-3.5 h-3.5 text-primary" />
        </div>
        <div>
          <p className="font-display text-xs text-primary font-semibold">Đã lập đội ✓</p>
          <p className="font-body text-[10px] text-muted-foreground">Hai bạn đã chính thức thành lập đội</p>
        </div>
      </div>
    );
  }

  if (myConfirmed && !otherConfirmed) {
    return (
      <div className="px-4 py-2.5 border-b border-primary/10 bg-primary/5 flex items-center gap-2">
        <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
        <p className="font-body text-xs text-foreground">
          Đã xác nhận — chờ <span className="text-primary">{otherProfile?.display_name}</span> xác nhận
        </p>
      </div>
    );
  }

  return (
    <div className="px-4 py-2.5 border-b border-primary/10 bg-primary/5">
      <button
        onClick={handleConfirm}
        disabled={confirming}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary/15 border border-primary/40 hover:bg-primary/20 hover:border-primary/60 transition-all font-display text-xs font-medium text-primary disabled:opacity-50"
      >
        {confirming ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Users className="w-3.5 h-3.5" />}
        Xác nhận lập đội
        {otherConfirmed && <span className="text-[10px] normal-case text-primary/70">— đối phương đã xác nhận!</span>}
      </button>
    </div>
  );
}