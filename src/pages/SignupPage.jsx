import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion } from 'framer-motion';
import { Check, X, Shuffle } from 'lucide-react';
import PageFooter from '@/components/layout/PageFooter';

function randomUsername() {
  const adjectives = ['nhanh', 'thong', 'manh', 'dep', 'vui', 'tot', 'moi', 'dau', 'cao', 'sang'];
  const nouns = ['ho', 'long', 'sa', 'lua', 'gio', 'mua', 'nui', 'song', 'trang', 'sao'];
  const a = adjectives[Math.floor(Math.random() * adjectives.length)];
  const n = nouns[Math.floor(Math.random() * nouns.length)];
  const suffix = Math.floor(Math.random() * 900 + 100);
  return `${a}_${n}${suffix}`;
}

const GREEN = '#71d65b';
const BG = '#0a120b';
const BORDER = '#2a4b2e';
const SUBTEXT = '#96aa98';
const FG = '#cedfd0';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

export default function SignupPage() {
  const navigate = useNavigate();
  const { signup, googleLogin } = useAuth();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const gBtnNode = useRef(null);
  const gBtnCallback = useCallback((node) => {
    gBtnNode.current = node;
  }, []);
  const [gisReady, setGisReady] = useState(false);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;

    const initGis = () => {
      if (!window.google?.accounts?.id) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async (response) => {
          try {
            await googleLogin(response.credential);
            navigate('/');
          } catch (err) {
            setError(err.message || 'Google đăng ký thất bại');
          }
        },
      });
      setGisReady(true);
    };

    if (window.google?.accounts?.id) {
      initGis();
    } else {
      const timer = setInterval(() => {
        if (window.google?.accounts?.id) {
          clearInterval(timer);
          initGis();
        }
      }, 100);
      return () => clearInterval(timer);
    }
  }, []);

  useEffect(() => {
    if (!gisReady || !gBtnNode.current) return;
    const node = gBtnNode.current;
    window.google.accounts.id.renderButton(node, {
      theme: 'filled_black',
      size: 'large',
      text: 'continue_with',
      shape: 'pill',
      width: node.offsetWidth || 300,
    });
  }, [gisReady]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Mật khẩu không khớp');
      return;
    }
    if (password.length < 6) {
      setError('Mật khẩu phải có ít nhất 6 ký tự');
      return;
    }

    setLoading(true);
    try {
      const result = await signup(email, password, username);
      // If email confirmation is required, show the "check your email" screen
      if (result?.requires_email_confirmation) {
        setEmailSent(true);
      } else {
        navigate('/');
      }
    } catch (err) {
      setError(err.message || 'Đăng ký thất bại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative h-screen flex flex-col items-center justify-center px-4 py-4 overflow-hidden">
      <div className="relative z-10 w-full max-w-md flex flex-col items-center">
        {/* Card */}
        <div
          className="rounded-2xl p-6 w-full"
          style={{
            background: 'rgba(10, 18, 11, 0.95)',
            border: `1px solid ${BORDER}40`,
            boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
          }}
        >
          {/* Logo */}
          <div className="flex justify-center mb-3">
            <img src="/dstc-key-sphere.webp" alt="DSTC" className="w-14 h-14" />
          </div>

          {/* Header */}
          <div className="text-center mb-4">
            <h1 className="text-xl font-bold tracking-tight" style={{ color: FG }}>
              Đăng ký
            </h1>
            <p className="mt-1.5 text-sm" style={{ color: SUBTEXT }}>
              Tạo tài khoản mới để bắt đầu
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

          {/* Email sent confirmation */}
          {emailSent ? (
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(113, 214, 91, 0.15)' }}
                >
                  <svg className="w-8 h-8" style={{ color: GREEN }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
              <h2 className="text-lg font-bold tracking-tight mb-2" style={{ color: FG }}>
                Kiểm tra email của bạn
              </h2>
              <p className="text-sm mb-5" style={{ color: SUBTEXT }}>
                Chúng mình đã gửi email xác minh đến <strong style={{ color: FG }}>{email}</strong>.
                Vui lòng nhấn vào liên kết trong email để kích hoạt tài khoản.
              </p>
              <Link
                to="/login"
                className="w-full h-10 rounded-lg font-semibold text-sm tracking-wide flex items-center justify-center transition-all duration-200"
                style={{ background: GREEN, color: BG }}
              >
                Đến trang đăng nhập
              </Link>
            </div>
          ) : (
            <>
              {/* Form */}
              <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
                <div className="grid gap-1">
                  <label
                    htmlFor="username"
                    className="text-xs font-medium"
                    style={{ color: SUBTEXT }}
                  >
                    Tên đăng nhập
                  </label>
                  <div className="relative flex items-center gap-1.5">
                    <Input
                      id="username"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="nguyenvan_a"
                      required
                      className="h-10 rounded-lg pr-24"
                      style={{
                        background: 'rgba(42,75,46,0.1)',
                        borderColor: `${BORDER}80`,
                        color: FG,
                      }}
                    />
                    {username.length >= 1 && (
                      <img
                        src={`https://api.dicebear.com/9.x/identicon/svg?seed=${encodeURIComponent(username)}&scale=80`}
                        alt=""
                        className="absolute right-14 top-1/2 -translate-y-1/2 w-6 h-6 rounded"
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => setUsername(randomUsername())}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-white/10 transition-colors"
                      title="Tạo tên ngẫu nhiên"
                    >
                      <Shuffle className="w-4 h-4" style={{ color: SUBTEXT }} />
                    </button>
                  </div>
                </div>

                <div className="grid gap-1">
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

                <div className="grid gap-1">
                  <label
                    htmlFor="password"
                    className="text-xs font-medium"
                    style={{ color: SUBTEXT }}
                  >
                    Mật khẩu
                  </label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Nhập mật khẩu"
                    required
                    minLength={6}
                    className="h-10 rounded-lg"
                    style={{
                      background: 'rgba(42,75,46,0.1)',
                      borderColor: `${BORDER}80`,
                      color: FG,
                    }}
                  />
                </div>

                <div className="grid gap-1">
                  <label
                    htmlFor="confirmPassword"
                    className="text-xs font-medium"
                    style={{ color: SUBTEXT }}
                  >
                    Xác nhận mật khẩu
                  </label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Nhập lại mật khẩu"
                    required
                    className="h-10 rounded-lg"
                    style={{
                      background: 'rgba(42,75,46,0.1)',
                      borderColor: `${BORDER}80`,
                      color: FG,
                    }}
                  />
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
                      Đang đăng ký...
                    </span>
                  ) : (
                    'Đăng ký'
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

              {/* Google Login */}
              {GOOGLE_CLIENT_ID ? (
                <div
                  className="overflow-hidden"
                  style={{ height: 48, minHeight: 0 }}
                >
                  <div ref={gBtnCallback} className="w-full flex justify-center" />
                </div>
              ) : (
                <Button
                  disabled
                  variant="outline"
                  className="w-full h-10 rounded-lg font-medium text-sm cursor-not-allowed"
                  style={{ borderColor: `${BORDER}60`, color: SUBTEXT, background: 'transparent' }}
                >
                  <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                  Google chưa được cấu hình
                </Button>
              )}

              {/* Login link */}
              <p className="text-center text-sm mt-5" style={{ color: SUBTEXT }}>
                Đã có tài khoản?{' '}
                <Link
                  to="/login"
                  className="font-semibold hover:underline underline-offset-4 transition-colors"
                  style={{ color: GREEN }}
                >
                  Đăng nhập
                </Link>
              </p>
            </>
          )}
        </div>

        {/* Footer text */}
        <PageFooter compact />
      </div>
    </div>
  );
}
