import { db } from '@/api/base44Client';

import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { User, Heart, MessageCircle, Settings, LogOut, Sparkles, LayoutDashboard, BookOpen, Shield } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/discover', label: 'Khám phá', icon: Sparkles },
  { path: '/profile', label: 'Hồ sơ', icon: User },
  { path: '/matches', label: 'Đã match', icon: Heart },
  { path: '/messages', label: 'Tin nhắn', icon: MessageCircle },
  { path: '/guide', label: 'Hướng dẫn', icon: BookOpen },
  { path: '/settings', label: 'Cài đặt', icon: Settings }];

export default function Sidebar() {
  const location = useLocation();
  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => db.auth.me(),
  });

  return (
    <aside className="w-64 h-screen flex flex-col sticky top-0 glass-card border-r border-neon/10">
      {/* Logo */}
      <div className="p-5 flex items-center gap-3 border-b border-neon/10">
        <img
          src="/bnd-dstc.webp"
          alt="DSTC Logo"
          className="w-10 h-10 rounded-lg object-contain" />

        <div className="leading-tight">
          <div className="font-display font-bold text-sm neon-text tracking-widest">DSTC - VQC 2026</div>
          <div className="font-display text-[9px] text-muted-foreground tracking-wider uppercase">Matching Platform</div>
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
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 font-mono text-sm group ${isActive ?
                'bg-neon/10 text-neon border border-neon/30 neon-glow' :
                'text-muted-foreground hover:bg-neon/5 hover:text-neon/80 border border-transparent'}`
              }>

              <Icon className={`w-4 h-4 ${isActive ? 'neon-text' : ''}`} />
              {item.label}
              {isActive &&
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-neon animate-pulse-neon" />
              }
            </Link>);

        })}
      </nav>

      {/* Footer logos */}
      <div className="p-3 border-t border-neon/10 space-y-3">
        <div className="flex items-center gap-2 px-2">
          <img
            src="/ftu.webp"
            alt="FTU"
            className="w-7 h-7 rounded-full object-contain opacity-70 flex-shrink-0" />

          <span className="font-mono text-[10px] text-muted-foreground leading-tight">Trường ĐH Ngoại thương</span>
        </div>
        <div className="flex items-center gap-2 px-2">
          <img
            src="/fyu.webp"
            alt="Đoàn trường"
            className="w-7 h-7 rounded-full object-cover opacity-70" />

          <span className="font-mono text-[10px] text-muted-foreground leading-tight">Đoàn TNCS HCM<br />ĐH Ngoại Thương</span>
        </div>
        <div className="flex items-center gap-2 px-2">
          <img
            src="/cte-logo.svg"
            alt="CTE FTU"
            className="w-7 h-7 rounded object-contain opacity-70 flex-shrink-0 invert" />

          <span className="font-mono text-[10px] text-muted-foreground leading-tight">CTE FTU: CLB KH&CN trong KT&KD</span>
        </div>
        {currentUser?.role === 'admin' && (
          <Link
            to="/admin"
            className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-all font-mono text-xs mb-1 ${location.pathname === '/admin' ? 'bg-neon/10 text-neon border border-neon/30' : 'text-muted-foreground hover:bg-neon/5 hover:text-neon/80 border border-transparent'
              }`}
          >
            <Shield className="w-4 h-4" /> Admin Match Viewer
          </Link>
        )}
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive font-mono text-sm h-9"
          onClick={() => db.auth.logout()}>

          <LogOut className="w-4 h-4" />
          Đăng xuất
        </Button>
      </div>
    </aside>);

}