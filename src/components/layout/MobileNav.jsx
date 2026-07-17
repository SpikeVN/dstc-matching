import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { User, Heart, MessageCircle, Sparkles, LayoutDashboard } from 'lucide-react';

const navItems = [
  { path: '/', label: 'Home', icon: LayoutDashboard },
  { path: '/discover', label: 'Khám phá', icon: Sparkles },
  { path: '/matches', label: 'Match', icon: Heart },
  { path: '/messages', label: 'Chat', icon: MessageCircle },
  { path: '/profile', label: 'Hồ sơ', icon: User },
];

export default function MobileNav() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 backdrop-blur-md border-t border-primary/15 z-50 md:hidden" style={{ background: 'rgba(10,18,11,0.9)' }}>
      <div className="flex items-center justify-around py-2 px-1">
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-all ${isActive ? 'text-primary' : 'text-muted-foreground'
                }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'text-primary' : ''}`} />
              <span className="text-[10px] font-mono font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}