import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion } from 'framer-motion';

const FIGMA_GREEN = '#71d65b';
const FIGMA_BG = '#0a120b';
const FIGMA_BORDER = '#2a4b2e';
const FIGMA_SUBTEXT = '#96aa98';
const FIGMA_FG = '#cedfd0';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, googleLogin } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const googleBtnRef = useRef(null);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !window.google?.accounts?.id) return;
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: async (response) => {
        try {
          await googleLogin(response.credential);
          navigate('/');
        } catch (err) {
          setError(err.message || 'Google login failed');
        }
      },
    });
    if (googleBtnRef.current) {
      window.google.accounts.id.renderButton(googleBtnRef.current, {
        theme: 'filled_black',
        size: 'large',
        width: '100%',
        text: 'signin_with',
      });
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: FIGMA_BG, color: FIGMA_FG }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md p-8 rounded-2xl border"
        style={{ background: 'rgba(42,75,46,0.1)', borderColor: FIGMA_BORDER }}
      >
        <div className="text-center mb-8">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: FIGMA_GREEN }}
          >
            <span className="font-bold text-xl" style={{ color: FIGMA_BG, fontFamily: "'Rockwell', serif" }}>
              D
            </span>
          </div>
          <h1 className="text-2xl font-bold">Đăng nhập</h1>
          <p className="text-sm mt-1" style={{ color: FIGMA_SUBTEXT }}>
            Chào mừng bạn quay trở lại
          </p>
        </div>

        {error && (
          <div
            className="mb-4 p-3 rounded-lg text-sm"
            style={{ background: 'rgba(239,68,68,0.15)', color: '#fca5a5' }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-sm mb-1 block" style={{ color: FIGMA_SUBTEXT }}>
              Email
            </label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="rounded-xl"
              style={{ background: 'rgba(42,75,46,0.2)', borderColor: FIGMA_BORDER, color: FIGMA_FG }}
            />
          </div>
          <div>
            <label className="text-sm mb-1 block" style={{ color: FIGMA_SUBTEXT }}>
              Mật khẩu
            </label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="rounded-xl"
              style={{ background: 'rgba(42,75,46,0.2)', borderColor: FIGMA_BORDER, color: FIGMA_FG }}
            />
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl font-semibold py-3"
            style={{ background: FIGMA_GREEN, color: FIGMA_BG }}
          >
            {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </Button>
        </form>

        <div className="my-6 flex items-center gap-3">
          <div className="flex-1 h-px" style={{ background: FIGMA_BORDER }} />
          <span className="text-xs" style={{ color: FIGMA_SUBTEXT }}>hoặc</span>
          <div className="flex-1 h-px" style={{ background: FIGMA_BORDER }} />
        </div>

        {GOOGLE_CLIENT_ID ? (
          <div ref={googleBtnRef} className="w-full flex justify-center" />
        ) : (
          <Button
            disabled
            variant="outline"
            className="w-full rounded-xl font-semibold py-3"
            style={{ borderColor: FIGMA_BORDER, color: FIGMA_SUBTEXT }}
          >
            Google chưa được cấu hình
          </Button>
        )}

        <p className="text-center text-sm mt-6" style={{ color: FIGMA_SUBTEXT }}>
          Chưa có tài khoản?{' '}
          <Link to="/signup" className="font-semibold hover:underline" style={{ color: FIGMA_GREEN }}>
            Đăng ký
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
