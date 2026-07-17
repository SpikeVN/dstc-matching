import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Heart, MessageCircle, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function MatchOverlay({ show, matchedProfile, onClose }) {
  const navigate = useNavigate();
  if (!show || !matchedProfile) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.4, opacity: 0 }}
          transition={{ type: 'spring', damping: 12 }}
          className="glass-card rounded-2xl p-8 max-w-sm w-full text-center border border-primary/30 "
          onClick={e => e.stopPropagation()}
        >
          {/* Pulse rings animation */}
          <div className="relative w-20 h-20 mx-auto mb-4">
            <motion.div
              animate={{ scale: [1, 1.4, 1], opacity: [0.8, 0, 0.8] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
              className="absolute inset-0 rounded-full border-2 border-primary/60"
            />
            <motion.div
              animate={{ scale: [1, 1.7, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ repeat: Infinity, duration: 1.5, delay: 0.3 }}
              className="absolute inset-0 rounded-full border border-primary/30"
            />
            <div className="relative w-20 h-20 rounded-full bg-primary/10 border-2 border-primary flex items-center justify-center ">
              <Zap className="w-8 h-8 text-primary" />
            </div>
          </div>

          <h2 className="font-display font-bold text-xl text-primary mb-1">
            IT'S A MATCH!
          </h2>
          <p className="text-muted-foreground font-mono text-xs mt-2 leading-relaxed">
            Bạn và <span className="text-primary font-semibold">{matchedProfile.display_name}</span><br />
            đã cùng thích nhau 🎯
          </p>

          <div className="mt-6 space-y-2">
            <Button
              className="w-full h-11 font-display text-xs font-medium gap-2 bg-primary text-background hover:bg-primary/90 "
              onClick={() => { onClose(); navigate('/messages'); }}
            >
              <MessageCircle className="w-4 h-4" />
              Nhắn tin ngay
            </Button>
            <Button
              variant="outline"
              className="w-full font-mono text-xs border-primary/20 text-muted-foreground hover:border-primary/40"
              onClick={onClose}
            >
              Tiếp tục khám phá
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}