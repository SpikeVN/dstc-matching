import { db } from '@/api/base44Client';

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { Sparkles, Users, MessageCircle, ArrowRight, Zap, Target, Shield } from 'lucide-react';
import { motion } from 'framer-motion';

function StatBadge({ value, label }) {
  return (
    <div className="text-center">
      <div className="font-display font-bold text-2xl text-primary">{value}</div>
      <div className="font-mono text-[10px] text-muted-foreground mt-0.5">{label}</div>
    </div>);

}

function FeatureCard({ icon: Icon, title, desc, delay }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className="glass-card rounded-xl p-5 border border-primary/10 hover:border-primary/25 transition-all duration-300 group">

      <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center mb-3 group-hover:bg-primary/15 transition-colors">
        <Icon className="w-5 h-5 text-primary" />
      </div>
      <h3 className="font-display text-sm font-semibold text-foreground mb-1">{title}</h3>
      <p className="font-mono text-xs text-muted-foreground leading-relaxed">{desc}</p>
    </motion.div>);

}

export default function Home() {
  const navigate = useNavigate();

  const { data: myProfiles } = useQuery({
    queryKey: ['myProfile'],
    queryFn: async () => {
      const me = await db.auth.me();
      return db.entities.ContestantProfile.filter({ created_by: me.email });
    },
    initialData: []
  });
  const hasProfile = myProfiles[0]?.profile_complete;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top navbar */}
      <nav className="sticky top-0 z-20 flex items-center justify-between px-6 py-3.5 border-b border-primary/10 bg-background/80 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <img
            src="/bnd-dstc.webp"
            alt="DSTC"
            className="w-8 h-8 object-contain" />

          <span className="font-display font-bold text-sm text-primary tracking-widest">DSTC</span>
          <span className="font-mono text-[10px] text-muted-foreground/60 hidden sm:block">Matching Platform</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="font-mono text-xs text-muted-foreground hover:text-primary hidden sm:flex"
            onClick={() => navigate('/discover')}>

            Khám phá
          </Button>
          <Button
            size="sm"
            className="font-display text-xs font-medium bg-primary text-background hover:bg-primary/90 h-8 px-4 gap-1.5 transition-all duration-200"
            onClick={() => navigate(hasProfile ? '/discover' : '/profile')}>

            {hasProfile ? 'Vào app' : 'Bắt đầu'}
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </nav>

      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-20 text-center relative overflow-hidden">
        {/* Ambient glow */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-primary/5 blur-3xl pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-2xl relative z-10">

          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/25 bg-primary/5 mb-6">
            <Zap className="w-3 h-3 text-primary" />
            <span className="font-mono text-[11px] text-primary/80">Data Science Talent Competition 2026</span>
          </div>

          <h1 className="font-display font-bold text-4xl md:text-6xl leading-tight mb-5" style={{ letterSpacing: '-0.02em' }}>
            Tìm kiếm{' '}
            <span className="text-primary">đồng đội</span>{' '}
            lý tưởng
          </h1>

          <p className="font-body text-base text-muted-foreground mb-8 leading-relaxed max-w-lg mx-auto">
            Nền tảng kết nối thí sinh DSTC thông minh — swipe, match và xây dựng đội ngũ chiến thắng.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-3 justify-center">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button
                size="lg"
                className="h-12 px-8 font-display text-sm gap-2 font-medium bg-primary text-background hover:bg-primary/90 border-0 rounded-lg transition-all duration-200"
                onClick={() => navigate(hasProfile ? '/discover' : '/profile')}>

                <Sparkles className="w-4 h-4" />
                {hasProfile ? 'Khám phá ngay' : 'Tạo hồ sơ'}
              </Button>
            </motion.div>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button
                variant="outline"
                size="lg"
                className="h-12 px-8 font-display text-sm font-medium border-primary/20 hover:border-primary/40 hover:bg-primary/5 text-foreground rounded-lg transition-all duration-200"
                onClick={() => navigate('/matches')}>

                Xem matches
              </Button>
            </motion.div>
          </div>
        </motion.div>

        {/* Stats row */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="flex items-center gap-8 mt-14 px-8 py-5 glass-card rounded-2xl border border-primary/10">

          <StatBadge value="100+" label="Thí sinh" />
          <div className="w-px h-8 bg-primary/10" />
          <StatBadge value="4" label="Vai trò" />
          <div className="w-px h-8 bg-primary/10" />
          <StatBadge value="Real-time" label="Matching" />
        </motion.div>
      </div>

      {/* Features */}
      <div className="px-6 pb-16 max-w-4xl mx-auto w-full">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="text-center mb-8">

          <h2 className="font-display font-bold text-lg text-primary">Cách hoạt động</h2>
        </motion.div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <FeatureCard
            icon={Target}
            title="Tạo hồ sơ"
            desc="Điền kỹ năng, kinh nghiệm và mục tiêu để hệ thống gợi ý đồng đội phù hợp nhất."
            delay={0.5} />

          <FeatureCard
            icon={Sparkles}
            title="Swipe & Match"
            desc="Lướt qua các hồ sơ và like những người bạn muốn đồng đội. Match khi cả hai cùng thích nhau."
            delay={0.6} />

          <FeatureCard
            icon={MessageCircle}
            title="Chat & Hình thành đội"
            desc="Nhắn tin trực tiếp với các match của bạn và cùng nhau xây dựng đội hình mơ ước."
            delay={0.7} />

        </div>
      </div>

      {/* Footer logos */}
      <div className="border-t border-primary/10 px-6 py-4 flex items-center justify-center gap-4 opacity-50">
        <img src="/ftu.webp"
          alt="FTU" className="w-6 h-6 rounded-full object-contain" />
        <img src="/fyu.svg"
          alt="Đoàn trường" className="w-6 h-6 rounded-full object-cover" />
        <img src="/cte-logo.svg"
          alt="CTE FTU" className="w-6 h-6 rounded object-contain invert" />
        <span className="font-mono text-[10px] text-muted-foreground">Trường Đại học Ngoại thương — Đoàn TNCS HCM — CTE FTU</span>
      </div>
    </div>);

}