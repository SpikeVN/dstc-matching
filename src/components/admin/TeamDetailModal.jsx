import React, { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Users, User, Crown, Shield,
} from 'lucide-react';
import UserDetailModal from '@/components/admin/UserDetailModal';

export default function TeamDetailModal({ team, allProfiles, adminUsers, open, onClose }) {
  const [selectedUser, setSelectedUser] = useState(null);
  const [userDetailOpen, setUserDetailOpen] = useState(false);

  if (!team) return null;

  const memberIds = team.member_ids || [];
  const allMemberIds = [team.leader_id, ...memberIds.filter(id => id !== team.leader_id)];

  const getMemberInfo = (userId) => {
    // Try full contestant profile first
    const profile = allProfiles?.find(p => p.created_by === userId);
    // Then admin user data
    const adminUser = adminUsers?.find(u => u.id === userId);

    return {
      profile,
      adminUser: adminUser || { id: userId, display_name: profile?.display_name, email: profile?.email, profile_image: profile?.profile_image },
    };
  };

  const statusStyles = {
    forming: 'text-yellow-400 bg-yellow-400/10',
    full: 'text-primary bg-primary/10',
    locked: 'text-red-400 bg-red-400/10',
  };

  const statusLabels = {
    forming: 'Đang thành lập',
    full: 'Đủ thành viên',
    locked: 'Đã khóa',
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(open) => { if (!open) onClose(); }}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              {team.name}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Team metadata */}
            <div className="flex flex-wrap gap-3 text-xs">
              <span className={`text-[11px] px-2.5 py-1 rounded-md font-medium ${statusStyles[team.status] || ''}`}>
                {statusLabels[team.status] || team.status}
              </span>
              <span className="text-muted-foreground/70">
                {memberIds.length}/{team.max_members || 2} thành viên
              </span>
              {team.disband_initiated_by && (
                <span className="text-amber-400 font-medium">(đang giải tán)</span>
              )}
            </div>

            {/* Member list */}
            <div>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                Thành viên ({allMemberIds.length})
              </p>
              <div className="space-y-2">
                {allMemberIds.map((memberId, idx) => {
                  const { profile, adminUser } = getMemberInfo(memberId);
                  const isLeader = memberId === team.leader_id;

                  return (
                    <div
                      key={memberId}
                      className="flex items-center gap-3 glass-card rounded-lg p-3 border border-primary/10 cursor-pointer hover:bg-primary/5 transition-colors"
                      onClick={() => {
                        setSelectedUser(adminUser);
                        setUserDetailOpen(true);
                      }}
                    >
                      <div className="w-10 h-10 rounded-lg overflow-hidden border border-primary/20 bg-muted/50 flex-shrink-0">
                        {(profile?.profile_image || adminUser?.profile_image) ? (
                          <img src={profile?.profile_image || adminUser?.profile_image} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <User className="w-5 h-5 text-primary/30" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-medium text-foreground truncate">
                            {adminUser?.display_name || profile?.display_name || memberId.slice(0, 8)}
                          </p>
                          {isLeader && (
                            <Crown className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" title="Trưởng nhóm" />
                          )}
                        </div>
                        {adminUser?.email && (
                          <p className="text-[11px] text-muted-foreground truncate">{adminUser.email}</p>
                        )}
                      </div>
                      <div className="flex-shrink-0">
                        <span className="text-[10px] text-muted-foreground/50">{idx + 1}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* No member info note */}
            {allMemberIds.length === 0 && (
              <div className="text-center py-8">
                <Users className="w-8 h-8 text-primary/10 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">Đội không có thành viên</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {selectedUser && (
        <UserDetailModal
          user={selectedUser}
          profile={allProfiles?.find(p => p.created_by === selectedUser.id)}
          open={userDetailOpen}
          onClose={() => { setUserDetailOpen(false); setSelectedUser(null); }}
        />
      )}
    </>
  );
}
