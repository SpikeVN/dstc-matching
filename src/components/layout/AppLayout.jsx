import { db } from '@/api/apiClient';

import React from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import MobileNav from './MobileNav';
import NotificationBell from './NotificationBell';
import { useQuery } from '@tanstack/react-query';

import { useRealtimeNotifications } from '@/hooks/useRealtimeNotifications';

const PAGE_TITLES = {
  '/': 'Trang chủ',
  '/discover': 'Khám phá',
  '/matches': 'Matches',
  '/messages': 'Tin nhắn',
  '/profile': 'Hồ sơ',
  '/settings': 'Cài đặt',
  '/admin': 'Admin — Match Viewer',
  '/guide': 'Hướng dẫn & Credits',
};

export default function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const title = PAGE_TITLES[location.pathname] || '';

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => db.auth.me(),
  });

  const { data: allProfiles } = useQuery({
    queryKey: ['allProfilesForNotif'],
    queryFn: () => db.entities.ContestantProfile.list(),
    initialData: [],
  });

  const profileMap = {};
  allProfiles.forEach(p => { profileMap[p.created_by] = p; });

  useRealtimeNotifications({ currentUser, profileMap, navigate });

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* Main content */}
      <main className={`flex-1 min-h-screen overflow-x-hidden flex flex-col ${location.pathname === '/messages' ? 'pb-0' : 'pt-6 md:pt-8 pb-20 md:pb-0'}`}>
        <div className="flex-1">
          <Outlet />
        </div>
      </main>

      {/* Mobile bottom nav */}
      <MobileNav />
    </div>
  );
}