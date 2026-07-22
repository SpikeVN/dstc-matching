import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { db } from '@/api/apiClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion } from 'framer-motion';
import PageFooter from '@/components/layout/PageFooter';
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react';

const GREEN = '#71d65b';
const BG = '#0a120b';
const BORDER = '#2a4b2e';
const SUBTEXT = '#96aa98';
const FG = '#cedfd0';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await db.auth.forgotPassword(email);
      setSent(true);
    } catch (err) {
      setError(err.message || 'Không thể gửi email đặt lại mật khẩu');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="relative h-screen flex flex-col items-center justify-center px-4 py-4 overflow-hidden">
        <div className="relative z-10 w-full max-w-md flex flex-col items-center">
          <div
            className="rounded-2xl p-7 w-full text-center"
            style={{
              background: 'rgba(10, 18, 11, 0.95)',
              border: `1px solid ${BORDER}40`,
              boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
            }}
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', duration: 0.5 }}
              className="mx-auto mb-4 w-14 h-14 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(113, 214, 91, 0.15)' }}
            >
              <CheckCircle className="w-7 h-7" style={{ color: GREEN }} />
            </motion.div>
            <h2 className="text-lg font-bold mb-2" style={{ color: FG }}>
              Kiểm tra email của bạn
            </h2>
            <p className="text-sm mb-4" style={{ color: SUBTEXT }}>
              Chúng mình đã gửi liên kết đặt lại mật khẩu đến{' '}
              <span className="font-medium" style={{ color: FG }}>{email}</span>.
              Nhấn vào liên kết trong email để tạo mật khẩu mới.
            </p>
            <p className="text-xs mb-5" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Không thấy email? Kiểm tra thư mục spam hoặc thử lại.
            </p>
            <Link to="/login">
              <Button
                variant="outline"
                className="w-full h-10 rounded-lg font-medium text-sm"
                style={{ borderColor: `${BORDER}60`, color: SUBTEXT, background: 'transparent' }}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Quay lại đăng nhập
              </Button>
            </Link>
          </div>
          <PageFooter compact />
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-screen flex flex-col items-center justify-center px-4 py-4 overflow-hidden">
      <div className="relative z-10 w-full max-w-md flex flex-col items-center">
        <div
          className="rounded-2xl p-7 w-full"
          style={{
            background: 'rgba(10, 18, 11, 0.95)',
            border: `1px solid ${BORDER}40`,
            boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
          }}
        >
          {/* Logo */}
          <div className="flex justify-center mb-4">
            <img src="/dstc-key-sphere.webp" alt="DSTC" className="w-14 h-14" />
          </div>

          {/* Header */}
          <div className="text-center mb-5">
            <h1 className="text-xl font-bold tracking-tight" style={{ color: FG }}>
              Quên mật khẩu
            </h1>
            <p className="mt-1.5 text-sm" style={{ color: SUBTEXT }}>
              Nhập email để nhận liên kết đặt lại mật khẩu
            </p>
          </div>

          {/* Error */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-2 p-2 rounded-lg text-xs"
              style={{
                background: 'rgba(239,68,68,0.1)',
                color: '#fca5a5',
                border: '1px solid rgba(239,68,68,0.15)',
              }}
            >
              {error}
            </motion.div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="grid gap-1.5">
              <label
                htmlFor="email"
                className="text-xs font-medium"
                style={{ color: SUBTEXT }}
              >
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: SUBTEXT }} />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Nhập email của bạn"
                  required
                  className="h-10 rounded-lg pl-10"
                  style={{
                    background: 'rgba(42,75,46,0.1)',
                    borderColor: `${BORDER}80`,
                    color: FG,
                  }}
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-10 rounded-lg font-semibold text-sm tracking-wide transition-all duration-200 cursor-pointer"
              style={{ background: GREEN, color: BG }}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Đang gửi...
                </span>
              ) : (
                'Gửi liên kết đặt lại'
              )}
            </Button>
          </form>

          {/* Back to login */}
          <p className="text-center text-sm mt-5" style={{ color: SUBTEXT }}>
            <Link
              to="/login"
              className="font-medium hover:underline underline-offset-4 transition-colors inline-flex items-center gap-1.5"
              style={{ color: GREEN }}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Quay lại đăng nhập
            </Link>
          </p>
        </div>

        <PageFooter compact />
      </div>
    </div>
  );
}
