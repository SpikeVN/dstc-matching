import { db } from '@/api/base44Client';

import React, { useState } from 'react';

import { useQuery } from '@tanstack/react-query';
import { Users, Search, Heart, MessageCircle, User, Shield } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { format, addHours } from 'date-fns';
import MatchDashboard from '@/components/admin/MatchDashboard';
import PageFooter from '@/components/layout/PageFooter';

export default function AdminMatches() {
  const [search, setSearch] = useState('');

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => db.auth.me(),
  });

  const { data: matches, isLoading: loadingMatches } = useQuery({
    queryKey: ['adminAllMatches'],
    queryFn: () => db.entities.Match.list('-created_date', 200),
    initialData: [],
  });

  const { data: allProfiles, isLoading: loadingProfiles } = useQuery({
    queryKey: ['adminAllProfiles'],
    queryFn: () => db.entities.ContestantProfile.list(),
    initialData: [],
  });

  const { data: allMessages } = useQuery({
    queryKey: ['adminAllMessages'],
    queryFn: () => db.entities.Message.list('-created_date', 500),
    initialData: [],
  });

  if (currentUser && currentUser.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <Shield className="w-12 h-12 text-destructive/40 mx-auto" />
          <p className="font-display font-bold text-lg text-foreground">Truy cập bị từ chối</p>
          <p className="font-body text-sm text-muted-foreground">Trang này chỉ dành cho admin.</p>
        </div>
      </div>
    );
  }

  const profileMap = {};
  allProfiles.forEach(p => { profileMap[p.created_by] = p; });

  // Message count per match
  const msgCountByMatch = {};
  allMessages.forEach(msg => {
    msgCountByMatch[msg.match_id] = (msgCountByMatch[msg.match_id] || 0) + 1;
  });

  const filtered = matches.filter(match => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const p1 = profileMap[match.user1_id];
    const p2 = profileMap[match.user2_id];
    return (
      match.user1_id?.toLowerCase().includes(q) ||
      match.user2_id?.toLowerCase().includes(q) ||
      p1?.display_name?.toLowerCase().includes(q) ||
      p2?.display_name?.toLowerCase().includes(q) ||
      p1?.school?.toLowerCase().includes(q) ||
      p2?.school?.toLowerCase().includes(q)
    );
  });

  const isLoading = loadingMatches || loadingProfiles;

  return (
    <div className="min-h-screen flex flex-col p-4 md:p-8 grid-overlay">
      <div className="max-w-4xl mx-auto gap-5 w-full flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-display font-bold text-xl tracking-wide text-primary flex items-center gap-2">
              <Shield className="w-5 h-5" /> Admin — Match Viewer
            </h1>
            <p className="font-body text-xs text-muted-foreground mt-1">
              {matches.length} matches — {allProfiles.length} thí sinh — {allMessages.length} tin nhắn
            </p>
          </div>
          <div className="flex gap-3 text-xs font-body">
            <div className="px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-primary">
              <span className="font-bold text-lg">{matches.length}</span> Matches
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-pink-500/10 border border-pink-500/20 text-pink-300">
              <span className="font-bold text-lg">{allMessages.length}</span> Tin nhắn
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-300">
              <span className="font-bold text-lg">{allProfiles.length}</span> Hồ sơ
            </div>
          </div>
        </div>

        {/* Dashboard */}
        <MatchDashboard matches={matches} allProfiles={allProfiles} allMessages={allMessages} />

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Tìm theo tên, email, trường..."
            className="pl-9 bg-muted/40 border-primary/15 focus:border-primary/40 font-body text-sm"
          />
        </div>

        {/* Match list */}
        {isLoading ? (
          <div className="text-center py-16">
            <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin mx-auto" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Heart className="w-10 h-10 text-primary/10 mx-auto mb-3" />
            <p className="font-body text-sm text-muted-foreground">Không tìm thấy match nào</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((match, i) => {
              const p1 = profileMap[match.user1_id];
              const p2 = profileMap[match.user2_id];
              const msgCount = msgCountByMatch[match.id] || 0;

              return (
                <div key={match.id} className="glass-card rounded-xl border border-primary/10 p-4">
                  <div className="flex items-center gap-3 flex-wrap">
                    {/* Index */}
                    <span className="font-display text-xs text-muted-foreground/50 w-6 text-right flex-shrink-0">#{i + 1}</span>

                    {/* User 1 */}
                    <UserCard profile={p1} email={match.user1_id} />

                    {/* Match icon */}
                    <div className="flex flex-col items-center gap-1 flex-shrink-0">
                      <Heart className="w-5 h-5 text-pink-400" />
                      <span className="font-body text-[9px] text-muted-foreground/50">match</span>
                    </div>

                    {/* User 2 */}
                    <UserCard profile={p2} email={match.user2_id} />

                    {/* Meta */}
                    <div className="ml-auto flex flex-col items-end gap-1 flex-shrink-0">
                      <div className="flex items-center gap-1 text-[10px] font-body text-muted-foreground">
                        <MessageCircle className="w-3 h-3" />
                        <span>{msgCount} tin nhắn</span>
                      </div>
                      <span className="text-[10px] font-body text-muted-foreground/50">
                        {match.created_date ? format(addHours(new Date(match.created_date), 7), 'HH:mm dd/MM/yyyy') : '—'}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded border font-body ${match.status === 'team_joined' ? 'text-primary border-primary/30 bg-primary/5' :
                          match.status === 'team_invited' ? 'text-yellow-300 border-yellow-400/30 bg-yellow-400/5' :
                            'text-pink-300 border-pink-400/30 bg-pink-400/5'
                        }`}>{match.status}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <PageFooter />
      </div>
    </div>
  );
}

function UserCard({ profile, email }) {
  return (
    <div className="flex items-center gap-2 flex-1 min-w-0 max-w-[200px]">
      <div className="w-9 h-9 rounded-lg overflow-hidden border border-primary/20 bg-muted/50 flex-shrink-0">
        {profile?.profile_image
          ? <img src={profile.profile_image} alt="" className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center"><User className="w-4 h-4 text-primary/30" /></div>
        }
      </div>
      <div className="min-w-0">
        <p className="font-display font-semibold text-xs text-foreground truncate">{profile?.display_name || 'Unknown'}</p>
        <p className="font-body text-[10px] text-muted-foreground truncate">{email}</p>
        {profile?.role && <p className="font-body text-[10px] text-primary/60 truncate">{profile.role}</p>}
      </div>
    </div>
  );
}