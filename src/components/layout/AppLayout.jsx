import { db } from '@/api/apiClient';

import React, { createContext, useContext, useMemo, useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import MobileNav from './MobileNav';
import NotificationBell from './NotificationBell';
import { useQuery } from '@tanstack/react-query';

import { useRealtimeNotifications } from '@/hooks/useRealtimeNotifications';
import { useOnlineUsers } from '@/hooks/useOnlinePresence';

const OnlineContext = createContext(new Set());
export const useOnlineContext = () => useContext(OnlineContext);

const PAGE_TITLES = {
  '/': 'Trang chủ',
  '/dashboard': 'Dashboard',
  '/discover': 'Khám phá',
  '/messages': 'Tin nhắn',
  '/team': 'Đội',
  '/profile': 'Hồ sơ',
  '/settings': 'Cài đặt',
  '/admin': 'Admin Panel',
  '/guide': 'Hướng dẫn & Credits',
};

export default function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const title = location.pathname.startsWith('/admin') ? 'Admin Panel' : (PAGE_TITLES[location.pathname] || '');

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => db.auth.me(),
  });

  const { data: allProfiles } = useQuery({
    queryKey: ['allProfilesForNotif'],
    queryFn: () => db.entities.ContestantProfile.list(),
    initialData: [],
  });

  const profileMap = useMemo(() => {
    const map = {};
    allProfiles.forEach(p => { map[p.created_by] = p; });
    return map;
  }, [allProfiles]);

  useRealtimeNotifications({ currentUser, profileMap, navigate });
  const onlineUsers = useOnlineUsers();

  // Heartbeat to mark the user as active (backend uses this to skip email notifications)
  useEffect(() => {
    if (!currentUser?.id) return;
    const sendHeartbeat = () => {
      const token = localStorage.getItem('access_token');
      if (!token) return;
      fetch(`${import.meta.env.VITE_API_BASE ?? ''}/api/heartbeat`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => { /* ignore */ });
    };
    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [currentUser?.id]);

  return (
    <OnlineContext.Provider value={onlineUsers}>
      <div className={`flex ${location.pathname === '/discover' ? 'h-screen overflow-hidden' : 'min-h-screen'}`}>
        {/* Desktop sidebar */}
        <div className="hidden md:block">
          <Sidebar />
        </div>

        {/* Main content */}
        <main className={`flex-1 min-h-screen overflow-x-hidden flex flex-col md:ml-64 ${location.pathname === '/discover' ? 'overflow-hidden !p-0' : location.pathname === '/messages' ? 'pb-0' : 'pt-6 md:pt-8 pb-20 md:pb-0'}`}>
          <div className="flex-1">
            <Outlet />
          </div>
        </main>

        {/* Mobile bottom nav */}
        {!(location.pathname === '/messages' && location.search.includes('match=')) && <MobileNav />}
      </div>
    </OnlineContext.Provider>
  );
}