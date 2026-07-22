import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import PageFooter from '@/components/layout/PageFooter';

const GREEN = '#71d65b';
const BG = '#0a120b';
const BORDER = '#2a4b2e';
const SUBTEXT = '#96aa98';
const FG = '#cedfd0';

/**
 * Email verification landing page.
 *
 * Standard flow: GoTrue's GET /verify processes the token and redirects here
 * with access_token & refresh_token in the URL hash. The hash capture in
 * apiClient.js stores them before React mounts. AuthContext then picks them
 * up and the user lands on the dashboard — this page is never even seen.
 *
 * This page exists as a fallback if the redirect doesn't include tokens
 * (e.g. expired link, or user navigated here directly).
 */
export default function VerifyEmail() {
  const [hasTokens, setHasTokens] = useState(false);

  useEffect(() => {
    // Check if tokens were captured from the hash (set by apiClient.js)
    const token = localStorage.getItem('access_token');
    if (token) {
      setHasTokens(true);
      // Redirect to dashboard after a brief delay
      setTimeout(() => { window.location.href = '/'; }, 2000);
    }
  }, []);

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
          <div className="flex justify-center mb-4">
            <img src="/dstc-key-sphere.webp" alt="DSTC" className="w-14 h-14" />
          </div>

          {hasTokens ? (
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(113, 214, 91, 0.15)' }}
                >
                  <svg className="w-8 h-8" style={{ color: GREEN }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
              <h1 className="text-xl font-bold tracking-tight mb-2" style={{ color: FG }}>
                Email đã được xác minh!
              </h1>
              <p className="text-sm" style={{ color: SUBTEXT }}>
                Đang chuyển hướng...
              </p>
            </div>
          ) : (
            <div className="text-center">
              <h1 className="text-xl font-bold tracking-tight mb-2" style={{ color: FG }}>
                Xác minh email
              </h1>
              <p className="text-sm mb-6" style={{ color: SUBTEXT }}>
                Nếu bạn không được chuyển hướng tự động, vui lòng kiểm tra email và nhấn vào liên kết xác minh.
              </p>
              <Link
                to="/login"
                className="inline-block w-full h-10 rounded-lg font-semibold text-sm tracking-wide flex items-center justify-center"
                style={{ background: GREEN, color: BG }}
              >
                Đến trang đăng nhập
              </Link>
            </div>
          )}
        </div>

        <PageFooter compact />
      </div>
    </div>
  );
}
