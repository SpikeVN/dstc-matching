import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { db } from '@/api/apiClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { motion } from 'framer-motion';
import PageFooter from '@/components/layout/PageFooter';

const GREEN = '#71d65b';
const BG = '#0a120b';
const BORDER = '#2a4b2e';
const SUBTEXT = '#96aa98';
const FG = '#cedfd0';

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  // After login, go back to the page the user was trying to visit (or /)
  const returnTo = searchParams.get('redirect') || '/';

  // Show error from URL query param (e.g. from GoTrue redirect with expired token)
  // Show success message after password reset
  useEffect(() => {
    const urlError = searchParams.get('error');
    if (urlError) {
      setError(urlError);
      navigate('/login', { replace: true });
      return;
    }
    if (searchParams.get('reset') === 'success') {
      setResetSuccess(true);
      navigate('/login', { replace: true });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate(returnTo, { replace: true });
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden" style={{ background: BG }}>
      {/* Background decoration */}
      <img
        src="/background.webp"
        alt=""
        className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none select-none opacity-40"
      />

      {/* Centered card area (takes remaining space) */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-4">
        <div className="w-full max-w-md flex flex-col items-center">
          {/* Card */}
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
                Đăng nhập
              </h1>
              <p className="mt-1.5 text-sm" style={{ color: SUBTEXT }}>
                Chào mừng bạn đến với DSTC 2026!
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

            {/* Password reset success */}
            {resetSuccess && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-2 p-2 rounded-lg text-xs"
                style={{
                  background: 'rgba(113,214,91,0.1)',
                  color: GREEN,
                  border: '1px solid rgba(113,214,91,0.2)',
                }}
              >
                Mật khẩu đã được đặt lại thành công. Vui lòng đăng nhập bằng mật khẩu mới.
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
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Nhập email của bạn"
                  required
                  className="h-10 rounded-lg"
                  style={{
                    background: 'rgba(42,75,46,0.1)',
                    borderColor: `${BORDER}80`,
                    color: FG,
                  }}
                />
              </div>

              <div className="grid gap-1.5">
                <label
                  htmlFor="password"
                  className="text-xs font-medium"
                  style={{ color: SUBTEXT }}
                >
                  Mật khẩu
                </label>
                <PasswordInput
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Nhập mật khẩu của bạn"
                  required
                  className="h-10 rounded-lg"
                  style={{
                    background: 'rgba(42,75,46,0.1)',
                    borderColor: `${BORDER}80`,
                    color: FG,
                  }}
                />
              </div>

              <div className="flex justify-end -mt-2">
                <Link
                  to="/forgot-password"
                  className="text-xs font-medium hover:underline underline-offset-4 transition-colors"
                  style={{ color: GREEN }}
                >
                  Quên mật khẩu?
                </Link>
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
                    Đang đăng nhập...
                  </span>
                ) : (
                  'Đăng nhập'
                )}
              </Button>
            </form>

            {/* Divider */}
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full h-px" style={{ background: `${BORDER}60` }} />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="px-3" style={{ background: 'rgba(10, 18, 11, 0.9)', color: SUBTEXT }}>
                  hoặc tiếp tục với
                </span>
              </div>
            </div>

            {/* Google Login (redirect flow — same as GitHub) */}
            <Button
              variant="outline"
              className="w-full h-10 rounded-lg font-medium text-sm cursor-pointer bg-transparent hover:bg-white/5"
              style={{ borderColor: `${BORDER}60`, color: FG }}
              onClick={async () => {
                try {
                  const url = await db.auth.googleAuthorize();
                  window.location.href = url;
                } catch (err) {
                  setError(err.message || 'Google login failed');
                }
              }}
            >
              <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Tiếp tục với Google
            </Button>

            {/* GitHub Login */}
            <Button
              variant="outline"
              className="w-full h-10 rounded-lg font-medium text-sm mt-3 cursor-pointer bg-transparent hover:bg-white/5"
              style={{ borderColor: `${BORDER}60`, color: FG }}
              onClick={async () => {
                try {
                  const url = await db.auth.githubAuthorize();
                  window.location.href = url;
                } catch (err) {
                  setError(err.message || 'GitHub login failed');
                }
              }}
            >
              <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
              Tiếp tục với GitHub
            </Button>

            {/* Sign up link */}
            <p className="text-center text-sm mt-5" style={{ color: SUBTEXT }}>
              Chưa có tài khoản?{' '}
              <Link
                to="/signup"
                className="font-semibold hover:underline underline-offset-4 transition-colors"
                style={{ color: GREEN }}
              >
                Đăng ký
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* Footer – always at bottom */}
      <PageFooter compact />
    </div>
  );
}