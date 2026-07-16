import React from 'react';
import { Heart, Users, MessageCircle, TrendingUp, CheckCircle2, Clock } from 'lucide-react';
import { format, addHours } from 'date-fns';

function StatCard({ icon: Icon, label, value, color, sublabel }) {
  return (
    <div className="glass-card rounded-xl border border-neon/10 p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="font-body text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className="font-display font-bold text-2xl text-foreground leading-tight">{value}</p>
        {sublabel && <p className="font-body text-[10px] text-muted-foreground/70 truncate">{sublabel}</p>}
      </div>
    </div>
  );
}

export default function MatchDashboard({ matches, allProfiles, allMessages }) {
  const profileMap = {};
  allProfiles.forEach(p => { profileMap[p.created_by] = p; });

  const ongoing = matches.filter(m => m.status === 'matched');
  const teamInvited = matches.filter(m => m.status === 'team_invited');
  const successful = matches.filter(m => m.status === 'team_joined');

  const msgCountByMatch = {};
  allMessages.forEach(msg => {
    msgCountByMatch[msg.match_id] = (msgCountByMatch[msg.match_id] || 0) + 1;
  });

  const avgMessages = matches.length > 0
    ? Math.round(allMessages.length / matches.length)
    : 0;

  return (
    <div className="space-y-4">
      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          icon={Heart}
          label="Tổng match"
          value={matches.length}
          color="bg-pink-500/10 text-pink-300"
          sublabel="Tất cả cặp đã ghép"
        />
        <StatCard
          icon={Clock}
          label="Đang diễn ra"
          value={ongoing.length}
          color="bg-neon/10 text-neon"
          sublabel="Đang trò chuyện"
        />
        <StatCard
          icon={Users}
          label="Đang lập đội"
          value={teamInvited.length}
          color="bg-yellow-400/10 text-yellow-300"
          sublabel="Chờ xác nhận"
        />
        <StatCard
          icon={CheckCircle2}
          label="Đã thành đội"
          value={successful.length}
          color="bg-blue-500/10 text-blue-300"
          sublabel="Ghép thành công"
        />
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="glass-card rounded-xl border border-neon/10 p-3 flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-neon/60 flex-shrink-0" />
          <div>
            <p className="font-body text-[10px] text-muted-foreground">Tổng tin nhắn</p>
            <p className="font-display font-bold text-sm text-foreground">{allMessages.length}</p>
          </div>
        </div>
        <div className="glass-card rounded-xl border border-neon/10 p-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-neon/60 flex-shrink-0" />
          <div>
            <p className="font-body text-[10px] text-muted-foreground">Trung bình TB/match</p>
            <p className="font-display font-bold text-sm text-foreground">{avgMessages} tin nhắn</p>
          </div>
        </div>
      </div>

      {/* Successful pairs list */}
      <div className="glass-card rounded-xl border border-neon/15 overflow-hidden">
        <div className="px-4 py-3 border-b border-neon/10 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-neon" />
          <h3 className="font-display text-sm font-semibold neon-text">
            Cặp đôi đã ghép thành công ({successful.length})
          </h3>
        </div>
        <div className="max-h-72 overflow-y-auto">
          {successful.length === 0 ? (
            <div className="text-center py-10">
              <Users className="w-8 h-8 text-neon/10 mx-auto mb-2" />
              <p className="font-body text-xs text-muted-foreground">Chưa có cặp nào thành đội</p>
            </div>
          ) : (
            <div className="divide-y divide-neon/8">
              {successful.map((match, i) => {
                const p1 = profileMap[match.user1_id];
                const p2 = profileMap[match.user2_id];
                const msgCount = msgCountByMatch[match.id] || 0;
                return (
                  <div key={match.id} className="px-4 py-3 flex items-center gap-3 hover:bg-neon/5 transition-colors">
                    <span className="font-display text-xs text-neon/40 w-5 text-right flex-shrink-0">#{i + 1}</span>
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="font-body text-xs text-foreground truncate">
                        {p1?.display_name || match.user1_id}
                      </span>
                      <Heart className="w-3 h-3 text-pink-400 flex-shrink-0" />
                      <span className="font-body text-xs text-foreground truncate">
                        {p2?.display_name || match.user2_id}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] font-body text-muted-foreground flex-shrink-0">
                      <MessageCircle className="w-3 h-3" />
                      {msgCount}
                    </div>
                    <span className="font-body text-[10px] text-muted-foreground/60 flex-shrink-0 hidden sm:block">
                      {match.created_date ? format(addHours(new Date(match.created_date), 7), 'dd/MM') : '—'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}