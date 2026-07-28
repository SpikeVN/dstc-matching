import React, { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import TermsContent from '/docs/terms.mdx';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, FileText } from 'lucide-react';

const GREEN = '#71d65b';
const BG = '#0a120b';

export default function TermsPopup() {
  const { acceptTerms, user } = useAuth();
  const [accepting, setAccepting] = useState(false);
  const [scrolledToBottom, setScrolledToBottom] = useState(false);
  const [error, setError] = useState('');

  const handleScroll = (e) => {
    const el = e.currentTarget;
    // Consider "bottom" reached when within 10px of the bottom
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 10) {
      setScrolledToBottom(true);
    }
  };

  const handleAccept = async () => {
    setAccepting(true);
    setError('');
    try {
      await acceptTerms();
    } catch (err) {
      setError(err.message || 'Không thể lưu lựa chọn');
      setAccepting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-lg max-h-[85vh] flex flex-col rounded-2xl overflow-hidden"
          style={{
            background: 'rgba(10, 18, 11, 0.98)',
            border: '1px solid rgba(42, 75, 46, 0.4)',
            boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
          }}
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-[#2a4b2e]/30">
            <div className="flex items-center gap-2.5">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center"
                style={{ background: 'rgba(113, 214, 91, 0.12)' }}
              >
                <FileText className="w-4 h-4" style={{ color: GREEN }} />
              </div>
              <div>
                <h2 className="text-base font-bold" style={{ color: '#cedfd0' }}>
                  Điều khoản sử dụng
                </h2>
                <p className="text-xs mt-0.5" style={{ color: '#96aa98' }}>
                  Vui lòng đọc và đồng ý với điều khoản trước khi tiếp tục
                </p>
              </div>
            </div>
          </div>

          {/* Scrollable terms content */}
          <div
            className="flex-1 overflow-y-auto px-6 py-4 prose prose-invert prose-sm max-w-none"
            style={{ color: '#cedfd0' }}
            onScroll={handleScroll}
          >
            <TermsContent />
          </div>

          {/* Error */}
          {error && (
            <div className="px-6 pb-2">
              <p className="text-xs" style={{ color: '#fca5a5' }}>{error}</p>
            </div>
          )}

          {/* Footer */}
          <div
            className="px-6 py-4 border-t border-[#2a4b2e]/30 flex items-center justify-between gap-3"
            style={{ background: 'rgba(10, 18, 11, 0.95)' }}
          >
            <p className="text-xs" style={{ color: '#96aa98' }}>
              {scrolledToBottom
                ? 'Bạn đã đọc toàn bộ điều khoản'
                : 'Hãy cuộn xuống cuối để xem toàn bộ điều khoản'}
            </p>
            <Button
              onClick={handleAccept}
              disabled={accepting || !scrolledToBottom}
              className="h-9 rounded-lg font-semibold text-xs tracking-wide transition-all duration-200 cursor-pointer flex-shrink-0"
              style={{
                background: scrolledToBottom ? GREEN : 'rgba(42, 75, 46, 0.3)',
                color: scrolledToBottom ? BG : '#96aa98',
                border: scrolledToBottom ? 'none' : '1px solid rgba(42, 75, 46, 0.5)',
              }}
            >
              {accepting ? (
                <span className="flex items-center gap-1.5">
                  <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Đang lưu...
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5" />
                  Tôi đồng ý
                </span>
              )}
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
