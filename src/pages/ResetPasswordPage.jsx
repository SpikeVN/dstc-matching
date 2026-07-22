import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { db } from '@/api/apiClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion } from 'framer-motion';
import PageFooter from '@/components/layout/PageFooter';
import { Lock, Eye, EyeOff, CheckCircle, AlertCircle, Check, X } from 'lucide-react';

const GREEN = '#71d65b';
const BG = '#0a120b';
const BORDER = '#2a4b2e';
const SUBTEXT = '#96aa98';
const FG = '#cedfd0';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [success, setSuccess] = useState(false);

  // Recovery token comes as a query parameter (?token=...)
  // This is a scoped JWT with aud:"recovery" — NOT a full access token.
  const recoveryToken = searchParams.get('token');
  const hasToken = !!recoveryToken;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Mật khẩu phải có ít nhất 6 ký tự');
      return;
    }
    if (password !== confirmPassword) {
      setError('Mật khẩu không khớp');
      return;
    }

    setLoading(true);
    try {
      await db.auth.resetPassword(recoveryToken, password);
      setSuccess(true);
      setTimeout(() => navigate('/login?reset=success'), 2000);
    } catch (err) {
      setError(err.message || 'Không thể đặt lại mật khẩu');
    } finally {
      setLoading(false);
    }
  };

  if (!hasToken) {
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
            <div
              className="mx-auto mb-4 w-14 h-14 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(239, 68, 68, 0.15)' }}
            >
              <AlertCircle className="w-7 h-7 text-destructive" />
            </div>
            <h2 className="text-lg font-bold mb-2" style={{ color: FG }}>
              Liên kết không hợp lệ
            </h2>
            <p className="text-sm mb-5" style={{ color: SUBTEXT }}>
              Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.
              Vui lòng yêu cầu liên kết mới.
            </p>
            <Link to="/forgot-password">
              <Button
                className="w-full h-10 rounded-lg font-semibold text-sm"
                style={{ background: GREEN, color: BG }}
              >
                Gửi liên kết mới
              </Button>
            </Link>
            <p className="text-center text-sm mt-4" style={{ color: SUBTEXT }}>
              <Link
                to="/login"
                className="font-medium hover:underline underline-offset-4 transition-colors"
                style={{ color: GREEN }}
              >
                Quay lại đăng nhập
              </Link>
            </p>
          </div>
          <PageFooter compact />
        </div>
      </div>
    );
  }

  if (success) {
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
              Đặt lại mật khẩu thành công!
            </h2>
            <p className="text-sm" style={{ color: SUBTEXT }}>
              Mật khẩu của bạn đã được cập nhật.
              Đang chuyển hướng đến trang đăng nhập...
            </p>
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
              Đặt mật khẩu mới
            </h1>
            <p className="mt-1.5 text-sm" style={{ color: SUBTEXT }}>
              Nhập mật khẩu mới cho tài khoản của bạn
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
                htmlFor="password"
                className="text-xs font-medium"
                style={{ color: SUBTEXT }}
              >
                Mật khẩu mới
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: SUBTEXT }} />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Nhập mật khẩu mới"
                  required
                  minLength={6}
                  className="h-10 rounded-lg pl-10 pr-10"
                  style={{
                    background: 'rgba(42,75,46,0.1)',
                    borderColor: `${BORDER}80`,
                    color: FG,
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: SUBTEXT }}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="grid gap-1.5">
              <label
                htmlFor="confirmPassword"
                className="text-xs font-medium"
                style={{ color: SUBTEXT }}
              >
                Xác nhận mật khẩu
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: SUBTEXT }} />
                <Input
                  id="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Nhập lại mật khẩu mới"
                  required
                  minLength={6}
                  className="h-10 rounded-lg pl-10"
                  style={{
                    background: 'rgba(42,75,46,0.1)',
                    borderColor: `${BORDER}80`,
                    color: FG,
                  }}
                />
              </div>
              {confirmPassword.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-1.5 text-xs"
                  style={{ color: password === confirmPassword ? GREEN : '#fca5a5' }}
                >
                  {password === confirmPassword ? (
                    <><Check className="w-3.5 h-3.5" /> Mật khẩu khớp</>
                  ) : (
                    <><X className="w-3.5 h-3.5" /> Mật khẩu không khớp</>
                  )}
                </motion.div>
              )}
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
                  Đang cập nhật...
                </span>
              ) : (
                'Đặt mật khẩu mới'
              )}
            </Button>
          </form>
        </div>

        <PageFooter compact />
      </div>
    </div>
  );
}
