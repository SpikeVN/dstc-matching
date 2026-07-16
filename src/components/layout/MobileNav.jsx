import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { User, Heart, MessageCircle, Sparkles, LayoutDashboard } from 'lucide-react';

const navItems = [
  { path: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { path: '/discover', label: 'Khám phá', icon: Sparkles },
  { path: '/matches', label: 'Match', icon: Heart },
  { path: '/messages', label: 'Chat', icon: MessageCircle },
  { path: '/profile', label: 'Hồ sơ', icon: User },
];

export default function MobileNav() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 glass-card border-t border-neon/15 z-50 md:hidden">
      <div className="flex items-center justify-around py-2 px-1">
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-all ${
                isActive ? 'text-neon' : 'text-muted-foreground'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'drop-shadow-[0_0_6px_rgba(49,209,162,0.8)]' : ''}`} />
              <span className="text-[10px] font-mono font-medium">{item.label}</span>
              {isActive && <div className="w-1 h-1 rounded-full bg-neon animate-pulse" />}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}