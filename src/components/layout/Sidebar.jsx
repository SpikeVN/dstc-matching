import { db } from '@/api/base44Client';

import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { User, Heart, MessageCircle, Settings, LogOut, Sparkles, LayoutDashboard, BookOpen, Shield } from 'lucide-react';

import { Button } from '@/components/ui/button';
import NotificationBell from './NotificationBell';
import { useQuery } from '@tanstack/react-query';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/discover', label: 'Khám phá', icon: Sparkles },
  { path: '/profile', label: 'Hồ sơ', icon: User },
  { path: '/matches', label: 'Đã match', icon: Heart },
  { path: '/messages', label: 'Tin nhắn', icon: MessageCircle }];

export default function Sidebar() {
  const location = useLocation();
  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => db.auth.me(),
  });

  return (
    <aside className="w-64 h-screen flex flex-col sticky top-0 glass-card border-r border-primary/10">
      {/* Logo */}
      <div className="p-5 flex items-center gap-3 border-b border-primary/10">
        <img
          src="/dstc-key-sphere.webp"
          alt="DSTC Logo"
          className="w-10 h-10 rounded-lg object-contain" />

        <div className="leading-tight">
          <div className="font-display font-bold text-sm text-white">
            DSTC 2026&ensp;<span className="text-gray-700">//</span>&ensp;VQC

          </div>
          <div className="font-display text-[12px] text-muted-foreground">Matching Platform</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 font-mono text-sm group ${isActive
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-primary/5 hover:text-primary/80'
                }`}>

              <Icon className={`w-4 h-4 ${isActive ? 'text-primary' : ''}`} />
              {item.label}
            </Link>);

        })}
      </nav>

      {/* Footer logos */}
      <div className="p-3 border-t border-primary/10 space-y-3">
        {currentUser?.role === 'admin' && (
          <Link
            to="/admin"
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 font-mono text-sm group ${location.pathname === '/admin' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-primary/5 hover:text-primary/80'
              }`}
          >
            <Shield className="w-4 h-4" /> Admin Match Viewer
          </Link>
        )}
        <div className="flex flex-col gap-1 px-2">
          <NotificationBell />
          <Link
            to="/guide"
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 font-mono text-sm group ${location.pathname === '/guide' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-primary/5 hover:text-primary/80'}`}
          >
            <BookOpen className="w-4 h-4" /> Hướng dẫn
          </Link>
          <Link
            to="/settings"
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 font-mono text-sm group ${location.pathname === '/settings' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-primary/5 hover:text-primary/80'}`}
          >
            <Settings className="w-4 h-4" /> Cài đặt
          </Link>
          <Button
            variant="ghost"
            className="justify-start gap-3 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 font-mono text-sm h-auto py-3 w-full"
            onClick={() => db.auth.logout()}>

            <LogOut className="w-4 h-4" />
            Đăng xuất
          </Button>
        </div>
      </div>
    </aside>);

}